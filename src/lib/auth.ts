import "server-only";

import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";

import { and, eq, gt, isNull, lt, ne } from "drizzle-orm";

import { alertStaff } from "./alerts";
import { getDb, schema, type User } from "./db";
import { allow, clientIp, hit, isBlocked } from "./rate-limit";
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
const MAX_SENDS_PER_PHONE_DAY = 10;
const MAX_WRONG_CODES_PER_IP_HOUR = 20;
const DAY_MS = 86_400_000;

export function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ chars) in production");
  // The public dev secret must never sign sessions or codes against the live database.
  if (!databaseIsLocal()) throw new Error("Set SESSION_SECRET (32+ chars) in .env.local — you're using the live database");
  return "dev-only-secret-change-me-dev-only-secret";
}

/** True when DATABASE_URL points at this computer (or isn't set, e.g. the offline dev database). */
function databaseIsLocal() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return true;
  try {
    const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
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
    return { ok: false, message: "Phone sign-in isn't available right now. Use Google instead." };
  }

  // Stop anyone running up the SMS bill: a daily ceiling for the whole site and for each
  // number (only codes actually sent count, so failed sends can't lock sign-in), and per visitor.
  const dailyCap = Number(process.env.CODE_DAILY_CAP ?? 1000);
  if (await isBlocked("code-daily", dailyCap)) {
    return { ok: false, message: "Phone sign-in is busy right now. Try Google, or try again later." };
  }
  if (await isBlocked(`code-phone-day:${phone}`, MAX_SENDS_PER_PHONE_DAY)) {
    return { ok: false, message: "Too many codes for this number today. Try again tomorrow." };
  }
  const ip = await clientIp();
  if (!(await allow(`code-ip:${ip}`, 10, 3600_000))) return { ok: false, message: "Too many codes from this device. Try again in an hour." };

  // Per number: one code every 30 seconds, 5 an hour. Checked and recorded in one locked
  // step, so two requests at once can't both slip under the limit.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const db = await getDb();
  const gate = await db.transaction(async (tx) => {
    await tx.insert(schema.otps).values({ phone, hash: "", expiresAt: 0, triesLeft: 0, sentAt: [] }).onConflictDoNothing();
    const [row] = await tx.select().from(schema.otps).where(eq(schema.otps.phone, phone)).for("update");
    const recent = row.sentAt.filter((t) => now - t < 3600_000);
    if (recent.length && now - recent[recent.length - 1] < RESEND_AFTER_MS) return "too-soon" as const;
    if (recent.length >= MAX_SENDS_PER_HOUR) return "hourly" as const;
    await tx
      .update(schema.otps)
      .set({ hash: codeHash(phone, code), expiresAt: now + CODE_TTL_MS, triesLeft: CODE_TRIES, sentAt: [...recent, now] })
      .where(eq(schema.otps.phone, phone));
    return "ok" as const;
  });
  if (gate === "too-soon") return { ok: false, message: "We just sent a code. Wait a few seconds before asking again." };
  if (gate === "hourly") return { ok: false, message: "Too many codes for this number. Try again in an hour." };

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
  await countSentCode(phone, dailyCap);
  // No channel set up yet (development only): show the code on screen so sign-in can be tested.
  const devCode = !via ? code : undefined;
  return { ok: true, resendInMs: RESEND_AFTER_MS, ...(devCode && { devCode }) };
}

/** Counts a code that really went out; tells the team once a day when half the site's daily codes are used. */
async function countSentCode(phone: string, dailyCap: number) {
  await hit(`code-phone-day:${phone}`, DAY_MS);
  const used = await hit("code-daily", DAY_MS);
  if (used >= Math.ceil(dailyCap / 2) && (await allow("code-daily-alert", 1, DAY_MS))) {
    await alertStaff(
      "Half of today's sign-in codes used",
      `${used} of ${dailyCap} sign-in codes have been sent in the last 24 hours. If that's not real customers, someone may be running up the SMS bill; at ${dailyCap} phone sign-in stops until the day resets (CODE_DAILY_CAP).`,
    );
  }
}

