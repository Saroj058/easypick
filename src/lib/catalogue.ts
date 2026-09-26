import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { after } from "next/server";

import { getDb, productRows, schema, type DB, type Exec, type Festival, type RestockAlert } from "./db";
import { giftEmailHtml } from "./email";
import { cameBackInStock, sellable } from "./inventory";
import { isoTime } from "./iso-time";
import { notifyEmail, notifySms } from "./notify";
import { effectiveStatus } from "./product-status";
import { site } from "./site";
import type { Drop, Product, ProductStatus, Size } from "./types";

// The catalogue in the database: products (one row each) and their colour/size
// variants (one row each, holding stock). Used by the website, the admin screen,
// paid orders taking stock off the rack, and "tell me when my size is back".

/** Products with their variants, in display order. */
export async function loadProducts(db: DB, slugs?: string[]): Promise<Product[]> {
  const rows = await db
    .select()
    .from(schema.products)
    .where(slugs ? inArray(schema.products.slug, slugs) : undefined)
    .orderBy(asc(schema.products.position), asc(schema.products.slug));
  if (!rows.length) return [];
  const vs = await db
    .select()
    .from(schema.variants)
    .where(
      inArray(
        schema.variants.productSlug,
        rows.map((r) => r.slug),
      ),
    )
    .orderBy(asc(schema.variants.position));
  return rows.map((r) => ({
    ...r.data,
    slug: r.slug,
    status: r.status,
    variants: vs
      .filter((v) => v.productSlug === r.slug)
      .map((v) => ({ sku: v.sku, size: v.size, colour: v.colour, stock: v.stock, ...(v.lastPieceOnFloor && { lastPieceOnFloor: true }) })),
  }));
}

/** Every product, including drafts and archived ones (the website only shows public ones). */
export async function allProducts(): Promise<Product[]> {
  return loadProducts(await getDb());
}

export async function findProduct(slug: string): Promise<Product | null> {
  const [p] = await loadProducts(await getDb(), [slug]);
  return p ?? null;
}

export async function allDrops(): Promise<Drop[]> {
  const db = await getDb();
  const rows = await db.select().from(schema.drops).orderBy(asc(schema.drops.releaseAt));
  return rows.map((d) => ({ ...d, releaseAt: isoTime(d.releaseAt) }));
}

export async function createProduct(p: Product) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: sql<number>`coalesce(max(${schema.products.position}), -1) + 1` }).from(schema.products);
    const rows = productRows(p, Number(n));
    await tx.insert(schema.products).values(rows.product);
    if (rows.variants.length) await tx.insert(schema.variants).values(rows.variants);
  });
}

/** Change a product's details (not its stock: that's setStock). */
export async function updateProduct(slug: string, fn: (p: Product) => void) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.products).where(eq(schema.products.slug, slug)).for("update");
    if (!row) return null;
    const p: Product = { ...structuredClone(row.data), slug: row.slug, status: row.status, variants: [] };
    fn(p);
    const { product } = productRows(p, row.position);
    await tx
      .update(schema.products)
      .set({ status: product.status, data: product.data, updatedAt: new Date().toISOString() })
      .where(eq(schema.products.slug, slug));
    return p;
  });
}

// ---------- Stock (one ledger: every change is a row in stock_movements) ----------

export type StockReason =
  | "order_hold" // an order was placed: pieces are held while the customer pays
  | "order_release" // an unpaid order expired, or a hold was swapped
  | "received"
  | "count"
  | "damaged"
  | "returned"
  | "exchange_in"
  | "exchange_out"
  | "gift_swap"
  | "refund_restock";

export interface StockMeta {
  reason: StockReason;
  source: "web" | "admin" | "kiosk" | "rfid";
  ref?: string | null;
  actor?: string | null;
}

/** Thrown inside a transaction when a size doesn't have enough pieces; the whole transaction rolls back. */
export class StockShortError extends Error {
  constructor(
    public sku: string,
    public left: number,
  ) {
    super(`Only ${left} left of ${sku}`);
  }
}

/**
 * Changes stock for several SKUs in one go. Taking pieces (delta < 0) only succeeds if
 * enough are there; for online sales the last piece on the shop floor doesn't count.
 * Throws StockShortError (use inside a transaction so nothing half-happens).
 * Returns the SKUs that came back into online sale (for restock alerts).
 *
 * Moves for the same SKU are added together, and rows are locked in SKU order, so two
 * orders for the same sizes listed the other way round wait for each other instead of
 * deadlocking. A move can set its own `online` (e.g. a swap: take online, give back).
 */
