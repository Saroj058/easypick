import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { allDrops, allProducts } from "./catalogue";
import { getDb, schema } from "./db";
import { addDays, ktmDay, ktmMidnight, ktmStamp } from "./ktm-day";
import { paidOrdersBetween, refundedQty, type Order } from "./orders";
import { effectiveStatus } from "./store";

// Sales numbers for the owner, worked out from paid orders (paid_at set: an order cancelled
// before payment never counts). Days are Kathmandu calendar days. Gift card purchases aren't
// sales (the money becomes a sale when the card is spent), so they're counted on their own;
// a gift the receiver turned into a card counts the same way.

const refundTotal = (o: Order) => (o.refunds ?? []).reduce((n, r) => n + r.amount, 0);

/** A gift whose receiver took a gift card instead of the clothes. */
export const convertedGift = (o: Order) => o.gift?.status === "converted";

const goods = (o: Order) => o.kind !== "gift_card" && !convertedGift(o);

/** Goods value of an order net of refunds (what the customer bought, however they paid). */
export const netSales = (o: Order) => (goods(o) ? o.subtotal + o.deliveryFee + (o.wrapFee ?? 0) - refundTotal(o) : 0);

/** Gift card value this order sold: a bought card, or a gift turned into a card of the clothes' value. */
export const cardSales = (o: Order) =>
  o.kind === "gift_card" ? Math.max(0, o.total - refundTotal(o)) : convertedGift(o) ? o.lines.reduce((n, l) => n + l.unitPrice * l.qty, 0) : 0;

/** Pieces the customer kept (bought, less refunded). */
export function piecesKept(o: Order) {
  if (!goods(o)) return 0;
  const done = refundedQty(o);
  return o.lines.reduce((n, l, i) => n + Math.max(0, l.qty - done[i]), 0);
}

/** Counts as an order in the numbers: clothes sold and not all of them refunded. */
export const countsAsOrder = (o: Order) => piecesKept(o) > 0;

/** The report window: the last `days` Kathmandu calendar days, today included. */
export function reportWindow(days: number, now = Date.now()) {
  const today = ktmDay(now);
  return { today, since: ktmMidnight(addDays(today, -(days - 1))), until: ktmMidnight(addDays(today, 1)) };
}

/** Pieces kept per product, all time (for drop sell-through), counted in the database. */
async function soldAllTime(): Promise<Map<string, number>> {
  const db = await getDb();
  const o = schema.orders;
  const ol = schema.orderLines;
  const goodsSql = and(isNotNull(o.paidAt), eq(o.kind, "goods"), sql`coalesce(${o.data}->'gift'->>'status', '') <> 'converted'`);
  const [rows, refunded] = await Promise.all([
    db
      .select({ slug: ol.slug, n: sql<number>`sum(${ol.qty})::int` })
      .from(ol)
      .innerJoin(o, eq(o.id, ol.orderId))
      .where(goodsSql)
      .groupBy(ol.slug),
    db
      .select({ data: o.data })
      .from(o)
      .where(and(goodsSql, sql`jsonb_array_length(coalesce(${o.data}->'refunds', '[]'::jsonb)) > 0`)),
  ]);
  const sold = new Map(rows.map((r) => [r.slug, r.n]));
  for (const { data } of refunded) {
    const done = refundedQty(data);
    data.lines.forEach((l, i) => {
      if (done[i]) sold.set(l.slug, (sold.get(l.slug) ?? 0) - Math.min(done[i], l.qty));
    });
  }
  return sold;
}

