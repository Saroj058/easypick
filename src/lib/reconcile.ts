import "server-only";

import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { alertStaff } from "./alerts";
import { getDb, schema } from "./db";
import { formatPrice } from "./format";
import { esewaStatus } from "./gateways";
import { findOrder, lockOrder, type Order, type PaymentAttempt } from "./orders";
import { confirmPayment } from "./payments";
import { pruneLimits } from "./rate-limit";
import { site } from "./site";

// Catching payments the customer didn't come back from (closed the tab, lost signal),
// and routine tidying. Runs from /api/cron every few minutes, and for a single order
// when its page is opened.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** How long after an attempt starts we keep asking the wallet about it. */
export const RECONCILE_WINDOW_MS = 7 * 24 * HOUR;
/** eSewa's answers that won't change once its payment session is over (it lasts well under an hour). */
const FINAL = new Set(["CANCELED", "NOT_FOUND", "FULL_REFUND", "PARTIAL_REFUND"]);
/** Still in progress at eSewa: staff hear about it once it's been like this for 30 minutes. */
const STUCK = new Set(["PENDING", "AMBIGUOUS"]);

export const attemptsOf = (o: Order): PaymentAttempt[] => o.payments ?? (o.payment ? [o.payment] : []);

/** Orders whose money may still turn up: unpaid, expired, or cancelled before any payment. */
export const mayStillBePaid = (o: Order) => o.status === "awaiting_payment" || o.status === "expired" || (o.status === "cancelled" && !o.paidAt);

/** Often at first, then less: every run for the first hour, half-hourly for a day, then every 6 hours. */
function backoff(ageMs: number) {
  return ageMs < HOUR ? 0 : ageMs < 24 * HOUR ? 30 * MINUTE : 6 * HOUR;
}

/** Whether this attempt should be checked with the wallet now. */
export function checkDue(a: PaymentAttempt, now: number, minGapMs = 0): boolean {
  if (a.provider !== "esewa" || a.verifiedAt) return false;
  const started = Date.parse(a.startedAt);
  if (!(now - started <= RECONCILE_WINDOW_MS)) return false;
  if (a.lastStatus === "AMOUNT_MISMATCH") return false; // staff were told; a person sorts it out
  const last = a.lastCheckedAt ? Date.parse(a.lastCheckedAt) : 0;
  // A cancelled or unknown payment seen after eSewa's session ended is over for good.
  if (a.lastStatus && FINAL.has(a.lastStatus) && last - started > HOUR) return false;
  return now - last >= Math.max(minGapMs, backoff(now - started));
}

/**
 * Asks eSewa about an unpaid (or expired, or cancelled-before-payment) order's payment attempts.
 * True if one turned out paid. Every attempt asked about is stamped (lastCheckedAt, lastStatus),
 * which spaces out the next checks.
 *
 * limit / timeoutMs / minGapMs keep the order page fast: it asks about the newest attempt or two,
 * briefly, and at most every 30 seconds.
 */
