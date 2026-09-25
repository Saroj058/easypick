import "server-only";

import { and, gt, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { getDb, schema } from "./db";
import { esewaStatus } from "./gateways";
import { findOrder, lockOrder, type Order } from "./orders";
import { confirmPayment } from "./payments";
import { pruneLimits } from "./rate-limit";

// Catching payments the customer didn't come back from (closed the tab, lost signal),
// and routine tidying. Runs from /api/cron every few minutes, and for a single order
// when its page is opened.

/** Asks eSewa about an unpaid (or just-expired) order's payment attempts. True if it turned out paid. */
export async function reconcileOrder(order: Order): Promise<boolean> {
  if (order.status !== "awaiting_payment" && order.status !== "expired") return false;
  if (Date.now() - Date.parse(order.createdAt) > 24 * 3600_000) return false;
  const attempts = [...(order.payments ?? (order.payment ? [order.payment] : []))].reverse();
  for (const a of attempts) {
    if (a.provider !== "esewa") continue;
    try {
      const r = await esewaStatus(a.ref, order.total);
      if (r.ok && Math.abs(r.amount - order.total) < 0.001) {
        await confirmPayment(order.id, { provider: "esewa", ref: a.ref, gatewayRef: r.gatewayRef, amount: r.amount });
        return true;
      }
    } catch (e) {
      console.error("[reconcile] eSewa check failed", order.number, e);
    }
  }
  return false;
}

/** Recent orders that were started but not confirmed: expire what's late and check the wallet. */
export async function reconcileRecent() {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const rows = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(inArray(schema.orders.status, ["awaiting_payment", "expired"]), gt(schema.orders.createdAt, since)));
  let paid = 0;
  for (const { id } of rows) {
    const o = await findOrder(id); // expires it (and releases its hold) if it's late
    if (o && (await reconcileOrder(o))) paid++;
  }
  // Older unpaid orders: just make sure their holds are released.
  const stale = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(inArray(schema.orders.status, ["awaiting_payment"]), lt(schema.orders.createdAt, since)));
  for (const { id } of stale) await findOrder(id);
  return { checked: rows.length, paid, expired: stale.length };
}

/**
 * Routine clean-up and data retention (Individual Privacy Act 2075: keep personal data
 * only as long as needed). Addresses and receiver contacts are removed from orders that
 * finished more than 18 months ago; the sale itself stays for the accounts.
 */
export async function cleanup() {
  const db = await getDb();
  const now = Date.now();
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
  await db.delete(schema.otps).where(lt(schema.otps.expiresAt, now - 3600_000));
  await pruneLimits();
  await db.delete(schema.restockAlerts).where(and(isNotNull(schema.restockAlerts.notifiedAt), lt(schema.restockAlerts.notifiedAt, new Date(now - 90 * 86_400_000).toISOString())));

  const cutoff = new Date(now - 548 * 86_400_000).toISOString();
  const old = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(inArray(schema.orders.status, ["completed", "cancelled", "expired"]), lt(schema.orders.createdAt, cutoff), sql`not (${schema.orders.data} ? 'scrubbedAt')`))
    .limit(200);
  for (const { id } of old) {
    await lockOrder(id, async (o) => {
      delete o.address;
      if (o.gift) {
        o.gift.receiverPhone = null;
        o.gift.receiverEmail = null;
        if (o.gift.receiver) delete o.gift.receiver.address;
      }
      delete o.rider;
      (o as Order & { scrubbedAt?: string }).scrubbedAt = new Date().toISOString();
      return { save: true, result: null };
    });
  }
  return { scrubbed: old.length };
}
