import "server-only";

import { asc, inArray, sql } from "drizzle-orm";

import { getDb, schema } from "./db";
import type { Order } from "./orders";

// Small, focused reads for the helper portal, so every page load doesn't pull every
// order ever paid.

const ACTIVE = ["paid", "ready_for_pickup", "out_for_delivery"] as const;
const hasAttention = sql`coalesce(${schema.orders.data}->>'attention', '') <> ''`;

/** For the helper nav badge: orders to pack, plus active orders that need the owner. */
export async function helperQueueCounts(): Promise<{ toPack: number; attention: number; waiting: number }> {
  const db = await getDb();
  const d = schema.orders.data;
  const toPackSql = sql`${schema.orders.status} = 'paid'
    and ${d}->>'packedAt' is null
    and coalesce(${d}->>'kind', 'goods') = 'goods'
    and coalesce(${d}->'gift'->>'status', '') <> 'converted'
    and not (coalesce(${d}->'gift'->>'mode', '') = 'pick' and coalesce(${d}->'gift'->>'status', '') in ('sent', 'opened'))`;
  const [row] = await db
    .select({
      toPack: sql<number>`count(*) filter (where ${toPackSql})::int`,
      attention: sql<number>`count(*) filter (where ${hasAttention})::int`,
      waiting: sql<number>`count(*) filter (where (${toPackSql}) or ${hasAttention})::int`,
    })
    .from(schema.orders)
    .where(inArray(schema.orders.status, [...ACTIVE]));
  return row ?? { toPack: 0, attention: 0, waiting: 0 };
}

/**
 * Orders still being handled (paid, at the counter, out for delivery), oldest first.
 * Flagged orders that are already finished or cancelled are the owner's to sort out,
 * so they aren't in the helper's queue (or badge).
 */
export async function helperQueue(): Promise<Order[]> {
  const db = await getDb();
  const rows = await db
    .select({ data: schema.orders.data })
    .from(schema.orders)
    .where(inArray(schema.orders.status, [...ACTIVE]))
    .orderBy(asc(sql`coalesce(${schema.orders.paidAt}, ${schema.orders.createdAt})`))
    .limit(500);
  return rows.map((r) => r.data);
}
