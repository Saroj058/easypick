import "server-only";

import { randomUUID } from "node:crypto";

import { db, type Festival, type RestockAlert } from "./db";
import { giftEmailHtml } from "./email";
import { notifyEmail, notifySms } from "./notify";
import { site } from "./site";
import type { Product, Size } from "./types";

// Changes to the local catalogue: the admin screen, paid orders taking stock off
// the rack, and "tell me when my size is back". Swaps for Store API calls later.

/** Every product, including drafts and archived ones (the website only shows public ones). */
export function allProducts(): Product[] {
  return db((d) => structuredClone(d.products));
}

export function findProduct(slug: string): Product | null {
  return db((d) => structuredClone(d.products.find((p) => p.slug === slug) ?? null));
}

export function createProduct(p: Product) {
  db((d) => {
    if (d.products.some((x) => x.slug === p.slug)) throw new Error("slug taken");
    d.products.push(p);
  }, true);
}

export function updateProduct(slug: string, fn: (p: Product) => void) {
  return db((d) => {
    const p = d.products.find((x) => x.slug === slug);
    if (p) fn(p);
    return p ?? null;
  }, true);
}

/**
 * Set stock counts. Returns the SKUs that went from none to some, so the people
 * who asked to hear about them can be told.
 */
export function setStock(slug: string, counts: Record<string, number>): string[] {
  const restocked: string[] = [];
  updateProduct(slug, (p) => {
    for (const v of p.variants) {
      const next = counts[v.sku];
      if (next === undefined || !Number.isFinite(next)) continue;
      const n = Math.max(0, Math.floor(next));
      if (v.stock <= 0 && n > 0) restocked.push(v.sku);
      v.stock = n;
      if (n > 1) v.lastPieceOnFloor = false;
    }
  });
  return restocked;
}

/** Paid orders take their pieces off stock; a cancelled hold puts them back. */
export function adjustStock(lines: { sku: string; qty: number }[], direction: -1 | 1) {
  db((d) => {
    for (const l of lines) {
      for (const p of d.products) {
        const v = p.variants.find((x) => x.sku === l.sku);
        if (v) v.stock = Math.max(0, v.stock + direction * l.qty);
      }
    }
  }, true);
}

// ---------- Restock alerts ----------

export function addRestockAlert(input: Omit<RestockAlert, "id" | "createdAt" | "notifiedAt">) {
  db((d) => {
    const dupe = d.restockAlerts.find(
      (a) => a.sku === input.sku && !a.notifiedAt && ((input.email && a.email === input.email) || (input.phone && a.phone === input.phone)),
    );
    if (dupe) return;
    d.restockAlerts.push({ ...input, id: randomUUID(), createdAt: new Date().toISOString(), notifiedAt: null });
  }, true);
}

/** Waiting requests per SKU, for the admin stock screen. */
export function restockDemand(): Record<string, number> {
  return db((d) =>
    d.restockAlerts.filter((a) => !a.notifiedAt).reduce<Record<string, number>>((m, a) => ((m[a.sku] = (m[a.sku] ?? 0) + 1), m), {}),
  );
}

/** Tells everyone waiting on these SKUs that they're back. Returns how many were told. */
export async function notifyRestocked(skus: string[]): Promise<number> {
  if (!skus.length) return 0;
  const waiting = db((d) => d.restockAlerts.filter((a) => skus.includes(a.sku) && !a.notifiedAt));
  for (const a of waiting) {
    const p = findProduct(a.slug);
    const name = p?.name ?? "Your piece";
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
  db((d) => {
    const now = new Date().toISOString();
    for (const a of d.restockAlerts) if (waiting.some((w) => w.id === a.id)) a.notifiedAt = now;
  }, true);
  return waiting.length;
}

// ---------- Festivals ----------

export function festivals(): Festival[] {
  return db((d) => [...d.festivals].sort((a, b) => a.date.localeCompare(b.date)));
}

export function saveFestivals(list: Festival[]) {
  db((d) => {
    d.festivals = list;
  }, true);
}

export type { Festival, Size };
