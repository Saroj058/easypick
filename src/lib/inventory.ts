import type { Size, Variant } from "./types";

// Stock rules shared by the website, the admin and the server (safe in client code).

/** Sizes in the order people expect to read them. */
export const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

export const bySize = (a: { size: Size }, b: { size: Size }) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size);

/**
 * Pieces that can be sold online. When the only piece left is out on the shop floor
 * (lastPieceOnFloor), it's kept for the store and the website shows "in store only".
 */
export function sellable(v: Pick<Variant, "stock" | "lastPieceOnFloor">) {
  return Math.max(0, v.stock - (v.lastPieceOnFloor ? 1 : 0));
}
