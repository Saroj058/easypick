import "server-only";

import { and, inArray, sql } from "drizzle-orm";

import { schema, type Exec } from "./db";
import { refundedQty, type Order } from "./orders";

// Pieces held for orders but still physically in the shop. Stock in `variants` is what's
// free to sell, so a shelf count (which sees these pieces too) must subtract them.

/**
 * Order statuses whose held pieces are still in the shop: placed and not yet paid, paid and
 * waiting to be packed, packed and waiting at the counter. Out for delivery has left the shop;
 * completed, expired and cancelled orders hold nothing.
 */
export const HELD_IN_SHOP: Order["status"][] = ["awaiting_payment", "paid", "ready_for_pickup"];

/** Pieces held per SKU (only SKUs with at least one), optionally only for these SKUs. */
export async function heldBySku(exec: Exec, skus?: string[]): Promise<Map<string, number>> {
  const held = new Map<string, number>();
  const want = skus ? new Set(skus) : null;
  if (want && !want.size) return held;
  const rows = await exec
    .select({ data: schema.orders.data })
    .from(schema.orders)
    .where(and(inArray(schema.orders.status, HELD_IN_SHOP), sql`${schema.orders.data}->>'stockHeld' = 'true'`));
  for (const { data: o } of rows) {
    if (o.kind === "gift_card") continue;
    // Pieces refunded already went back to stock (or out of it), so they aren't held any more.
    const done = refundedQty(o);
    o.lines.forEach((l, i) => {
      const qty = l.qty - (done[i] ?? 0);
      if (qty > 0 && (!want || want.has(l.sku))) held.set(l.sku, (held.get(l.sku) ?? 0) + qty);
    });
  }
  return held;
}
