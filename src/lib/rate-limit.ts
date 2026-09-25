import "server-only";

import { eq, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { getDb, schema } from "./db";

// Attempt counters kept in the database, so every server instance (and every
// restart) sees the same numbers. Keys look like "admin-login:<ip>".

/** Counts one attempt; the window starts at the first attempt. Returns the count so far. */
export async function hit(key: string, windowMs: number): Promise<number> {
  const db = await getDb();
  const resetAt = new Date(Date.now() + windowMs).toISOString();
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: {
        count: sql`case when ${schema.rateLimits.resetAt} < now() then 1 else ${schema.rateLimits.count} + 1 end`,
        resetAt: sql`case when ${schema.rateLimits.resetAt} < now() then excluded.reset_at else ${schema.rateLimits.resetAt} end`,
      },
    })
    .returning({ count: schema.rateLimits.count });
  return row.count;
}

/** True when the key has reached `max` attempts in its current window. */
export async function isBlocked(key: string, max: number): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select().from(schema.rateLimits).where(eq(schema.rateLimits.key, key));
  return Boolean(row && Date.parse(row.resetAt) > Date.now() && row.count >= max);
}

/** Counts an attempt and says whether it's still within `max`. */
export async function allow(key: string, max: number, windowMs: number): Promise<boolean> {
  return (await hit(key, windowMs)) <= max;
}

export async function clearLimit(key: string) {
  const db = await getDb();
  await db.delete(schema.rateLimits).where(eq(schema.rateLimits.key, key));
}

export async function pruneLimits() {
  const db = await getDb();
  await db.delete(schema.rateLimits).where(lt(schema.rateLimits.resetAt, new Date().toISOString()));
}

/**
 * The visitor's IP. On Vercel `x-real-ip` is set by the platform (a visitor can't fake it);
 * elsewhere fall back to the last hop of x-forwarded-for, then "local".
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const fwd = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return fwd?.length ? fwd[fwd.length - 1] : "local";
}
