import "server-only";

import { and, gte, isNotNull, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { getDb, schema } from "./db";
import { getDrops, getProducts } from "./store";
import type { Product } from "./types";

// Trending: what people are really buying and wanting this week, never picked by hand
// or made up. Until there's enough real data (50 paid orders, or four weeks of signals),
// the page shows the owner's Staff picks instead, and says so.

/** Points per signal. Starting values; adjust once real data comes in. */
export const WEIGHTS = { order: 5, bag: 2, save: 1, restock: 2, view: 0.1 } as const;
const WINDOW_DAYS = 7;
/** A piece needs at least this many paid orders in the week, so one sale can't make a trend. */
export const MIN_ORDERS = 3;
const TOP = 12;
/** Real Trending switches on after this many paid orders overall, or four weeks of signals. */
const ENOUGH_ORDERS = 50;
const ENOUGH_DAYS = 28;

export interface Signals {
  orders: number;
  bag: number;
  save: number;
  restock: number;
  view: number;
}

export interface TrendingItem {
  product: Product;
  rank: number;
  score: number;
  signals: Signals;
  /** A short, true reason to show, e.g. "Bought 9 times this week". */
  reason: string;
}

export type TrendingResult =
  | { mode: "trending"; from: string; to: string; items: TrendingItem[] }
  | { mode: "picks"; label: "Staff picks" | "From the latest drop"; items: { product: Product }[]; why: string };

export const scoreOf = (s: Signals) => s.orders * WEIGHTS.order + s.bag * WEIGHTS.bag + s.save * WEIGHTS.save + s.restock * WEIGHTS.restock + s.view * WEIGHTS.view;

function reasonFor(s: Signals, rank: number, mostBought: boolean): string {
  if (mostBought) return "Most bought this week";
  if (s.restock >= 3) return `${s.restock} people asked for a restock`;
  if (rank <= 12) return `Bought ${s.orders} times this week`;
  return "";
}

/** The raw weekly signals per product slug (orders from paid orders; the rest from events). */
async function weeklySignals(since: Date): Promise<Map<string, Signals>> {
  const db = await getDb();
  const map = new Map<string, Signals>();
  const get = (slug: string) => {
    let s = map.get(slug);
    if (!s) map.set(slug, (s = { orders: 0, bag: 0, save: 0, restock: 0, view: 0 }));
    return s;
  };
  const events = await db
    .select({ slug: schema.productEvents.productSlug, kind: schema.productEvents.kind, n: sql<number>`count(*)::int` })
    .from(schema.productEvents)
    .where(gte(schema.productEvents.at, since.toISOString()))
    .groupBy(schema.productEvents.productSlug, schema.productEvents.kind);
  for (const e of events) get(e.slug)[e.kind as keyof Omit<Signals, "orders">] += e.n;

  // One order counts once per product, however many pieces of it were in the order.
  const orders = await db
    .select({ slug: schema.orderLines.slug, n: sql<number>`count(distinct ${schema.orderLines.orderId})::int` })
    .from(schema.orderLines)
    .innerJoin(schema.orders, sql`${schema.orders.id} = ${schema.orderLines.orderId}`)
    .where(and(isNotNull(schema.orders.paidAt), gte(schema.orders.paidAt, since.toISOString()), sql`${schema.orders.status} <> 'cancelled'`, sql`coalesce(${schema.orders.data}->>'kind','goods') = 'goods'`))
    .groupBy(schema.orderLines.slug);
  for (const o of orders) get(o.slug).orders += o.n;
  return map;
}

/** Enough history for a real ranking: 50 paid orders overall, or signals going back four weeks. */
async function enoughData(): Promise<boolean> {
  const db = await getDb();
  const [{ paid }] = await db.select({ paid: sql<number>`count(*)::int` }).from(schema.orders).where(isNotNull(schema.orders.paidAt));
  if (paid >= ENOUGH_ORDERS) return true;
  const [{ first }] = await db.select({ first: sql<string | null>`min(${schema.productEvents.at})` }).from(schema.productEvents);
  return Boolean(first && Date.now() - Date.parse(first) >= ENOUGH_DAYS * 86_400_000);
}

async function compute(): Promise<TrendingResult> {
  const now = Date.now();
  const since = new Date(now - WINDOW_DAYS * 86_400_000);
  const [products, drops, signals, enough] = await Promise.all([getProducts(), getDrops(), weeklySignals(since), enoughData()]);
  const shown = products.filter((p) => !p.hideFromTrending && (p.status === "live" || p.status === "sold_out"));

  if (enough) {
    const ranked = shown
      .map((product) => ({ product, signals: signals.get(product.slug) }))
      .filter((x): x is { product: Product; signals: Signals } => Boolean(x.signals && x.signals.orders >= MIN_ORDERS))
      .map((x) => ({ ...x, score: Math.round(scoreOf(x.signals) * 10) / 10 }))
      .sort((a, b) => b.score - a.score || b.signals.orders - a.signals.orders)
      .slice(0, TOP);
    if (ranked.length >= 3) {
      const topOrders = Math.max(...ranked.map((r) => r.signals.orders));
      return {
        mode: "trending",
        from: since.toISOString(),
        to: new Date(now).toISOString(),
        items: ranked.map((r, i) => ({ ...r, rank: i + 1, reason: reasonFor(r.signals, i + 1, r.signals.orders === topOrders && i === ranked.findIndex((x) => x.signals.orders === topOrders)) })),
      };
    }
  }

  // Not enough real data yet: the owner's picks, labelled honestly.
  const picks = shown.filter((p) => p.staffPick && p.status === "live").slice(0, TOP);
  if (picks.length) return { mode: "picks", label: "Staff picks", items: picks.map((product) => ({ product })), why: "Chosen by the Easypick team while real Trending builds up." };
  const latest = [...drops].filter((d) => Date.parse(d.releaseAt) <= now).sort((a, b) => Date.parse(b.releaseAt) - Date.parse(a.releaseAt))[0];
  const fromDrop = shown.filter((p) => p.status === "live" && latest && p.dropSlug === latest.slug).slice(0, TOP);
  return { mode: "picks", label: "From the latest drop", items: fromDrop.map((product) => ({ product })), why: "Trending starts once enough people have shopped this week." };
}

/** Recomputed at most once an hour (and when the owner changes picks), so the page stays fast. */
export const getTrending = unstable_cache(compute, ["trending-v1"], { tags: ["trending"], revalidate: 3600 });

/** For the admin: the full ranking with every product's signals, uncached. */
export async function trendingForAdmin() {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const [products, signals, enough] = await Promise.all([getProducts(), weeklySignals(since), enoughData()]);
  const rows = products
    .map((p) => ({ product: p, signals: signals.get(p.slug) ?? { orders: 0, bag: 0, save: 0, restock: 0, view: 0 } }))
    .map((r) => ({ ...r, score: Math.round(scoreOf(r.signals) * 10) / 10, eligible: r.signals.orders >= MIN_ORDERS && !r.product.hideFromTrending }))
    .filter((r) => r.score > 0 || r.product.staffPick || r.product.hideFromTrending)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
  return { enough, rows, live: await getTrending() };
}
