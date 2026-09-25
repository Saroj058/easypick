import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { secret } from "./auth";

// Staff sign in to /admin with a username and password, separate from customer
// accounts. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env.local (never in code).
// The login is a signed cookie that lasts 12 hours; signing out removes it.

export const ADMIN_COOKIE = "ep_admin";
const TTL_MS = 12 * 60 * 60_000;

export function adminConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
}

const digest = (v: string) => createHash("sha256").update(v).digest();
/** Same-time comparison, so a wrong guess can't be timed to learn the right one. */
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export function checkAdminLogin(username: string, password: string) {
  if (!adminConfigured()) return false;
  // Both are always compared, so the answer takes the same time either way.
  const u = same(username.trim().toLowerCase(), process.env.ADMIN_USERNAME!.trim().toLowerCase());
  const p = same(password, process.env.ADMIN_PASSWORD!);
  return u && p;
}

// Changing the password signs everyone out: it is part of the signature.
const sign = (payload: string) => createHmac("sha256", `${secret()}:${process.env.ADMIN_PASSWORD}`).update(payload).digest("base64url");

export async function startAdminSession(username: string) {
  const payload = `${username.trim().toLowerCase()}.${Date.now() + TTL_MS}`;
  (await cookies()).set(ADMIN_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** The signed-in staff username, or null. */
export async function currentStaff(): Promise<string | null> {
  if (!adminConfigured()) return null;
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  const payload = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  if (!payload || !sig || !same(sig, sign(payload))) return null;
  const [username, expires] = [payload.slice(0, payload.lastIndexOf(".")), Number(payload.slice(payload.lastIndexOf(".") + 1))];
  if (!(expires > Date.now())) return null;
  return username;
}

/** For admin pages and actions: the staff username, or off to the staff login. */
export async function requireStaff(): Promise<string> {
  const who = await currentStaff();
  if (!who) redirect("/admin/login");
  return who;
}
