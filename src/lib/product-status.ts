import type { Drop, Product, ProductStatus } from "./types";

// What the public sees of a product's status. Pure, so both the website data layer (store.ts)
// and the catalogue (restock alerts, drops) can use it without importing each other.

/**
 * A scheduled product goes live by itself once its drop time passes, so the site
 * never shows "coming soon" for something already on the rack.
 */
export function effectiveStatus(p: Pick<Product, "status" | "dropSlug" | "variants">, dropList: Pick<Drop, "slug" | "releaseAt">[], now = Date.now()): ProductStatus {
  if (p.status !== "scheduled") return p.status;
  const drop = dropList.find((d) => d.slug === p.dropSlug);
  if (drop && Date.parse(drop.releaseAt) <= now) {
    return p.variants.some((v) => v.stock > 0) ? "live" : "sold_out";
  }
  return "scheduled";
}

/** Statuses the public website can show. Draft, in review and archived stay hidden. */
export const PUBLIC_STATUSES: ProductStatus[] = ["live", "sold_out", "scheduled"];

export const isPublicStatus = (s: ProductStatus) => PUBLIC_STATUSES.includes(s);
