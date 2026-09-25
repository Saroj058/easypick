import "server-only";

import { eq } from "drizzle-orm";

import { allDrops, loadProducts } from "./catalogue";
import { getDb, schema } from "./db";
import type { Drop, LiveStock, Product, ProductStatus } from "./types";

// Data access for the website. With STORE_API_URL set, reads from the Store API
// (FastAPI). Without it, serves the local catalogue (seeded from mock-data.ts and
// edited in the admin screen) so the site runs before the API exists.

const localProducts = async () => loadProducts(await getDb());
const localDrops = () => allDrops();
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

/**
 * A scheduled product goes live by itself once its drop time passes, so the site
 * never shows "coming soon" for something already on the rack.
 */
export function effectiveStatus(p: Product, dropList: Drop[], now = Date.now()): ProductStatus {
  if (p.status !== "scheduled") return p.status;
  const drop = dropList.find((d) => d.slug === p.dropSlug);
  if (drop && Date.parse(drop.releaseAt) <= now) {
    return p.variants.some((v) => v.stock > 0) ? "live" : "sold_out";
  }
  return "scheduled";
}

/** Statuses the public website can show. Draft, in review and archived stay hidden. */
const PUBLIC: ProductStatus[] = ["live", "sold_out", "scheduled"];

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
    .filter((p) => PUBLIC.includes(p.status));
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

/** Live stock by size. Never cached in page HTML; polled by the product page. */
export async function getLiveStock(slug: string): Promise<LiveStock | null> {
  if (API_URL) {
    return api<LiveStock>(`/products/${encodeURIComponent(slug)}/stock`, { cache: "no-store" });
  }
  const db = await getDb();
  const [exists] = await db.select({ slug: schema.products.slug }).from(schema.products).where(eq(schema.products.slug, slug));
  if (!exists) return null;
  const [p] = await loadProducts(db, [slug]);
  return {
    slug,
    updatedAt: new Date().toISOString(),
    sizes: p.variants.map((v) => ({
      size: v.size,
      colour: v.colour,
      stock: v.stock,
      inStoreOnly: Boolean(v.lastPieceOnFloor),
    })),
  };
}