export async function moveStock(
  exec: Exec,
  moves: { sku: string; delta: number; online?: boolean }[],
  meta: StockMeta,
  opts: { online?: boolean } = {},
): Promise<string[]> {
  const merged = new Map<string, { delta: number; online: boolean }>();
  for (const m of moves) {
    const cur = merged.get(m.sku) ?? { delta: 0, online: false };
    cur.delta += m.delta;
    // The floor rule only guards taking; if any taking move is online, the net take is.
    if (m.delta < 0 && (m.online ?? opts.online)) cur.online = true;
    merged.set(m.sku, cur);
  }
  // Plain code-unit order, the same as `collate "C"` below (SKUs are ASCII).
  const list = [...merged].filter(([, m]) => m.delta !== 0).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (!list.length) return [];

  // Lock every row first, in SKU order. This also gives the stock before the change.
  const locked = await exec
    .select({ sku: schema.variants.sku, stock: schema.variants.stock, floor: schema.variants.lastPieceOnFloor })
    .from(schema.variants)
    .where(inArray(schema.variants.sku, list.map(([sku]) => sku)))
    .orderBy(sql`${schema.variants.sku} collate "C"`)
    .for("update");
  const before = new Map(locked.map((v) => [v.sku, v]));

  const restocked: string[] = [];
  for (const [sku, m] of list) {
    const floorRule = m.online ? sql`case when ${schema.variants.lastPieceOnFloor} then 1 else 0 end` : sql`0`;
    const [row] = await exec
      .update(schema.variants)
      .set({
        stock: sql`${schema.variants.stock} + ${m.delta}`,
        // "The last piece is on the shop floor" only means something while exactly one is left.
        lastPieceOnFloor: sql`${schema.variants.lastPieceOnFloor} and ${schema.variants.stock} + ${m.delta} = 1`,
      })
      .where(m.delta < 0 ? and(eq(schema.variants.sku, sku), sql`${schema.variants.stock} - ${floorRule} + ${m.delta} >= 0`) : eq(schema.variants.sku, sku))
      .returning({ stock: schema.variants.stock, floor: schema.variants.lastPieceOnFloor });
    const was = before.get(sku);
    if (!row) throw new StockShortError(sku, was ? Math.max(0, was.stock - (m.online && was.floor ? 1 : 0)) : 0);
    if (was && cameBackInStock({ stock: was.stock, lastPieceOnFloor: was.floor }, { stock: row.stock, lastPieceOnFloor: row.floor })) restocked.push(sku);
    await exec.insert(schema.stockMovements).values({
      sku,
      delta: m.delta,
      reason: meta.reason,
      source: meta.source,
      ref: meta.ref ?? null,
      actor: meta.actor ?? null,
      stockAfter: row.stock,
    });
  }
  return restocked;
}

/**
 * Admin: change stock by + or − with a reason (never overwrites a sale that happened
 * meanwhile). Returns the SKUs that came back into stock, or the one that would go below zero.
 */
export async function adjustStockBy(
  slug: string,
  changes: Record<string, number>,
  meta: Omit<StockMeta, "source">,
): Promise<{ ok: true; restocked: string[] } | { ok: false; sku: string; left: number }> {
  const db = await getDb();
  try {
    const restocked = await db.transaction(async (tx) => {
      const own = new Set((await tx.select({ sku: schema.variants.sku }).from(schema.variants).where(eq(schema.variants.productSlug, slug))).map((r) => r.sku));
      const moves = Object.entries(changes)
        .filter(([sku, d]) => own.has(sku) && Number.isInteger(d) && d !== 0)
        .map(([sku, delta]) => ({ sku, delta }));
      return moveStock(tx, moves, { ...meta, source: "admin" });
    });
    return { ok: true, restocked };
  } catch (e) {
    if (e instanceof StockShortError) return { ok: false, sku: e.sku, left: e.left };
    throw e;
  }
}

