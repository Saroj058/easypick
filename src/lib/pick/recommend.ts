// Pick's product choices: plain rules over the real catalogue, never the AI. Each reason is built
// only from facts on the product (its fit, colour, price, stock, offer tags), so nothing is
// invented. Pure, so it is unit-tested in test/pick.test.ts.

import { formatPrice } from "../format";
import { sellable } from "../inventory";
import type { Category, Product, Size } from "../types";
import { categoryOf, forSelf, type PickState } from "./journey";

/** Colours that read as calm neutrals, for "minimal and clean". */
const NEUTRAL = /\b(black|white|ivory|bone|cream|stone|sand|ash|charcoal|grey|gray|navy|slate|off-white|ecru|oat)\b/i;
/** Colours that stand out, for "something bold". */
const BOLD = /\b(brick|rust|mustard|teal|plum|maroon|forest|sky|sage|olive|indigo|red|orange|yellow|green|purple|pink|cobalt|lime)\b/i;

/** What a product card in the chat shows. Every value comes from the catalogue. */
export interface PickCard {
  slug: string;
  name: string;
  price: number;
  /** The full price, when it is on sale. */
  was?: number;
  category: Category;
  image: Product["images"][number] | null;
  colourHex: string;
  /** Colours with at least one piece to sell. */
  colours: string[];
  /** Sizes with at least one piece to sell, in any colour. */
  sizes: Size[];
  /** 3 or fewer pieces left in all, across every size and colour. */
  few: boolean;
  why: string;
  /** Every colour and size with what is left, for "Add to bag" on the shop. */
  options: { colour: string; size: Size; sku: string; left: number }[];
}

const priceOf = (p: Product) => p.salePrice ?? p.price;
const isVault = (p: Product) => Boolean(p.vault) || p.tags.includes("vault");

/** What goes with each kind of piece, for "What goes with it?". */
export const GOES_WITH: Record<Category, Category[]> = {
  tees: ["bottoms", "jackets"],
  hoodies: ["bottoms", "accessories"],
  jackets: ["tees", "bottoms"],
  bottoms: ["tees", "hoodies"],
  "co-ords": ["accessories", "jackets"],
  accessories: ["tees", "hoodies"],
};

/** Pieces that can be sent as a gift right now. */
export function giftable(products: Product[]): Product[] {
  return products.filter((p) => p.status === "live" && p.variants.some((v) => sellable(v) > 0));
}

function sizesOf(p: Product): Size[] {
  const order: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
  return order.filter((z) => p.variants.some((v) => v.size === z && sellable(v) > 0));
}

const oneSize = (p: Product) => p.variants.every((v) => v.size === "ONE");

/** How well a piece fits the style asked for, and the words that say why. */
function styleScore(p: Product, s: PickState): { score: number; why?: string } {
  const colours = p.colours.map((c) => c.name).join(" ");
  switch (s.style) {
    case "street":
      if (p.fit === "oversized") return { score: 3, why: "Oversized fit, the streetwear shape you described." };
      if (p.category === "hoodies" || p.category === "co-ords") return { score: 2, why: "A relaxed streetwear staple." };
      return { score: p.fit === "relaxed" ? 1 : 0 };
    case "minimal":
      if (NEUTRAL.test(colours) && p.fit === "regular") return { score: 3, why: `Clean ${p.fit} fit in ${firstMatch(colours, NEUTRAL)}, easy to wear with anything.` };
      if (NEUTRAL.test(colours)) return { score: 2, why: `In ${firstMatch(colours, NEUTRAL)}, a calm neutral.` };
      return { score: 0 };
    case "casual":
      if (p.fit === "relaxed") return { score: 3, why: "Relaxed fit, made for everyday wear." };
      if (p.category === "tees" || p.category === "bottoms") return { score: 2, why: "An everyday piece they'll reach for often." };
      return { score: 0 };
    case "premium":
      if (isVault(p)) return { score: 4, why: "From the Vault, our branded pieces." };
      return { score: 0 };
    case "bold":
      if (BOLD.test(colours)) return { score: 3, why: `Comes in ${firstMatch(colours, BOLD)}, a colour that stands out.` };
      return { score: 0 };
    default:
      // Not sure: pieces most people can wear.
      if (p.fit === "regular" || p.fit === "relaxed") return { score: 1, why: `A ${p.fit} fit that suits most people.` };
      return { score: 0 };
  }
}

function firstMatch(text: string, re: RegExp): string {
  const m = text.match(re);
  return m ? m[0].toLowerCase() : "a neutral";
}

/**
 * Up to `count` pieces for the state, best first, skipping any already shown. With a budget,
 * only pieces at or under it. With a known size, only pieces with that size to sell.
 */
