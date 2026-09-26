import "server-only";

import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { allDrops, loadProducts } from "./catalogue";
import { getDb, schema } from "./db";
import { effectiveStatus, isPublicStatus } from "./product-status";
import type { Drop, LiveStock, Product } from "./types";

// Data access for the website. With STORE_API_URL set, reads from the Store API
// (FastAPI). Without it, serves the local catalogue (seeded from mock-data.ts and
// edited in the admin screen) so the site runs before the API exists.

// Cached for a minute across requests, and dropped at once when the admin changes the catalogue
// or an order takes stock ("catalogue" tag). Checkout never trusts this copy: stock is checked
// again in the database when the order is placed, and the product page polls live stock.
const localProducts = cache(unstable_cache(async () => loadProducts(await getDb()), ["catalogue-products"], { tags: ["catalogue"], revalidate: 60 }));
const localDrops = cache(unstable_cache(() => allDrops(), ["catalogue-drops"], { tags: ["catalogue"], revalidate: 60 }));
//
// The API key stays on the server; nothing here is imported by client components.

const API_URL = process.env.STORE_API_URL;
const API_KEY = process.env.STORE_API_KEY;

async function api<T>(path: string, init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } }): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(10_000),
    ...init,
    headers: { Accept: "application/json", ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}), ...init?.headers },
  });
  if (!res.ok) throw new Error(`Store API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

const CATALOGUE = { next: { revalidate: 300, tags: ["catalogue"] } };

// Lives in product-status.ts so the catalogue (restock alerts, drops) can use it too.
export { effectiveStatus };

export async function getDrops(): Promise<Drop[]> {
  const list = API_URL ? await api<Drop[]>("/drops", CATALOGUE) : await localDrops();
  return [...list].sort((a, b) => Date.parse(b.releaseAt) - Date.parse(a.releaseAt));
}

export async function getDrop(slug: string): Promise<Drop | null> {
  return (await getDrops()).find((d) => d.slug === slug) ?? null;
}

export function isReleased(drop: Drop, now = Date.now()) {
  return Date.parse(drop.releaseAt) <= now;
}

/** The latest drop already released, and the next one still to come. */
export async function getDropTimeline(now = Date.now()) {
  const list = await getDrops();
  const released = list.filter((d) => Date.parse(d.releaseAt) <= now);
  const upcoming = list.filter((d) => Date.parse(d.releaseAt) > now).sort((a, b) => Date.parse(a.releaseAt) - Date.parse(b.releaseAt));
  return { current: released[0] ?? null, next: upcoming[0] ?? null };
}

export async function getProducts(): Promise<Product[]> {
  const [list, dropList] = await Promise.all([
    API_URL ? api<Product[]>("/products?channel=website", CATALOGUE) : localProducts(),
    getDrops(),
  ]);
  return list
    .filter((p) => p.showOn.website)
    .map((p) => ({ ...p, status: effectiveStatus(p, dropList) }))
    .filter((p) => isPublicStatus(p.status));
}

export async function getProduct(slug: string): Promise<Product | null> {
  return (await getProducts()).find((p) => p.slug === slug) ?? null;
}

export interface HomeStats {
  piecesLeft: number;
  piecesTotal: number;
  styles: number;
  colourways: number;
  priceFrom: number;
  priceTo: number;
  /** Sizes with 1–3 left, lowest first. */
  lowSizes: { name: string; slug: string; size: string; colour: string; stock: number }[];
  asOf: string;
}

/** Numbers shown as design on the home page. Every figure comes from stock data. */
export function getHomeStats(dropProducts: Product[], pieceCount: number | null): HomeStats {
  const variants = dropProducts.flatMap((p) => p.variants.map((v) => ({ p, v })));
  const piecesLeft = variants.reduce((n, { v }) => n + v.stock, 0);
  const prices = dropProducts.map((p) => p.salePrice ?? p.price);
  return {
    piecesLeft,
    piecesTotal: Math.max(pieceCount ?? 0, piecesLeft),
    styles: dropProducts.length,
    colourways: dropProducts.reduce((n, p) => n + p.colours.length, 0),
    priceFrom: prices.length ? Math.min(...prices) : 0,
    priceTo: prices.length ? Math.max(...prices) : 0,
    lowSizes: variants
      .filter(({ v }) => v.stock > 0 && v.stock <= 3 && v.size !== "ONE")
      .sort((a, b) => a.v.stock - b.v.stock)
      .slice(0, 6)
      .map(({ p, v }) => ({ name: p.name, slug: p.slug, size: v.size, colour: v.colour, stock: v.stock })),
    asOf: new Date().toISOString(),
  };
}

/** Live stock by size. Never cached in page HTML; polled by the product page. Null for products the public can't see. */
export async function getLiveStock(slug: string): Promise<LiveStock | null> {
  if (API_URL) {
    return api<LiveStock>(`/products/${encodeURIComponent(slug)}/stock`, { cache: "no-store" });
  }
  // Only this product's rows: this is polled by every open product page.
  const db = await getDb();
  const [product] = await db.select({ status: schema.products.status, data: schema.products.data }).from(schema.products).where(eq(schema.products.slug, slug));
  if (!product?.data.showOn?.website) return null;
  const rows = await db.select().from(schema.variants).where(eq(schema.variants.productSlug, slug)).orderBy(asc(schema.variants.position));
  if (!rows.length) return null;
  // Same filter as getProducts: drafts, in-review, archived and hidden products don't exist to the public.
  const drops = product.status === "scheduled" ? await localDrops() : [];
  if (!isPublicStatus(effectiveStatus({ status: product.status, dropSlug: product.data.dropSlug, variants: rows }, drops))) return null;
  return {
    slug,
    updatedAt: new Date().toISOString(),
    sizes: rows.map((v) => ({
      size: v.size,
      colour: v.colour,
      stock: v.stock,
      // Only while there is a piece: at 0 it's simply sold out.
      inStoreOnly: Boolean(v.lastPieceOnFloor) && v.stock > 0,
    })),
  };
}