export type VerifyResult = { ok: true; user: User; isNew: boolean } | { ok: false; message: string };

/**
 * Checks a code and signs in (or creates the account for a new number).
 * `addToAccount`: the signed-in person asked to add this phone to their account
 * (the /login?add=phone screen), so it's attached instead of signing in to the number.
 */
export async function verifyCode(phone: string, code: string, opts: { addToAccount?: boolean } = {}): Promise<VerifyResult> {
  const now = Date.now();
  // Wrong guesses per visitor, so nobody can lock other people's numbers out by guessing.
  const ipKey = `code-verify-ip:${await clientIp()}`;
  if (await isBlocked(ipKey, MAX_WRONG_CODES_PER_IP_HOUR)) return { ok: false, message: "Too many wrong codes from this device. Try again in an hour." };
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

  if (check === "wrong" || check === "locked") await hit(ipKey, 3600_000);
  if (check === "expired") return { ok: false, message: "That code has expired. Send a new one." };
  if (check === "locked") return { ok: false, message: "Too many wrong tries. Send a new code." };
  if (check === "wrong") return { ok: false, message: "That code doesn't match. Check the message and try again." };

  // Signed in (e.g. with Google) and asked to add a phone: attach it to that account.
  const current = opts.addToAccount ? await getCurrentUser() : null;
  if (current) {
    const taken = "That number already has an Easypick account. Sign out and sign in with it instead.";
    if (current.phone && current.phone !== phone) return { ok: false, message: "Your account already has a phone number." };
    const other = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.phone, phone), ne(schema.users.id, current.id)));
    if (other.length) return { ok: false, message: taken };
    try {
      const user = (await updateUser(current.id, { phone, contactPhone: null }))!;
      return { ok: true, user, isNew: false };
    } catch (e) {
      if (isUniqueViolation(e)) return { ok: false, message: taken }; // taken a moment ago
      throw e;
    }
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
    // By verified email only onto an account not already linked to another login of this provider.
    if (!u && email && p.emailVerified)
      [u] = await tx
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.email, email), eq(schema.users.emailVerified, true), isNull(idCol)));
    let fresh = !u;
    if (!u) {
      // Two sign-ins at once for a new person: the second one finds the first one's account.
      [u] = await tx
        .insert(schema.users)
        .values({ id: randomUUID(), phone: null, name: p.name, email, alerts: false, fit: null, createdAt: iso, lastLoginAt: iso, [key]: p.id })
        .onConflictDoNothing({ target: idCol })
        .returning();
      if (!u) {
        [u] = await tx.select().from(schema.users).where(eq(idCol, p.id));
        fresh = false;
      }
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
  // A new sign-in replaces this browser's old session (it must not stay valid behind the new one).
  const old = (await cookies()).get(SESSION_COOKIE)?.value;
  if (old) await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha(old)));
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

/** "Sign out everywhere": ends every session of this account, on every phone and computer. */
export async function endAllSessions(userId: string) {
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  (await cookies()).delete(SESSION_COOKIE);
}

/** Postgres "duplicate key" (e.g. a phone number another account took a moment ago). */
function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code === "23505" || err?.cause?.code === "23505";
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

/**
 * Only allow redirects back into this site. Browsers read "//x", "/\x" and "/\t/x" as
 * other sites, so: no control characters or backslashes, and the path must resolve
 * to this origin. Returns the normalised path, query and hash.
 */
export function safeNext(next: unknown, fallback = "/account") {
  if (typeof next !== "string" || !next.startsWith("/") || next.length > 2048) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://x");
    if (u.origin !== "http://x") return fallback;
    const out = u.pathname + u.search + u.hash;
    // "/.//evil" normalises to "//evil": still another site to a browser.
    return out.startsWith("//") ? fallback : out;
  } catch {
    return fallback;
  }
}
