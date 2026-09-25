import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb, productRows, schema, type DB, type Exec, type Festival, type RestockAlert } from "./db";
import { giftEmailHtml } from "./email";
import { notifyEmail, notifySms } from "./notify";
import { site } from "./site";
import type { Drop, Product, Size } from "./types";

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
  return db.select().from(schema.drops).orderBy(asc(schema.drops.releaseAt));
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
 * Returns the SKUs that went from none to some (for restock alerts).
 */
export async function moveStock(exec: Exec, moves: { sku: string; delta: number }[], meta: StockMeta, opts: { online?: boolean } = {}): Promise<string[]> {
  const restocked: string[] = [];
  for (const m of moves) {
    if (!m.delta) continue;
    const floorRule = opts.online ? sql`case when ${schema.variants.lastPieceOnFloor} then 1 else 0 end` : sql`0`;
    const [row] = await exec
      .update(schema.variants)
      .set({ stock: sql`${schema.variants.stock} + ${m.delta}` })
      .where(m.delta < 0 ? and(eq(schema.variants.sku, m.sku), sql`${schema.variants.stock} - ${floorRule} + ${m.delta} >= 0`) : eq(schema.variants.sku, m.sku))
      .returning({ stock: schema.variants.stock });
    if (!row) {
      const [v] = await exec.select({ stock: schema.variants.stock, floor: schema.variants.lastPieceOnFloor }).from(schema.variants).where(eq(schema.variants.sku, m.sku));
      throw new StockShortError(m.sku, v ? Math.max(0, v.stock - (opts.online && v.floor ? 1 : 0)) : 0);
    }
    if (row.stock > 1) await exec.update(schema.variants).set({ lastPieceOnFloor: false }).where(eq(schema.variants.sku, m.sku));
    if (row.stock - m.delta <= 0 && row.stock > 0) restocked.push(m.sku);
    await exec.insert(schema.stockMovements).values({
      sku: m.sku,
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
  return db
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

/** Tells everyone waiting on these SKUs that they're back. Returns how many were told. */
export async function notifyRestocked(skus: string[]): Promise<number> {
  if (!skus.length) return 0;
  const db = await getDb();
  const waiting = await db
    .select()
    .from(schema.restockAlerts)
    .where(and(inArray(schema.restockAlerts.sku, skus), isNull(schema.restockAlerts.notifiedAt)));
  if (!waiting.length) return 0;
  const names = new Map((await loadProducts(db, [...new Set(waiting.map((a) => a.slug))])).map((p) => [p.slug, p.name]));

  for (const a of waiting) {
    const name = names.get(a.slug) ?? "Your piece";
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
  await db
    .update(schema.restockAlerts)
    .set({ notifiedAt: new Date().toISOString() })
    .where(
      inArray(
        schema.restockAlerts.id,
        waiting.map((a) => a.id),
      ),
    );
  return waiting.length;
}

// ---------- Drops ----------

/** Creates or updates a drop and sets which products belong to it (they become "scheduled" if it's still to come). */
export async function saveDrop(d: { slug: string; name: string; story: string; releaseAt: string }, productSlugs: string[]) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const current = (await loadProducts(tx as unknown as DB)).filter((p) => p.dropSlug === d.slug || productSlugs.includes(p.slug));
    await tx
      .insert(schema.drops)
      .values({ ...d, pieceCount: 0 })
      .onConflictDoUpdate({ target: schema.drops.slug, set: { name: d.name, story: d.story, releaseAt: d.releaseAt } });
    const future = Date.parse(d.releaseAt) > Date.now();
    let pieces = 0;
    for (const p of current) {
      const inDrop = productSlugs.includes(p.slug);
      const [row] = await tx.select().from(schema.products).where(eq(schema.products.slug, p.slug)).for("update");
      if (!row) continue;
      const data = { ...row.data, dropSlug: inDrop ? d.slug : row.data.dropSlug === d.slug ? null : row.data.dropSlug };
      let status = row.status;
      if (inDrop && future && (status === "live" || status === "draft")) status = "scheduled";
      if (inDrop) pieces += p.variants.reduce((n, v) => n + v.stock, 0);
      await tx.update(schema.products).set({ data, status, updatedAt: new Date().toISOString() }).where(eq(schema.products.slug, p.slug));
    }
    await tx.update(schema.drops).set({ pieceCount: pieces }).where(eq(schema.drops.slug, d.slug));
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
