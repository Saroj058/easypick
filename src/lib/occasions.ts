// "Wear it to…": a ready fit for each occasion, picked from what's live on the rack.
// Each look is three pieces; colours lean dark or light to suit the occasion.

import type { Category, Product, Size } from "./types";

export type OccasionKey = "party" | "casual" | "wedding" | "date";

export interface LookPiece {
  slug: string;
  name: string;
  category: Category;
  price: number;
  colour: string;
  hex: string;
  image: Product["images"][number];
  measurements: Product["measurements"];
  sizes: { size: Size; sku: string; stock: number }[];
}

export interface Look {
  key: OccasionKey;
  label: string;
  place: string;
  pieces: LookPiece[];
}

/** What the owner picked per occasion in /admin/looks: a place line and up to three pieces in a colour. */
export type SavedLooks = Partial<Record<OccasionKey, { place?: string; pieces: { slug: string; colour: string }[] }>>;

export const OCCASIONS: { key: OccasionKey; label: string; place: string }[] = [
  { key: "party", label: "Party", place: "Thamel, Friday" },
  { key: "casual", label: "Casual", place: "Campus, Monday" },
  { key: "wedding", label: "Wedding", place: "Cousin's bihe" },
  { key: "date", label: "Date", place: "Jhamsikhel, Saturday" },
];

const PLAN: { key: OccasionKey; label: string; place: string; slots: Category[][]; tone: "dark" | "light" | "mixed" }[] = [
  { key: "party", label: "Party", place: "Thamel, Friday", slots: [["jackets"], ["tees"], ["bottoms"]], tone: "dark" },
  { key: "casual", label: "Casual", place: "Campus, Monday", slots: [["tees", "hoodies"], ["bottoms"], ["accessories"]], tone: "mixed" },
  { key: "wedding", label: "Wedding", place: "Cousin's bihe", slots: [["jackets"], ["tees"], ["bottoms"]], tone: "light" },
  { key: "date", label: "Date", place: "Jhamsikhel, Saturday", slots: [["hoodies", "tees"], ["bottoms"], ["accessories", "jackets"]], tone: "mixed" },
];

const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function toPiece(p: Product, tone: "dark" | "light" | "mixed", slot: number, pickedColour?: string): LookPiece | null {
  const inStock = p.colours.filter((c) => p.variants.some((v) => v.colour === c.name && v.stock > 0));
  if (inStock.length === 0) return null;
  const byLight = [...inStock].sort((a, b) => luminance(a.hex) - luminance(b.hex));
  // Wedding: a light top under a dark layer; party: all dark; otherwise alternate.
  const wantLight = tone === "light" ? slot === 1 : tone === "mixed" ? slot % 2 === 1 : false;
  const colour = inStock.find((c) => c.name === pickedColour) ?? (wantLight ? byLight[byLight.length - 1] : byLight[0]);
  const sizes = p.variants
    .filter((v) => v.colour === colour.name)
    .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size))
    .map((v) => ({ size: v.size, sku: v.sku, stock: v.stock }));
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    price: p.salePrice ?? p.price,
    colour: colour.name,
    hex: colour.hex,
    image: p.images[0] ?? { src: null, alt: p.name, kind: "front" },
    measurements: p.measurements,
    sizes,
  };
}

export function buildLooks(products: Product[], saved: SavedLooks = {}): Look[] {
  const live = products.filter((p) => p.status === "live" && p.variants.some((v) => v.stock > 0));
  const looks: Look[] = [];
  PLAN.forEach((plan, i) => {
    // The owner's look, when at least two of its pieces are live and in stock.
    const mine = saved[plan.key];
    if (mine && mine.pieces.length) {
      const pieces = mine.pieces.flatMap((x, slot) => {
        const p = live.find((q) => q.slug === x.slug);
        const piece = p && toPiece(p, plan.tone, slot, x.colour);
        return piece ? [piece] : [];
      });
      if (pieces.length >= 2) {
        looks.push({ key: plan.key, label: plan.label, place: mine.place || plan.place, pieces });
        return;
      }
    }
    const used = new Set<string>();
    const pieces: LookPiece[] = [];
    plan.slots.forEach((cats, slot) => {
      const options = live.filter((p) => cats.includes(p.category) && !used.has(p.slug));
      if (options.length === 0) return;
      // Rotate through the options so each occasion shows different pieces.
      const p = options[i % options.length];
      const piece = toPiece(p, plan.tone, slot);
      if (!piece) return;
      used.add(p.slug);
      pieces.push(piece);
    });
    if (pieces.length >= 2) looks.push({ key: plan.key, label: plan.label, place: plan.place, pieces });
  });
  return looks;
}

/** Which /fit slot a category goes in, for "Build your own fit". */
export function fitSlot(category: Category): "top" | "bottom" | "layer" | "cap" {
  if (category === "bottoms") return "bottom";
  if (category === "jackets") return "layer";
  if (category === "accessories") return "cap";
  return "top";
}
