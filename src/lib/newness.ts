import type { Drop, Product } from "./types";

// "New" on the website: a piece counts as new for 30 days after it went live, or until two
// more drops have launched, whichever comes first. Drop pieces went live at their drop's
// release time; other pieces when the owner put them live (Product.liveAt).

const NEW_FOR_MS = 30 * 86_400_000;

/** When a piece went live, or null if we can't tell (then it's never shown as new). */
export function wentLiveAt(p: Pick<Product, "dropSlug" | "liveAt">, drops: Drop[]): number | null {
  const drop = p.dropSlug ? drops.find((d) => d.slug === p.dropSlug) : undefined;
  const at = drop ? Date.parse(drop.releaseAt) : p.liveAt ? Date.parse(p.liveAt) : NaN;
  return Number.isNaN(at) ? null : at;
}

export function isNewProduct(p: Pick<Product, "dropSlug" | "liveAt" | "status">, drops: Drop[], now = Date.now()): boolean {
  if (p.status !== "live" && p.status !== "sold_out") return false;
  const at = wentLiveAt(p, drops);
  if (at === null || at > now || now - at > NEW_FOR_MS) return false;
  const laterDrops = drops.filter((d) => {
    const r = Date.parse(d.releaseAt);
    return r > at && r <= now;
  }).length;
  return laterDrops < 2;
}