export async function reconcileOrder(order: Order, opts: { limit?: number; timeoutMs?: number; minGapMs?: number } = {}): Promise<boolean> {
  if (!mayStillBePaid(order)) return false;
  const now = Date.now();
  const due = [...attemptsOf(order)]
    .reverse()
    .filter((a) => checkDue(a, now, opts.minGapMs))
    .slice(0, opts.limit ?? 10);
  if (!due.length) return false;

  const seen = new Map<string, string>();
  let paid = false;
  for (const a of due) {
    try {
      const r = await esewaStatus(a.ref, order.total, opts.timeoutMs);
      if (!r.ok) {
        seen.set(a.ref, r.status ?? r.code);
      } else if (Math.abs(r.amount - order.total) < 0.001) {
        // Keep going after a paid one: a second paid attempt is flagged as paid twice.
        await confirmPayment(order.id, { provider: "esewa", ref: a.ref, gatewayRef: r.gatewayRef, amount: r.amount });
        paid = true;
      } else {
        seen.set(a.ref, "AMOUNT_MISMATCH");
        const got = r.amount;
        await alertStaff(
          `Amount mismatch on ${order.number}`,
          `eSewa confirmed ${formatPrice(got)} (ref ${r.gatewayRef}) for ${order.number}, but the order total is ${formatPrice(order.total)}. The order was NOT marked paid. Check it in the eSewa portal and refund or collect the difference.\n\n${site.url}/admin/orders/${order.id}`,
        );
      }
    } catch (e) {
      console.error("[reconcile] eSewa check failed", order.number, e);
      seen.set(a.ref, "UNREACHABLE");
    }
  }

  // Stamp what we learned, and tell staff (once) about a payment stuck half-way at eSewa.
  if (seen.size) {
    const stuck = await lockOrder(order.id, async (o) => {
      const at = new Date().toISOString();
      const stuckRefs: string[] = [];
      for (const a of attemptsOf(o)) {
        const status = seen.get(a.ref);
        if (!status || a.verifiedAt) continue;
        a.lastCheckedAt = at;
        a.lastStatus = status;
        if (STUCK.has(status) && Date.now() - Date.parse(a.startedAt) > 30 * MINUTE && !a.alertedAt) {
          a.alertedAt = at;
          stuckRefs.push(a.ref);
        }
      }
      // o.payment is its own copy of the latest attempt once saved: keep it in step.
      if (o.payment) o.payment = attemptsOf(o).find((a) => a.ref === o.payment!.ref) ?? o.payment;
      return { save: true, result: stuckRefs.length ? { o, stuckRefs } : null };
    });
    if (stuck) {
      await alertStaff(
        `Payment stuck at eSewa: ${stuck.o.number}`,
        `eSewa still says the payment for ${stuck.o.number} (${formatPrice(stuck.o.total)}) is pending, more than 30 minutes after it started (ref ${stuck.stuckRefs.join(", ")}). The order is ${stuck.o.status.replace(/_/g, " ")}. We keep checking; if eSewa confirms it, the order is taken as paid (or flagged if it can't be). Check the eSewa portal if the customer calls.\n\n${site.url}/admin/orders/${stuck.o.id}`,
      );
    }
  }
  return paid;
}

/**
 * The cron's job: release holds on unpaid orders past their 15 minutes, then ask the wallet
 * about unconfirmed payment attempts from the last 7 days (spaced out, see checkDue). One order
 * failing never stops the others. Stops early when the time budget is used up; the rest wait
 * for the next run.
 */
export async function reconcileRecent({ limit = 50, budgetMs = 40_000 }: { limit?: number; budgetMs?: number } = {}) {
  const started = Date.now();
  const db = await getDb();
  const errors: string[] = [];

  // 1. Late unpaid orders: expire them, which gives their pieces and card money back.
  const late = await db
    .select({ id: schema.orders.id, number: schema.orders.number })
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "awaiting_payment"), sql`(${schema.orders.data}->>'expiresAt')::timestamptz < now()`))
    .limit(500);
  let expired = 0;
  for (const { id, number } of late) {
    try {
      if ((await findOrder(id))?.status === "expired") expired++;
    } catch (e) {
      console.error("[reconcile] expiring failed", number, e);
      errors.push(`${number}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. Payment attempts nobody came back from.
  const since = new Date(Date.now() - RECONCILE_WINDOW_MS).toISOString();
  const rows = await db
    .select({ data: schema.orders.data })
    .from(schema.orders)
    .where(
      and(
        inArray(schema.orders.status, ["awaiting_payment", "expired", "cancelled"]),
        isNull(schema.orders.paidAt),
        gt(schema.orders.createdAt, since),
        sql`(${schema.orders.data} ? 'payments' or ${schema.orders.data} ? 'payment')`,
      ),
    )
    .orderBy(desc(schema.orders.createdAt))
    .limit(1000);
  const now = Date.now();
  const due = rows.map((r) => r.data).filter((o) => mayStillBePaid(o) && attemptsOf(o).some((a) => checkDue(a, now)));
  let checked = 0;
  let paid = 0;
  for (const o of due.slice(0, limit)) {
    if (Date.now() - started > budgetMs) break;
    try {
      checked++;
      if (await reconcileOrder(o)) paid++;
    } catch (e) {
      console.error("[reconcile] order failed", o.number, e);
      errors.push(`${o.number}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { expired, checked, paid, waiting: Math.max(0, due.length - checked), errors };
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
    await lockOrder(id, async (o) => {      delete o.address;
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
