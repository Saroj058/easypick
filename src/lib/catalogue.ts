import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb, productRows, schema, type DB, type Festival, type RestockAlert } from "./db";
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

/**
 * Set stock counts. Returns the SKUs that went from none to some, so the people
 * who asked to hear about them can be told.
 */
export async function setStock(slug: string, counts: Record<string, number>): Promise<string[]> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const current = await tx.select().from(schema.variants).where(eq(schema.variants.productSlug, slug)).for("update");
    const restocked: string[] = [];
    for (const v of current) {
      const next = counts[v.sku];
      if (next === undefined || !Number.isFinite(next)) continue;
      const n = Math.max(0, Math.floor(next));
      if (v.stock <= 0 && n > 0) restocked.push(v.sku);
      await tx
        .update(schema.variants)
        .set({ stock: n, ...(n > 1 && { lastPieceOnFloor: false }) })
        .where(eq(schema.variants.sku, v.sku));
    }
    return restocked;
  });
}

/** Paid orders take their pieces off stock; a swapped or cancelled hold puts them back. Never below zero. */
export async function adjustStock(lines: { sku: string; qty: number }[], direction: -1 | 1) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const l of lines) {
      await tx
        .update(schema.variants)
        .set({ stock: sql`greatest(0, ${schema.variants.stock} + ${direction * l.qty})` })
        .where(eq(schema.variants.sku, l.sku));
    }
  });
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
