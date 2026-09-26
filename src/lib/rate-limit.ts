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
 * The visitor's IP, as a rate-limit key. Only trusted on Vercel, where the platform sets
 * x-real-ip / x-forwarded-for itself (a visitor can't fake them). Anywhere else those
 * headers could be typed by the visitor, so everyone counts as "local".
 */
export async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers(), Boolean(process.env.VERCEL));
}

/** The pure part of clientIp, for tests. */
export function ipFromHeaders(h: { get(name: string): string | null }, trusted: boolean): string {
  if (!trusted) return "local";
  const real = h.get("x-real-ip")?.trim();
  const first = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = real || first;
  return ip ? ipKey(ip) : "local";
}

/**
 * One key per visitor. IPv4 as is; IPv6 by its /64 network, because one phone or
 * home connection gets a whole /64 and could otherwise use a new address per try.
 */
export function ipKey(raw: string): string {
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith("[")) ip = ip.slice(1, ip.includes("]") ? ip.indexOf("]") : undefined); // [v6]:port
  if (ip.includes("%")) ip = ip.slice(0, ip.indexOf("%")); // zone id
  const colons = (ip.match(/:/g) ?? []).length;
  if (colons === 0) return ip;
  if (colons === 1) return ip.split(":")[0]; // IPv4 with a port
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) return mapped[1];

  const halves = ip.split("::");
  if (halves.length > 2) return ip;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups = halves.length === 2 ? [...head, ...Array<string>(Math.max(0, 8 - head.length - tail.length)).fill("0"), ...tail] : head;
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return ip;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
