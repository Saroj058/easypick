import "server-only";

import { and, desc, gt, inArray, isNull, sql } from "drizzle-orm";

import { getDb, schema } from "./db";
import type { Order, PaymentAttempt } from "./orders";

// For the owner: orders that ended without payment although the customer went to pay.
// Money can still turn up for these (the cron keeps asking eSewa for 7 days), and a
// customer who says "I paid" is usually one of them.

export interface UnconfirmedOrder {
  order: Order;
  /** Its payment attempts from the last 7 days that the wallet hasn't confirmed, newest first. */
  attempts: PaymentAttempt[];
}

const WEEK = 7 * 86_400_000;

/** Expired or cancelled orders (never paid) with a payment attempt started in the last 7 days, newest first. */
export async function ordersWithUnconfirmedAttempts(limit = 100): Promise<UnconfirmedOrder[]> {
  const db = await getDb();
  const since = new Date(Date.now() - WEEK).toISOString();
  const rows = await db
    .select({ data: schema.orders.data })
    .from(schema.orders)
    .where(
      and(
        inArray(schema.orders.status, ["expired", "cancelled"]),
        isNull(schema.orders.paidAt),
        gt(schema.orders.createdAt, since),
        sql`(${schema.orders.data} ? 'payments' or ${schema.orders.data} ? 'payment')`,
      ),
    )
    .orderBy(desc(schema.orders.createdAt))
    .limit(limit);
  const cutoff = Date.now() - WEEK;
  return rows
    .map(({ data: order }) => ({
      order,
      attempts: [...(order.payments ?? (order.payment ? [order.payment] : []))].reverse().filter((a) => !a.verifiedAt && Date.parse(a.startedAt) > cutoff),
    }))
    .filter((r) => r.attempts.length > 0);
}
