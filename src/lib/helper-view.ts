import { formatBS } from "./nepali-date";
import { refundedQty, type Order, type OrderEvent, type OrderLine } from "./orders";

// What the counter needs to see of an order: the pieces still to go out, gift dates,
// and fulfilment history. No money: refunds, payments and payment problems stay with
// the owner.

/** Event texts a helper may see (fulfilment and exchanges). Anything else is hidden. */
const HELPER_EVENTS = [
  "Order placed",
  "Packed",
  "Ready at the counter",
  "Out for delivery",
  "Collected",
  "Delivered",
  "Exchanged ",
  "Chose ",
  "Will try it on in the store",
  "Expired",
  "Cancelled before payment",
];

/** The order's history for a helper: fulfilment steps only, no refunds or payment details. */
export function helperEvents(events: OrderEvent[] | undefined): OrderEvent[] {
  return (events ?? []).flatMap((e) => {
    if (HELPER_EVENTS.some((p) => e.what === p.trim() || e.what.startsWith(p))) return [e];
    // A sold-out gift turned into a gift card: say so, but not the card's code.
    if (e.what.startsWith("Turned into gift card")) return [{ ...e, what: "Turned into a gift card (nothing to pack)" }];
    return [];
  });
}

/** Attention notes often name amounts, refs or refunds; helpers get a plain pointer instead. */
export const HELPER_ATTENTION = "Payment or stock issue. Ask the owner before packing.";

/** A line with how many pieces still go out (after refunds). */
export type PackLine = OrderLine & { toPack: number; refunded: number };

/** Lines still to hand over: qty minus refunded; fully refunded lines are left out. */
export function packLines(o: Order): PackLine[] {
  const done = refundedQty(o);
  return o.lines.flatMap((l, i) => {
    const toPack = Math.max(0, l.qty - (done[i] ?? 0));
    return toPack > 0 ? [{ ...l, toPack, refunded: done[i] ?? 0 }] : [];
  });
}

const ktmDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" });
const niceDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", weekday: "short", day: "numeric", month: "short" });

/**
 * "Deliver on Sat 3 Oct (Asoj 17)" for a gift with a date, and whether that day is still
 * ahead (so it isn't sent early). Dates are Kathmandu calendar days.
 */
export function deliverOnText(o: Order, now = new Date()): { text: string; future: boolean } | null {
  const d = o.gift?.deliverOn;
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  // Midday in Kathmandu, so the day never slips.
  const at = new Date(`${d}T12:00:00+05:45`);
  if (Number.isNaN(at.getTime())) return null;
  return { text: `Deliver on ${niceDay.format(at)} (${formatBS(at)})`, future: d > ktmDay.format(now) };
}
