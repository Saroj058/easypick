import "server-only";

import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { count, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { secret } from "./auth";
import { getDb, schema } from "./db";

// Staff sign in to /admin with a username and password, kept in the database
// (password as a salted scrypt hash, never the password itself) and changeable
// from Admin → Account. The very first account comes from ADMIN_USERNAME /
// ADMIN_PASSWORD in .env.local when the staff table is empty.
//
// The login is a signed cookie tied to the account's password hash: changing
// the password signs out every other device.

export const ADMIN_COOKIE = "ep_admin";
const TTL_MS = 12 * 60 * 60_000;
export const MIN_PASSWORD = 10;

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1 };

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 32, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const got = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return timingSafeEqual(got, expected);
}

// Checked when a username doesn't exist, so a wrong username takes as long as a wrong password.
let dummyHash: Promise<string> | null = null;

export interface StaffMember {
  id: string;
  username: string;
}

/** First run: create the first staff account from .env.local, if there are none yet. */
async function ensureFirstStaff() {
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.staff);
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (n > 0 || !username || !password) return;
  const now = new Date().toISOString();
  await db
    .insert(schema.staff)
    .values({ id: randomUUID(), username, passwordHash: await hashPassword(password), createdAt: now, updatedAt: now })
    .onConflictDoNothing();
}

export async function adminConfigured() {
  await ensureFirstStaff();
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.staff);
  return n > 0;
}

const byUsername = async (username: string) => {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.staff)
    .where(sql`lower(${schema.staff.username}) = ${username.trim().toLowerCase()}`);
  return row ?? null;
};

/** The account for these details, or null. */
export async function checkAdminLogin(username: string, password: string): Promise<StaffMember | null> {
  await ensureFirstStaff();
  const row = await byUsername(username);
  if (!row) {
    dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
    await verifyPassword(password, await dummyHash);
    return null;
  }
  return (await verifyPassword(password, row.passwordHash)) ? { id: row.id, username: row.username } : null;
}

// ---------- Session cookie ----------

const fingerprint = (hash: string) => createHash("sha256").update(hash).digest("base64url");
const sign = (payload: string, passwordHash: string) => createHmac("sha256", `${secret()}:${fingerprint(passwordHash)}`).update(payload).digest("base64url");
const same = (a: string, b: string) => {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
};

export async function startAdminSession(staffId: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.staff).where(eq(schema.staff.id, staffId));
  if (!row) return;
  const payload = `${row.id}.${Date.now() + TTL_MS}`;
  (await cookies()).set(ADMIN_COOKIE, `${payload}.${sign(payload, row.passwordHash)}`, {
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

/** The signed-in staff member, or null. */
export const currentStaff = cache(async (): Promise<StaffMember | null> => {
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!raw) return null;
  const [id, expires, sig] = raw.split(".");
  if (!id || !sig || !(Number(expires) > Date.now())) return null;
  const db = await getDb();
  const [row] = await db.select().from(schema.staff).where(eq(schema.staff.id, id));
  if (!row || !same(sig, sign(`${id}.${expires}`, row.passwordHash))) return null;
  return { id: row.id, username: row.username };
});

/** For admin pages and actions: the staff member, or off to the staff login. */
export async function requireStaff(): Promise<StaffMember> {
  const who = await currentStaff();
  if (!who) redirect("/admin/login");
  return who;
}

// ---------- Changing your own details ----------

export type ChangeResult = { ok: true } | { ok: false; field: "current" | "username" | "password"; message: string };

export async function changeStaffLogin(staffId: string, currentPassword: string, next: { username?: string; password?: string }): Promise<ChangeResult> {
  const db = await getDb();
  const [row] = await db.select().from(schema.staff).where(eq(schema.staff.id, staffId));
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) return { ok: false, field: "current", message: "Your current password isn't right." };

  const set: Partial<typeof schema.staff.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (next.username !== undefined) {
    const u = next.username.trim();
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(u)) return { ok: false, field: "username", message: "Use 3 to 32 letters, numbers, dots, dashes or underscores." };
    const taken = await byUsername(u);
    if (taken && taken.id !== staffId) return { ok: false, field: "username", message: "That username is taken." };
    set.username = u;
  }
  if (next.password !== undefined) {
    if (next.password.length < MIN_PASSWORD) return { ok: false, field: "password", message: `Use at least ${MIN_PASSWORD} characters.` };
    if (next.password === currentPassword) return { ok: false, field: "password", message: "Pick a password different from the current one." };
    set.passwordHash = await hashPassword(next.password);
  }
  await db.update(schema.staff).set(set).where(eq(schema.staff.id, staffId));
  return { ok: true };
}
