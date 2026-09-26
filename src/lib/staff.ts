import "server-only";

import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { count, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { secret } from "./auth";
import { getDb, schema, type StaffRole } from "./db";

// Staff sign in to /admin with a username and password, kept in the database
// (password as a salted scrypt hash, never the password itself) and changeable
// from Admin → Account. The very first account comes from ADMIN_USERNAME /
// ADMIN_PASSWORD in .env.local when the staff table is empty.
//
// The login is a signed cookie tied to the account's password hash and a session
// version: changing the password, or signing out, ends every existing login.
//
// Roles: "owner" does everything; "helper" handles orders, exchanges and stock counts
// but can't change prices, products, refunds, festivals or staff.

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
  role: StaffRole;
}

/** First run: create the first staff account from .env.local, if there are none yet. */
async function ensureFirstStaff() {
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(schema.staff);
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (n > 0 || !username || !password) return;
  if (password.length < MIN_PASSWORD) {
    // Never seed a guessable first owner (e.g. a leftover "admin123").
    console.error(`[staff] ADMIN_PASSWORD must be at least ${MIN_PASSWORD} characters; the first staff account was not created.`);
    return;
  }
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
  return (await verifyPassword(password, row.passwordHash)) ? { id: row.id, username: row.username, role: row.role } : null;
}

// ---------- Session cookie ----------

