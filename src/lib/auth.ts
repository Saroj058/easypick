import "server-only";

import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";

import { and, eq, gt, lt, ne } from "drizzle-orm";

import { getDb, schema, type User } from "./db";
import { sendSms, smsProvider } from "./sms";
import { sendWhatsAppCode, whatsappConfigured } from "./whatsapp";

// Phone sign-in, per the Website doc: a 6-digit code by WhatsApp or SMS, valid 5 minutes,
// 3 tries, sessions last 30 days. Signing up is the same flow; a first-time
// number creates the account.
//
// Sessions are server-side: the browser holds a random token in an httpOnly
// cookie, the database keeps only its hash, so logging out really ends it.

export const SESSION_COOKIE = "ep_session";
const SESSION_DAYS = 30;
const CODE_TTL_MS = 5 * 60_000;
const CODE_TRIES = 3;
const RESEND_AFTER_MS = 30_000;
const MAX_SENDS_PER_HOUR = 5;

export function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ chars) in production");
  return "dev-only-secret-change-me-dev-only-secret";
}

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const codeHash = (phone: string, code: string) => createHmac("sha256", secret()).update(`${phone}:${code}`).digest("hex");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---------- Codes ----------

export type CodeChannel = "whatsapp" | "sms";

/** Channels that can deliver a login code right now. Empty means dev mode (code shown on screen). */
export function codeChannels(): CodeChannel[] {
  return [...(whatsappConfigured() ? (["whatsapp"] as const) : []), ...(smsProvider() ? (["sms"] as const) : [])];
}

export type RequestCodeResult = { ok: true; devCode?: string; resendInMs: number } | { ok: false; message: string };

export async function requestCode(phone: string, channel?: CodeChannel): Promise<RequestCodeResult> {
  const now = Date.now();
  const channels = codeChannels();
  const via = channel && channels.includes(channel) ? channel : channels[0];
  if (!via && process.env.NODE_ENV === "production") {
    return { ok: false, message: "Phone sign-in isn't available right now. Use Google or Facebook." };
  }

  const db = await getDb();
  const [existing] = await db.select().from(schema.otps).where(eq(schema.otps.phone, phone));
  const recent = existing?.sentAt.filter((t) => now - t < 3600_000) ?? [];

  if (recent.length && now - recent[recent.length - 1] < RESEND_AFTER_MS) {
    return { ok: false, message: "We just sent a code. Wait a few seconds before asking again." };
  }
  if (recent.length >= MAX_SENDS_PER_HOUR) {
    return { ok: false, message: "Too many codes for this number. Try again in an hour." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const otp = { phone, hash: codeHash(phone, code), expiresAt: now + CODE_TTL_MS, triesLeft: CODE_TRIES, sentAt: [...recent, now] };
  await db.insert(schema.otps).values(otp).onConflictDoUpdate({ target: schema.otps.phone, set: otp });

  try {
    if (via === "whatsapp") await sendWhatsAppCode(phone, code);
    else await sendSms(phone, `Your Easypick code is ${code}. It expires in 5 minutes. Don't share it.`);
  } catch {
    return {
      ok: false,
      message:
        via === "whatsapp"
          ? "We couldn't send it on WhatsApp. Check the number uses WhatsApp, or try SMS."
          : "We couldn't send the SMS right now. Please try again shortly.",
    };
  }
  // No channel set up yet (development only): show the code on screen so sign-in can be tested.
  const devCode = !via ? code : undefined;
  return { ok: true, resendInMs: RESEND_AFTER_MS, ...(devCode && { devCode }) };
}

export type VerifyResult = { ok: true; user: User; isNew: boolean } | { ok: false; message: string };

export async function verifyCode(phone: string, code: string): Promise<VerifyResult> {
  const now = Date.now();
  const db = await getDb();
  const check = await db.transaction(async (tx) => {
    const [otp] = await tx.select().from(schema.otps).where(eq(schema.otps.phone, phone)).for("update");
    if (!otp || otp.expiresAt < now) return "expired" as const;
    if (otp.triesLeft <= 0) return "locked" as const;
    if (!safeEqual(otp.hash, codeHash(phone, code))) {
      const triesLeft = otp.triesLeft - 1;
      await tx.update(schema.otps).set({ triesLeft }).where(eq(schema.otps.phone, phone));
      return triesLeft <= 0 ? ("locked" as const) : ("wrong" as const);
    }
    await tx.update(schema.otps).set({ expiresAt: 0 }).where(eq(schema.otps.phone, phone)); // one use only
    return "ok" as const;
  });

  if (check === "expired") return { ok: false, message: "That code has expired. Send a new one." };
  if (check === "locked") return { ok: false, message: "Too many wrong tries. Send a new code." };
  if (check === "wrong") return { ok: false, message: "That code doesn't match. Check the message and try again." };

  // Already signed in (e.g. with Google) and adding a phone: attach it to that account.
  const current = await getCurrentUser();
  if (current && !current.phone) {
    const taken = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.phone, phone), ne(schema.users.id, current.id)));
    if (taken.length) return { ok: false, message: "That number already has an Easypick account. Sign out and sign in with it instead." };
    const user = (await updateUser(current.id, { phone, contactPhone: null }))!;
    return { ok: true, user, isNew: false };
  }

  const iso = new Date(now).toISOString();
  const [existingUser] = await db.update(schema.users).set({ lastLoginAt: iso }).where(eq(schema.users.phone, phone)).returning();
  const isNew = !existingUser;
  const user: User =
    existingUser ??
    (
      await db
        .insert(schema.users)
        .values({ id: randomUUID(), phone, name: null, email: null, alerts: false, fit: null, createdAt: iso, lastLoginAt: iso })
        .returning()
    )[0];

  await startSession(user.id);
  return { ok: true, user, isNew };
}

