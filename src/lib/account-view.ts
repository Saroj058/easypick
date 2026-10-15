// The account dashboard's choices, kept pure so they're unit-tested (test/account-view.test.ts):
// which order needs the customer now, how a gift's progress reads, their usual size, and a few
// pieces picked for them. Planned with ten reviewers (15 Oct 2026): structure, orders, gifts,
// personalisation, design, phones, data and security, engagement, settings, and a critic.

import { sellable } from "./inventory";
import type { Order } from "./orders";
import { giftable, recommend } from "./pick/recommend";
import type { Product, Size } from "./types";

const LIVE: Order["status"][] = ["paid", "ready_for_pickup", "out_for_delivery"];

/** The one order that needs them now: unpaid and still open, ready, on its way, or being packed. */
export function nowOrder(orders: Order[], now = Date.now()): Order | null {
  const goods = orders.filter((o) => o.kind !== "gift_card" && !o.gift);
  const unpaid = goods.find((o) => o.status === "awaiting_payment" && Date.parse(o.expiresAt) > now);
  if (unpaid) return unpaid;
  const order: Order["status"][] = ["ready_for_pickup", "out_for_delivery", "paid"];
  for (const st of order) {
    const o = goods.find((x) => x.status === st);
    if (o) return o;
  }
  return null;
}

/** Orders worth listing: paid ones (not gifts, which have their own list), newest first. */
export function pastOrders(orders: Order[], skip?: string): Order[] {
  return orders.filter((o) => o.id !== skip && !o.gift && (LIVE.includes(o.status) || o.status === "completed" || (o.status === "cancelled" && o.paidAt)));
}

/** Gifts they sent (paid), newest first. */
export function giftsSent(orders: Order[]): Order[] {
  return orders.filter((o) => o.gift && o.status !== "awaiting_payment" && o.status !== "expired" && !(o.status === "cancelled" && !o.paidAt));
}

/** One calm word for where a gift is. */
export function giftStage(o: Order): string {
  const g = o.gift!;
  if (o.status === "cancelled") return "Cancelled";
  if (g.status === "converted") return "Turned into a gift card";
  if (g.status === "delivered" || o.status === "completed") return "Delivered";
  if (g.status === "chosen") return g.receiver?.tryInStore ? "Trying it on in store" : "Size chosen";
  if (g.status === "opened") return "Opened";
  if (g.pendingSend && g.deliverOn) return `Sends on ${g.deliverOn}`;
  return "Sent";
}

/** A short status for an order, and whether it's the moment to act (the lime dot). */
export function orderStage(o: Order): { label: string; act: boolean } {
  switch (o.status) {
    case "awaiting_payment":
      return { label: "Waiting for payment", act: true };
    case "paid":
      return { label: o.packedAt ? "Packed" : "Being packed", act: false };
    case "ready_for_pickup":
      return { label: "Ready for pickup", act: true };
    case "out_for_delivery":
      return { label: "On its way", act: true };
    case "completed":
      return { label: o.method === "pickup" ? "Picked up" : "Delivered", act: false };
    case "cancelled":
      return { label: "Cancelled", act: false };
    default:
      return { label: "Expired", act: false };
  }
}

/** The size they buy most (one-size pieces don't count). */
export function usualSize(orders: Order[]): Size | null {
  const counts = new Map<Size, number>();
  for (const o of orders) {
    if (!o.paidAt) continue;
    for (const l of o.lines) if (l.size !== "ONE") counts.set(l.size, (counts.get(l.size) ?? 0) + l.qty);
  }
  let best: Size | null = null;
  let n = 0;
  for (const [s, c] of counts) if (c > n) [best, n] = [s, c];
  return best;
}

/** Up to `count` pieces for them: in stock in their usual size (or one size), not bought before. */
export function picksFor(products: Product[], orders: Order[], count = 6): Product[] {
  const bought = new Set(orders.filter((o) => o.paidAt).flatMap((o) => o.lines.map((l) => l.slug)));
  const size = usualSize(orders);
  const pool = giftable(products).filter((p) => !bought.has(p.slug) && (!size || p.variants.every((v) => v.size === "ONE") || p.variants.some((v) => v.size === size && sellable(v) > 0)));
  const { cards } = recommend(pool, size ? { sizing: "known", size } : { sizing: "unknown" }, count);
  return cards.map((c) => pool.find((p) => p.slug === c.slug)!).filter(Boolean);
}
