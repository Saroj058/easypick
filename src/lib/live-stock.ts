import type { LiveStock, Variant } from "./types";

/**
 * Stock as the page was rendered, so sizes can be picked straight away.
 * The product page swaps it for the live answer from /api/stock as soon as that arrives.
 */
export function stockFromVariants(slug: string, variants: Variant[]): LiveStock {
  return {
    slug,
    updatedAt: "",
    sizes: variants.map((v) => ({ size: v.size, colour: v.colour, stock: v.stock, inStoreOnly: Boolean(v.lastPieceOnFloor) })),
  };
}