// ---------- Google / Facebook ----------

export interface ProviderProfile {
  provider: "google" | "facebook";
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

/**
 * Finds or creates the account for a Google/Facebook sign-in and starts a session.
 * Links to an existing account only by the provider id, or by an email the
 * provider has verified, so nobody can claim someone else's account.
 */
export async function signInWithProvider(p: ProviderProfile): Promise<{ user: User; isNew: boolean }> {
  const key = p.provider === "google" ? "googleId" : "facebookId";
  const iso = new Date().toISOString();
  const email = p.email?.toLowerCase() ?? null;

  const db = await getDb();
  const idCol = key === "googleId" ? schema.users.googleId : schema.users.facebookId;
  const result = await db.transaction(async (tx) => {
    let [u] = await tx.select().from(schema.users).where(eq(idCol, p.id));
    if (!u && email && p.emailVerified)
      [u] = await tx
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.email, email), eq(schema.users.emailVerified, true)));
    const fresh = !u;
    if (!u) {
      [u] = await tx
        .insert(schema.users)
        .values({ id: randomUUID(), phone: null, name: p.name, email, alerts: false, fit: null, createdAt: iso, lastLoginAt: iso })
        .returning();
    }
    const patch: Partial<typeof schema.users.$inferInsert> = { [key]: p.id, name: u.name ?? p.name, lastLoginAt: iso };
    if (email && p.emailVerified && (!u.email || !u.emailVerified)) {
      patch.email = email;
      patch.emailVerified = true;
    } else if (!u.email) {
      patch.email = email;
    }
    const [updated] = await tx.update(schema.users).set(patch).where(eq(schema.users.id, u.id)).returning();
    return { user: updated as User, isNew: fresh };
  });

  await startSession(result.user.id);
  return result;
}

// ---------- Sessions ----------

async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DAYS * 86_400_000;
  const db = await getDb();
  await db.insert(schema.sessions).values({ tokenHash: sha(token), userId, expiresAt, createdAt: Date.now() });
  // Tidy up while here: expired sessions and old codes.
  const now = Date.now();
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
  await db.delete(schema.otps).where(lt(schema.otps.expiresAt, now - 3600_000));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

/** The signed-in user for this request, or null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, sha(token)), gt(schema.sessions.expiresAt, Date.now())));
  return row?.user ?? null;
});

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, "name" | "email" | "alerts" | "fit" | "phone" | "contactPhone" | "checkout">>,
): Promise<User | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, id)).for("update");
    if (!u) return null;
    const set: Partial<typeof schema.users.$inferInsert> = { ...patch };
    // A typed-in email is not verified, even when the old one was.
    if (patch.email !== undefined && patch.email !== u.email) set.emailVerified = false;
    const [updated] = await tx.update(schema.users).set(set).where(eq(schema.users.id, id)).returning();
    return updated;
  });
}

/** Only allow redirects back into this site. */
export function safeNext(next: unknown, fallback = "/account") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