/** Latest stock changes for a product, for the admin screen. */
export async function stockHistory(slug: string, limit = 30) {
  const db = await getDb();
  const rows = await db
    .select({
      sku: schema.stockMovements.sku,
      delta: schema.stockMovements.delta,
      reason: schema.stockMovements.reason,
      source: schema.stockMovements.source,
      ref: schema.stockMovements.ref,
      actor: schema.stockMovements.actor,
      stockAfter: schema.stockMovements.stockAfter,
      at: schema.stockMovements.at,
    })
    .from(schema.stockMovements)
    .innerJoin(schema.variants, eq(schema.variants.sku, schema.stockMovements.sku))
    .where(eq(schema.variants.productSlug, slug))
    .orderBy(desc(schema.stockMovements.at))
    .limit(limit);
  return rows.map((r) => ({ ...r, at: isoTime(r.at) }));
}

// ---------- Restock alerts ----------

export async function addRestockAlert(input: Omit<RestockAlert, "id" | "createdAt" | "notifiedAt">) {
  const db = await getDb();
  const who = input.email ? eq(schema.restockAlerts.email, input.email) : eq(schema.restockAlerts.phone, input.phone ?? "");
  const dupe = await db
    .select({ id: schema.restockAlerts.id })
    .from(schema.restockAlerts)
    .where(and(eq(schema.restockAlerts.sku, input.sku), isNull(schema.restockAlerts.notifiedAt), who));
  if (dupe.length) return;
  await db.insert(schema.restockAlerts).values({ ...input, id: randomUUID(), createdAt: new Date().toISOString(), notifiedAt: null });
}

/** Waiting requests per SKU, for the admin screen. */
export async function restockDemand(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ sku: schema.restockAlerts.sku, n: sql<number>`count(*)` })
    .from(schema.restockAlerts)
    .where(isNull(schema.restockAlerts.notifiedAt))
    .groupBy(schema.restockAlerts.sku);
  return Object.fromEntries(rows.map((r) => [r.sku, Number(r.n)]));
}

/** Messages sent at the same time when telling people their size is back. */
const SEND_AT_ONCE = 5;

async function tellRestocked(a: RestockAlert, name: string) {
  const url = `${site.url}/product/${a.slug}`;
  const what = `${name} in ${a.colour}, size ${a.size === "ONE" ? "one size" : a.size}`;
  await notifySms(a.phone, `Easypick: ${what} is back in stock. ${url}`);
  await notifyEmail(
    a.email,
    `${name} is back in your size`,
    giftEmailHtml({
      heading: "It's back.",
      intro: `${what} is back in stock. There aren't many, so if you still want it, now's the time.`,
      button: { label: "See it", url },
      small: "You asked us to tell you once. We won't email about this piece again.",
    }),
    `${what} is back in stock: ${url}`,
  );
}