export async function salesReport(days = 30, now = Date.now()) {
  const { today, since, until } = reportWindow(days, now);
  const [recent, soldAll, products, drops] = await Promise.all([paidOrdersBetween(since, until), soldAllTime(), allProducts(), allDrops()]);

  // Day by day (Kathmandu), newest first, including days with no sales.
  const byDay = new Map<string, { sales: number; orders: number; pieces: number; cards: number }>();
  for (let i = 0; i < days; i++) byDay.set(addDays(today, -i), { sales: 0, orders: 0, pieces: 0, cards: 0 });
  for (const o of recent) {
    const d = byDay.get(ktmDay(o.paidAt!));
    if (!d) continue;
    d.cards += cardSales(o);
    d.sales += netSales(o);
    d.pieces += piecesKept(o);
    if (countsAsOrder(o)) d.orders += 1;
  }

  // Pieces sold per product in the period.
  const soldRecent = new Map<string, number>();
  const salesBySlug = new Map<string, number>();
  for (const o of recent) {
    if (!goods(o)) continue;
    const done = refundedQty(o);
    o.lines.forEach((l, i) => {
      const n = l.qty - done[i];
      if (n <= 0) return;
      soldRecent.set(l.slug, (soldRecent.get(l.slug) ?? 0) + n);
      salesBySlug.set(l.slug, (salesBySlug.get(l.slug) ?? 0) + n * l.unitPrice);
    });
  }

  const stockOf = (slug: string) => products.find((p) => p.slug === slug)?.variants.reduce((n, v) => n + v.stock, 0) ?? 0;
  const top = products
    .map((p) => ({ slug: p.slug, name: p.name, sold: soldRecent.get(p.slug) ?? 0, sales: salesBySlug.get(p.slug) ?? 0, left: stockOf(p.slug) }))
    .filter((r) => r.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 10);
  const slow = products
    .filter((p) => effectiveStatus(p, drops, now) === "live" && !soldRecent.get(p.slug))
    .map((p) => ({ slug: p.slug, name: p.name, left: stockOf(p.slug) }))
    .filter((r) => r.left > 0)
    .sort((a, b) => b.left - a.left);

  const dropRows = [...drops]
    .sort((a, b) => Date.parse(b.releaseAt) - Date.parse(a.releaseAt))
    .map((d) => {
      const pieces = products.filter((p) => p.dropSlug === d.slug);
      const sold = pieces.reduce((n, p) => n + Math.max(0, soldAll.get(p.slug) ?? 0), 0);
      const left = pieces.reduce((n, p) => n + stockOf(p.slug), 0);
      return { slug: d.slug, name: d.name, releaseAt: d.releaseAt, sold, left, rate: sold + left ? sold / (sold + left) : 0 };
    });

  const rows = [...byDay].map(([day, v]) => ({ day, ...v }));
  const totals = rows.reduce((t, r) => ({ sales: t.sales + r.sales, orders: t.orders + r.orders, pieces: t.pieces + r.pieces, cards: t.cards + r.cards }), { sales: 0, orders: 0, pieces: 0, cards: 0 });
  return { days, rows, totals, top, slow, drops: dropRows };
}

/** One CSV cell. Text that a spreadsheet would run as a formula (= + - @, tab, CR) gets a leading '. */
export const csvCell = (v: string | number | null | undefined) => {
  let s = v == null ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every paid order in the period as CSV, for the accountant. Starts with a BOM so Excel reads it as UTF-8. */
export async function ordersCsv(days = 30, now = Date.now()) {
  const { since, until } = reportWindow(days, now);
  const orders = (await paidOrdersBetween(since, until)).reverse();
  const head = ["number", "paid_at", "status", "kind", "method", "provider", "pieces", "subtotal", "delivery", "gift_box", "gift_card_used", "paid_by_wallet", "refunded", "net_sales", "gift_card_sold", "wallet_ref"];
  const lines = orders.map((o) => {
    const done = refundedQty(o);
    return [
      o.number,
      ktmStamp(o.paidAt!),
      o.status,
      o.kind === "gift_card" ? "gift_card" : convertedGift(o) ? "gift_to_card" : "goods",
      o.method,
      o.provider,
      goods(o)
        ? o.lines
            .map((l, i) => ({ l, n: l.qty - done[i] }))
            .filter((x) => x.n > 0)
            .map((x) => `${x.n}x ${x.l.sku}`)
            .join(" ")
        : "",
      o.subtotal,
      o.deliveryFee,
      o.wrapFee ?? 0,
      o.giftCard?.applied ?? 0,
      o.total,
      refundTotal(o),
      netSales(o),
      cardSales(o),
      o.payment?.gatewayRef ?? "",
    ]
      .map(csvCell)
      .join(",");
  });
  return "\uFEFF" + [head.join(","), ...lines].join("\n");
}
