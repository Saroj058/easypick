import { sellable } from "./inventory";
import type { Product, Size } from "./types";

// What the "add to bag" button on a product card needs to know (components/add-to-bag.tsx):
// plain data, so server-rendered cards can pass it to the button.

export interface Addable {
  slug: string;
  name: string;
  price: number;
  vault?: boolean;
  /** Every colour and size, with how many can be bought online. */
  options: { colour: string; size: Size; sku: string; left: number }[];
}

export function addableFromProduct(p: Product): Addable {
  return {
    slug: p.slug,
    name: p.name,
    price: p.salePrice ?? p.price,
    vault: p.vault,
    options: p.variants.map((v) => ({ colour: v.colour, size: v.size, sku: v.sku, left: sellable(v) })),
  };
}

export function addableFromRail(p: { slug: string; name: string; price: number; colours: { name: string; sizes: { size: Size; sku: string; left: number }[] }[]; tags?: string[] }): Addable {
  return {
    slug: p.slug,
    name: p.name,
    price: p.price,
    vault: p.tags?.includes("vault"),
    options: p.colours.flatMap((c) => c.sizes.map((s) => ({ colour: c.name, size: s.size, sku: s.sku, left: s.left }))),
  };
}