export function recommend(all: Product[], s: PickState, count = 3, kinds?: Category[]): { cards: PickCard[]; total: number } {
  const shown = new Set(s.shown ?? []);
  // On the shop: only the kind they asked for (or the kinds that go with it), in their colour if they named one.
  const only = kinds ?? (categoryOf(s.kind) ? [categoryOf(s.kind)!] : undefined);
  const colour = s.colour ? new RegExp(`\\b${s.colour === "grey" ? "gr[ae]y" : s.colour}\\b`, "i") : null;
  const pool = giftable(all).filter((p) => {
    if (only && !only.includes(p.category)) return false;
    if (colour && !p.colours.some((c) => colour.test(c.name) && p.variants.some((v) => v.colour === c.name && sellable(v) > 0))) return false;
    if (s.budget && priceOf(p) > s.budget) return false;
    if (s.sizing === "known" && s.size && !oneSize(p) && !p.variants.some((v) => v.size === s.size && sellable(v) > 0)) return false;
    return true;
  });
  // A special person or occasion leans to the top of the budget; otherwise the middle of it.
  const special = !forSelf(s) && (s.recipient === "partner" || s.occasion === "anniversary" || s.occasion === "valentine");
  const aim = s.budget ? s.budget * (special ? 0.95 : 0.7) : special ? 4000 : 2500;
  const ranked = pool
    .map((p) => {
      const st = styleScore(p, s);
      let score = st.score * 10;
      if (s.occasion === "festival" && p.tags.some((t) => /dashain|tihar|festival/.test(t))) score += 4;
      if (s.style !== "premium" && isVault(p) && s.budget === undefined) score -= 2;
      score -= Math.abs(priceOf(p) - aim) / Math.max(aim, 1);
      return { p, score, why: st.why };
    })
    .sort((a, b) => b.score - a.score);

  // A little variety: one per kind of piece first, then the rest.
  const fresh = ranked.filter((r) => !shown.has(r.p.slug));
  const picked: typeof fresh = [];
  const seenKinds = new Set<Category>();
  for (const r of fresh) {
    if (picked.length >= count) break;
    if (!seenKinds.has(r.p.category)) {
      picked.push(r);
      seenKinds.add(r.p.category);
    }
  }
  for (const r of fresh) {
    if (picked.length >= count) break;
    if (!picked.includes(r)) picked.push(r);
  }
  return { cards: picked.map((r) => card(r.p, s, r.why)), total: pool.length };
}

/** A product as a chat card, with its reasons. */
export function card(p: Product, s: PickState, styleWhy?: string): PickCard {
  const price = priceOf(p);
  const sizes = sizesOf(p);
  const left = p.variants.reduce((n, v) => n + sellable(v), 0);
  const reasons: string[] = [];
  if (styleWhy) reasons.push(styleWhy);
  if (s.colour && p.colours.some((c) => c.name.toLowerCase().includes(s.colour!))) reasons.push(`In ${p.colours.find((c) => c.name.toLowerCase().includes(s.colour!))!.name.toLowerCase()}, as you asked.`);
  if (oneSize(p)) reasons.push("One size, so there's nothing to guess.");
  else if (s.sizing === "known" && s.size) reasons.push(`Size ${s.size} is in stock.`);
  // The price is shown next to this anyway: the budget is only the reason when there is no other.
  if (s.budget && !reasons.length) reasons.push(`Inside your ${formatPrice(s.budget)} budget.`);
  if (p.salePrice && p.salePrice < p.price) reasons.push(`Down from ${formatPrice(p.price)}.`);
  return {
    slug: p.slug,
    name: p.name,
    price,
    was: p.salePrice && p.salePrice < p.price ? p.price : undefined,
    category: p.category,
    image: p.images[0] ?? null,
    colourHex: p.colours[0]?.hex ?? "#888888",
    colours: p.colours.filter((c) => p.variants.some((v) => v.colour === c.name && sellable(v) > 0)).map((c) => c.name),
    sizes,
    few: left > 0 && left <= 3,
    why: reasons.slice(0, 2).join(" ") || "A good all-rounder.",
    options: p.variants.map((v) => ({ colour: v.colour, size: v.size, sku: v.sku, left: sellable(v) })),
  };
}

/** Two pieces side by side, only in facts. */
export function compare(a: Product, b: Product): string {
  const line = (p: Product) => {
    const sizes = sizesOf(p);
    return `${p.name}: ${formatPrice(priceOf(p))}, ${p.fit} fit, ${p.colours.length} colour${p.colours.length === 1 ? "" : "s"}, ${oneSize(p) ? "one size" : `sizes ${sizes.join(", ") || "none left"}`}.`;
  };
  const cheaper = priceOf(a) === priceOf(b) ? null : priceOf(a) < priceOf(b) ? a : b;
  return `${line(a)}\n${line(b)}${cheaper ? `\n${cheaper.name} is the lighter spend.` : ""}`;
}
