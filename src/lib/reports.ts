import "server-only";

import { allDrops, allProducts } from "./catalogue";
import { paidOrders, refundedQty, type Order } from "./orders";
import { site } from "./site";

// Sales numbers for the owner, worked out from paid orders. Gift card purchases aren't sales
// (the money becomes a sale when the card is spent), so they're counted on their own.

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: site.timezone });

const refundTotal = (o: Order) => (o.refunds ?? []).reduce((n, r) => n + r.amount, 0);

/** Goods value of an order net of refunds (what the customer bought, however they paid). */
export const netSales = (o: Order) => (o.kind === "gift_card" ? 0 : o.subtotal + o.deliveryFee + (o.wrapFee ?? 0) - refundTotal(o));

export async function salesReport(days = 30) {
  const [orders, products, drops] = await Promise.all([paidOrders(), allProducts(), allDrops()]);
  const since = Date.now() - days * 86_400_000;
  const recent = orders.filter((o) => Date.parse(o.paidAt ?? o.createdAt) >= since);

  // Day by day (Kathmandu), newest first, including days with no sales.
  const byDay = new Map<string, { sales: number; orders: number; pieces: number; cards: number }>();
  for (let i = 0; i < days; i++) byDay.set(dayKey.format(new Date(Date.now() - i * 86_400_000)), { sales: 0, orders: 0, pieces: 0, cards: 0 });
  for (const o of recent) {
    const d = byDay.get(dayKey.format(new Date(o.paidAt ?? o.createdAt)));
    if (!d) continue;
    if (o.kind === "gift_card") {
      d.cards += o.total;
      continue;
    }
    const done = refundedQty(o);
    d.sales += netSales(o);
    d.orders += 1;
    d.pieces += o.lines.reduce((n, l, i) => n + l.qty - done[i], 0);
  }

  // Pieces sold per product (all time and in the period).
  const soldAll = new Map<string, number>();
  const soldRecent = new Map<string, number>();
  const salesBySlug = new Map<string, number>();
  for (const o of orders) {
    if (o.kind === "gift_card") continue;
    const done = refundedQty(o);
    const inPeriod = Date.parse(o.paidAt ?? o.createdAt) >= since;
    o.lines.forEach((l, i) => {
      const n = l.qty - done[i];
      if (n <= 0) return;
      soldAll.set(l.slug, (soldAll.get(l.slug) ?? 0) + n);
      if (inPeriod) {
        soldRecent.set(l.slug, (soldRecent.get(l.slug) ?? 0) + n);
        salesBySlug.set(l.slug, (salesBySlug.get(l.slug) ?? 0) + n * l.unitPrice);
      }
    });
  }

  const stockOf = (slug: string) => products.find((p) => p.slug === slug)?.variants.reduce((n, v) => n + v.stock, 0) ?? 0;
  const top = products
    .map((p) => ({ slug: p.slug, name: p.name, sold: soldRecent.get(p.slug) ?? 0, sales: salesBySlug.get(p.slug) ?? 0, left: stockOf(p.slug) }))
    .filter((r) => r.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 10);
  const slow = products
    .filter((p) => p.status === "live" && !soldRecent.get(p.slug))
    .map((p) => ({ slug: p.slug, name: p.name, left: stockOf(p.slug) }))
    .filter((r) => r.left > 0)
    .sort((a, b) => b.left - a.left);

  const dropRows = [...drops]
    .sort((a, b) => Date.parse(b.releaseAt) - Date.parse(a.releaseAt))
    .map((d) => {
      const pieces = products.filter((p) => p.dropSlug === d.slug);
      const sold = pieces.reduce((n, p) => n + (soldAll.get(p.slug) ?? 0), 0);
      const left = pieces.reduce((n, p) => n + stockOf(p.slug), 0);
      return { slug: d.slug, name: d.name, releaseAt: d.releaseAt, sold, left, rate: sold + left ? sold / (sold + left) : 0 };
    });

  const rows = [...byDay].map(([day, v]) => ({ day, ...v }));
  const totals = rows.reduce((t, r) => ({ sales: t.sales + r.sales, orders: t.orders + r.orders, pieces: t.pieces + r.pieces, cards: t.cards + r.cards }), { sales: 0, orders: 0, pieces: 0, cards: 0 });
  return { days, rows, totals, top, slow, drops: dropRows };
}

const cell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every paid order in the period as CSV, for the accountant. */
export async function ordersCsv(days = 30) {
  const since = Date.now() - days * 86_400_000;
  const orders = (await paidOrders()).filter((o) => Date.parse(o.paidAt ?? o.createdAt) >= since).reverse();
  const head = ["number", "paid_at", "status", "kind", "method", "provider", "pieces", "subtotal", "delivery", "gift_box", "gift_card_used", "paid_by_wallet", "refunded", "net_sales", "wallet_ref"];
  const lines = orders.map((o) =>
    [
      o.number,
      o.paidAt ?? o.createdAt,
      o.status,
      o.kind ?? "goods",
      o.method,
      o.provider,
      o.lines.map((l) => `${l.qty}x ${l.sku}`).join(" "),
      o.subtotal,
      o.deliveryFee,
      o.wrapFee ?? 0,
      o.giftCard?.applied ?? 0,
      o.total,
      refundTotal(o),
      netSales(o),
      o.payment?.gatewayRef ?? "",
    ]
      .map(cell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n");
}