const fingerprint = (hash: string) => createHash("sha256").update(hash).digest("base64url");
const sign = (payload: string, passwordHash: string, version: number) =>
  createHmac("sha256", `${secret()}:${fingerprint(passwordHash)}:${version}`).update(payload).digest("base64url");
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
  (await cookies()).set(ADMIN_COOKIE, `${payload}.${sign(payload, row.passwordHash, row.sessionVersion)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Strict: the staff login is never sent on a request started from another site.
    sameSite: "strict",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

/** Signs this staff member out everywhere (the cookie alone isn't trusted after this). */
export async function endAdminSession() {
  const me = await currentStaff();
  if (me) {
    const db = await getDb();
    await db
      .update(schema.staff)
      .set({ sessionVersion: sql`${schema.staff.sessionVersion} + 1` })
      .where(eq(schema.staff.id, me.id));
  }
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
  if (!row || !same(sig, sign(`${id}.${expires}`, row.passwordHash, row.sessionVersion))) return null;
  return { id: row.id, username: row.username, role: row.role };
});

/** For staff pages and actions: the staff member, or off to a staff login. */
export async function requireStaff(login = "/admin/login"): Promise<StaffMember> {
  const who = await currentStaff();
  if (!who) redirect(login);
  return who;
}

/** Owner-only pages and actions (the admin). Helpers are sent to their own portal. */
export async function requireOwner(): Promise<StaffMember> {
  const who = await requireStaff();
  if (who.role !== "owner") redirect("/helper");
  return who;
}

/** Where a staff member lands after signing in: helpers use /helper, owners /admin. */
export const staffHome = (who: Pick<StaffMember, "role">) => (who.role === "helper" ? "/helper" : "/admin");

/** Writes to the admin activity log. */
export async function logStaff(who: StaffMember, action: string, target?: string | null, detail?: Record<string, unknown>) {
  const db = await getDb();
  await db.insert(schema.staffEvents).values({ staffId: who.id, staffName: who.username, action, target: target ?? null, detail: detail ?? null });
}

export async function staffList() {
  const db = await getDb();
  return db
    .select({ id: schema.staff.id, username: schema.staff.username, role: schema.staff.role, createdAt: schema.staff.createdAt })
    .from(schema.staff)
    .orderBy(schema.staff.createdAt);
}

/**
 * Names staff can't take: they'd look like the website itself, the customer or the receiver
 * in order histories and the activity log ("system: Refunded ...").
 */
const RESERVED = new Set(["system", "owner", "admin", "customer", "receiver", "staff", "easypick"]);
export const reservedUsername = (u: string) => RESERVED.has(u.trim().toLowerCase());
const USERNAME_RULE = "Use 3 to 32 letters, numbers, dots, dashes or underscores.";
const RESERVED_MESSAGE = "That name is kept for the website itself. Pick another.";

export type AddStaffResult = { ok: true } | { ok: false; message: string };

export async function addStaff(username: string, password: string, role: StaffRole): Promise<AddStaffResult> {
  const u = username.trim();
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(u)) return { ok: false, message: USERNAME_RULE };
  if (reservedUsername(u)) return { ok: false, message: RESERVED_MESSAGE };
  if (password.length < MIN_PASSWORD) return { ok: false, message: `Use at least ${MIN_PASSWORD} characters for the password.` };
  if (await byUsername(u)) return { ok: false, message: "That username is taken." };
  const db = await getDb();
  const now = new Date().toISOString();
  const inserted = await db
    .insert(schema.staff)
    .values({ id: randomUUID(), username: u, passwordHash: await hashPassword(password), role, createdAt: now, updatedAt: now })
    .onConflictDoNothing()
    .returning({ id: schema.staff.id });
  // Someone added the same name a moment ago.
  if (!inserted.length) return { ok: false, message: "That username is taken." };
  return { ok: true };
}

export type RemoveStaffResult = { ok: true; username: string } | { ok: false; message: string };

/**
 * Removes a staff account (their logins stop working straight away). Never yourself, and
 * never the last owner: the owner rows are locked first, so two owners removing each other
 * at the same moment can't leave the shop with none.
 */
export async function removeStaff(id: string, byId: string): Promise<RemoveStaffResult> {
  if (id === byId) return { ok: false, message: "You can't remove yourself." };
  const db = await getDb();
  return db.transaction(async (tx) => {
    const owners = await tx.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.role, "owner")).orderBy(schema.staff.id).for("update");
    const [target] = await tx.select().from(schema.staff).where(eq(schema.staff.id, id)).for("update");
    if (!target) return { ok: false as const, message: "They've already been removed." };
    if (target.role === "owner" && owners.filter((o) => o.id !== id).length === 0) return { ok: false as const, message: "Keep at least one owner." };
    await tx.delete(schema.staff).where(eq(schema.staff.id, id));
    return { ok: true as const, username: target.username };
  });
}

// ---------- Owner tools for someone else's login ----------

export type StaffUpdateResult = { ok: true; username: string } | { ok: false; message: string };

/**
 * An owner sets a new password for another staff member (they forgot it, or it leaked).
 * Every device they're signed in on is signed out.
 */
export async function resetStaffPassword(id: string, byId: string, password: string): Promise<StaffUpdateResult> {
  if (id === byId) return { ok: false, message: "Change your own password under Account." };
  if (password.length < MIN_PASSWORD) return { ok: false, message: `Use at least ${MIN_PASSWORD} characters for the password.` };
  if (password.length > 256) return { ok: false, message: "That password is too long." };
  const db = await getDb();
  const [row] = await db
    .update(schema.staff)
    .set({ passwordHash: await hashPassword(password), sessionVersion: sql`${schema.staff.sessionVersion} + 1`, updatedAt: new Date().toISOString() })
    .where(eq(schema.staff.id, id))
    .returning({ username: schema.staff.username });
  return row ? { ok: true, username: row.username } : { ok: false, message: "They've been removed." };
}

/** Signs another staff member out on every phone and computer (e.g. a lost phone). */
export async function signOutStaffEverywhere(id: string, byId: string): Promise<StaffUpdateResult> {
  if (id === byId) return { ok: false, message: "Use Sign out for yourself." };
  const db = await getDb();
  const [row] = await db
    .update(schema.staff)
    .set({ sessionVersion: sql`${schema.staff.sessionVersion} + 1` })
    .where(eq(schema.staff.id, id))
    .returning({ username: schema.staff.username });
  return row ? { ok: true, username: row.username } : { ok: false, message: "They've been removed." };
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
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(u)) return { ok: false, field: "username", message: USERNAME_RULE };
    // Keeping an existing reserved name (e.g. the first owner seeded as "admin") is fine.
    if (reservedUsername(u) && u.toLowerCase() !== row.username.toLowerCase()) return { ok: false, field: "username", message: RESERVED_MESSAGE };
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
