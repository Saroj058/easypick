// Checkout limits for what the browser sends as the bag (pure, so it's easy to test).
// The bag is merged by SKU first, so two lines of the same piece can't get around the
// per-piece limit.

export const MAX_PER_SKU = 5;
export const MAX_PIECES = 15;
const MAX_LINES = 30;

export interface BagRequestLine {
  slug: string;
  sku: string;
  name: string;
  qty: number;
}

export type BagCheck = { ok: true; lines: BagRequestLine[] } | { ok: false; message: string };

/** Reads the bag JSON lines, merges them by SKU and applies the limits. `buyNow` keeps only one piece of the first line. */
export function mergeBag(raw: unknown, opts: { buyNow?: boolean } = {}): BagCheck {
  const empty: BagCheck = { ok: false, message: "Your bag is empty." };
  if (!Array.isArray(raw) || raw.length === 0) return empty;
  if (raw.length > MAX_LINES) return { ok: false, message: `You can order up to ${MAX_PIECES} pieces at once.` };

  const merged = new Map<string, BagRequestLine>();
  for (const item of opts.buyNow ? raw.slice(0, 1) : raw) {
    if (!item || typeof item !== "object") return empty;
    const { slug, sku, name, qty } = item as Record<string, unknown>;
    if (typeof slug !== "string" || typeof sku !== "string" || !slug || !sku || slug.length > 120 || sku.length > 60) return empty;
    const n = opts.buyNow ? 1 : Math.floor(Number(qty));
    if (!Number.isFinite(n) || n < 1) return { ok: false, message: "Check the quantities in your bag." };
    const label = typeof name === "string" && name ? name.slice(0, 80) : "a piece";
    const line = merged.get(sku);
    if (line) {
      if (line.slug !== slug) return empty;
      line.qty += n;
    } else merged.set(sku, { slug, sku, name: label, qty: n });
  }

  const lines = [...merged.values()];
  const over = lines.find((l) => l.qty > MAX_PER_SKU);
  if (over) return { ok: false, message: `You can order up to ${MAX_PER_SKU} of the same piece (${over.name}). Update your bag to continue.` };
  if (lines.reduce((s, l) => s + l.qty, 0) > MAX_PIECES) return { ok: false, message: `You can order up to ${MAX_PIECES} pieces at once.` };
  return { ok: true, lines };
}
