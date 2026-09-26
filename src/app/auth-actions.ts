"use server";

import { redirect } from "next/navigation";

import { endAllSessions, endSession, getCurrentUser, requestCode, safeNext, updateUser, verifyCode, type CodeChannel } from "@/lib/auth";
import type { FitProfile } from "@/lib/fit-profile";
import { normaliseNepaliMobile } from "@/lib/format";

// ---------- Phone sign-in (also sign-up) ----------

export type PhoneState =
  | { step: "phone"; error?: string }
  | { step: "code"; phone: string; masked: string; via?: CodeChannel; devCode?: string; error?: string; sentAt: number };

const mask = (p: string) => `${p.slice(0, 3)}•••${p.slice(-3)}`;

export async function phoneStep(prev: PhoneState, form: FormData): Promise<PhoneState> {
  const intent = String(form.get("intent") ?? "");
  const next = safeNext(form.get("next"));

  if (intent === "change") return { step: "phone" };

  if (intent === "send" || intent === "resend") {
    const phone = normaliseNepaliMobile(String(form.get("phone") ?? (prev.step === "code" ? prev.phone : "")));
    if (!phone) return { step: "phone", error: "Enter a 10-digit Nepali mobile number, like 98XXXXXXXX." };
    const asked = String(form.get("channel") ?? (prev.step === "code" ? (prev.via ?? "") : ""));
    const via = asked === "whatsapp" || asked === "sms" ? asked : undefined;
    const res = await requestCode(phone, via);
    if (!res.ok) {
      return prev.step === "code" ? { ...prev, error: res.message } : { step: "phone", error: res.message };
    }
    return { step: "code", phone, masked: mask(phone), via: res.devCode ? undefined : via, devCode: res.devCode, sentAt: Date.now() };
  }

  if (intent === "verify" && prev.step === "code") {
    const code = String(form.get("code") ?? "").replace(/\D/g, "");
    if (code.length !== 6) return { ...prev, error: "Enter the 6-digit code we sent you." };
    // Only the "Add your phone" screen attaches the number to the signed-in account.
    const res = await verifyCode(prev.phone, code, { addToAccount: form.get("add") === "phone" });
    if (!res.ok) return { ...prev, error: res.message };
    redirect(res.isNew || !res.user.name ? `/login/welcome?next=${encodeURIComponent(next)}` : next);
  }

  return prev;
}

// ---------- Profile ----------

export type ProfileState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

function readProfile(form: FormData) {
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const emailRaw = String(form.get("email") ?? "").trim().toLowerCase();
  // Longer than any real address can be (254): kept as typed so the format check rejects it.
  const email = emailRaw ? (emailRaw.length > 254 ? "invalid" : emailRaw) : null;
  const phoneRaw = String(form.get("phone") ?? "").trim();
  const phone = phoneRaw ? normaliseNepaliMobile(phoneRaw) : null;
  return { name, email, alerts: form.get("alerts") === "on", phoneRaw, phone };
}

/** First-time step after sign-up: name, optional email, drop alerts. */
export async function completeProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { name, email, alerts, phoneRaw, phone } = readProfile(form);
  if (!name) return { status: "error", message: "Tell us what to call you." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "error", message: "That email doesn't look right." };
  if (phoneRaw && !phone) return { status: "error", message: "Enter a 10-digit Nepali mobile number, or leave it empty." };
  await updateUser(user.id, { name, email: email ?? user.email, alerts, ...(!user.phone && { contactPhone: phone }) });
  redirect(safeNext(form.get("next")));
}

export async function saveProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Your session ended. Sign in again." };
  const { name, email, alerts, phoneRaw, phone } = readProfile(form);
  if (!name) return { status: "error", message: "Name can't be empty." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "error", message: "That email doesn't look right." };
  if (phoneRaw && !phone) return { status: "error", message: "Enter a 10-digit Nepali mobile number, or leave it empty." };
  await updateUser(user.id, { name, email, alerts, ...(!user.phone && { contactPhone: phone }) });
  return { status: "saved" };
}

export async function signOut() {
  await endSession();
  redirect("/");
}

/** Ends every session of this account (a lost phone, a shared computer). */
export async function signOutEverywhere() {
  const user = await getCurrentUser();
  if (user) await endAllSessions(user.id);
  else await endSession();
  redirect("/");
}

// ---------- Fit profile sync ----------

/** Saves "Your size in cm" to the account so it follows the person to any phone. No-op when signed out. */
export async function saveMyFit(fit: FitProfile) {
  const user = await getCurrentUser();
  if (!user) return;
  const clean = (n: unknown) => (typeof n === "number" && n >= 40 && n <= 200 ? Math.round(n) : undefined);
  await updateUser(user.id, { fit: { chest: clean(fit.chest), length: clean(fit.length), waist: clean(fit.waist) } });
}