/** Runs fn over items, at most `limit` at a time. One failure doesn't stop the rest. */
async function eachLimited<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const x = items[next++];
      try {
        await fn(x);
      } catch (e) {
        console.error("[restock] couldn't send a back-in-stock message", e);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Tells everyone waiting on these SKUs that they're back. Returns how many will be told.
 * Only sizes that can be bought online right now, of products on sale on the website, count;
 * the rest stay waiting. Requests are claimed first (so two restocks at the same moment never
 * message the same person twice), and the messages go out after the response.
 */
export async function notifyRestocked(skus: string[]): Promise<number> {
  const wanted = [...new Set(skus)];
  if (!wanted.length) return 0;
  const db = await getDb();
  const vs = await db
    .select({ sku: schema.variants.sku, slug: schema.variants.productSlug, stock: schema.variants.stock, floor: schema.variants.lastPieceOnFloor })
    .from(schema.variants)
    .where(inArray(schema.variants.sku, wanted));
  if (!vs.length) return 0;
  const [products, drops] = await Promise.all([loadProducts(db, [...new Set(vs.map((v) => v.slug))]), allDrops()]);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const ready = vs
    .filter((v) => {
      const p = bySlug.get(v.slug);
      return p && p.showOn?.website && effectiveStatus(p, drops) === "live" && sellable({ stock: v.stock, lastPieceOnFloor: v.floor }) > 0;
    })
    .map((v) => v.sku);
  if (!ready.length) return 0;

  const claimed = await db
    .update(schema.restockAlerts)
    .set({ notifiedAt: new Date().toISOString() })
    .where(and(inArray(schema.restockAlerts.sku, ready), isNull(schema.restockAlerts.notifiedAt)))
    .returning();
  if (!claimed.length) return 0;

  const send = () => eachLimited(claimed, SEND_AT_ONCE, (a) => tellRestocked(a, bySlug.get(a.slug)?.name ?? "Your piece"));
  try {
    after(send);
  } catch {
    // Outside a request (a script): send now, in the background.
    void send();
  }
  return claimed.length;
}

// ---------- Drops ----------

/**
 * Creates or updates a drop and sets which products belong to it (they become "scheduled" if it's still to come).
 * `offered` is the products the form showed (default: every product not archived); only their
 * membership changes, so archived pieces already in the drop stay in it.
 * The piece count ("12 left of 40") is set when the drop is created and while it's still to come,
 * then frozen at release. A drop that loses a product to this one is recounted if it's still to come.
 */
export async function saveDrop(d: { slug: string; name: string; story: string; releaseAt: string }, productSlugs: string[], offered?: string[]) {
  const db = await getDb();
  const now = Date.now();
  await db.transaction(async (tx) => {
    const [old] = await tx.select().from(schema.drops).where(eq(schema.drops.slug, d.slug)).for("update");
    await tx
      .insert(schema.drops)
      .values({ ...d, pieceCount: 0 })
      .onConflictDoUpdate({ target: schema.drops.slug, set: { name: d.name, story: d.story, releaseAt: d.releaseAt } });
    const dropList = await tx.select({ slug: schema.drops.slug, releaseAt: schema.drops.releaseAt }).from(schema.drops);
    const upcoming = (slug: string) => {
      const x = dropList.find((y) => y.slug === slug);
      return Boolean(x && Date.parse(isoTime(x.releaseAt)) > now);
    };
    const future = Date.parse(d.releaseAt) > now;

    const all = await loadProducts(tx as unknown as DB);
    const onForm = new Set(offered ?? all.filter((p) => p.status !== "archived").map((p) => p.slug));
    const chosen = new Set(productSlugs.filter((s) => onForm.has(s)));
    const finalDrop = new Map(all.map((p) => [p.slug, p.dropSlug]));
    const losing = new Set<string>();

    for (const p of all) {
      if (!onForm.has(p.slug)) continue; // not on the form: leave it where it is
      const inDrop = chosen.has(p.slug);
      if (!inDrop && p.dropSlug !== d.slug) continue;
      const [row] = await tx.select().from(schema.products).where(eq(schema.products.slug, p.slug)).for("update");
      if (!row) continue;
      let status: ProductStatus = row.status;
      let dropSlug: string | null;
      if (inDrop) {
        if (row.data.dropSlug && row.data.dropSlug !== d.slug) losing.add(row.data.dropSlug);
        dropSlug = d.slug;
        if (future && (status === "live" || status === "draft")) status = "scheduled";
      } else {
        dropSlug = null;
        // Taken out while still waiting for this drop: back to draft, not "coming soon" forever.
        // If the drop is already out it was on sale, so it stays on sale.
        if (status === "scheduled") status = future ? "draft" : effectiveStatus({ ...p, status }, [{ slug: p.dropSlug ?? "", releaseAt: d.releaseAt }], now);
      }
      finalDrop.set(p.slug, dropSlug);
      if (dropSlug === row.data.dropSlug && status === row.status) continue;
      await tx
        .update(schema.products)
        .set({ data: { ...row.data, dropSlug }, status, updatedAt: new Date().toISOString() })
        .where(eq(schema.products.slug, p.slug));
    }

    const piecesIn = (slug: string) =>
      all.filter((p) => finalDrop.get(p.slug) === slug).reduce((n, p) => n + p.variants.reduce((m, v) => m + v.stock, 0), 0);
    if (!old || future || Date.parse(isoTime(old.releaseAt)) > now) {
      await tx.update(schema.drops).set({ pieceCount: piecesIn(d.slug) }).where(eq(schema.drops.slug, d.slug));
    }
    for (const slug of losing) {
      if (slug !== d.slug && upcoming(slug)) await tx.update(schema.drops).set({ pieceCount: piecesIn(slug) }).where(eq(schema.drops.slug, slug));
    }
  });
}

// ---------- Festivals ----------

export async function festivals(): Promise<Festival[]> {
  const db = await getDb();
  return db.select().from(schema.festivals).orderBy(asc(schema.festivals.date));
}

export async function saveFestivals(list: Festival[]) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.festivals);
    if (list.length) await tx.insert(schema.festivals).values(list);
  });
}

export type { Festival, Size };
