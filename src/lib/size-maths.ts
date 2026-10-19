import type { Category, Fit, Measurements, Size } from "./types";

// The sizing maths behind "Find my size" (owner, 19 Oct 2026: "super advanced, easy for the user;
// a men's store"). From height and weight (and build), or a size in another brand, it estimates the
// body's chest and waist, adds the room the customer likes, and picks the size of each piece whose
// own measurements come closest. Pure, so it is tested without a browser.
//
// Sources (approximate, to be recalibrated against exchanges): chest on BMI from ANSUR II men
// (Gordon et al. 2014); waist on BMI from NHANES men, plus ~2 cm for South Asian men (WHO Expert
// Consultation 2004); ease from common pattern-making allowances; brand charts from each brand's
// own men's size chart (checked by hand, rounded).

export type Shape = "slim" | "average" | "broad" | "belly";
export type Pref = "fitted" | "regular" | "relaxed" | "oversized";
export const SHAPES: Shape[] = ["slim", "average", "broad", "belly"];
export const PREFS: Pref[] = ["fitted", "regular", "relaxed", "oversized"];

export const HEIGHT = { min: 145, max: 205 };
export const WEIGHT = { min: 40, max: 150 };

const SHAPE_ADJ: Record<Shape, { chest: number; waist: number }> = {
  slim: { chest: -3, waist: -2 },
  average: { chest: 0, waist: 0 },
  broad: { chest: 4, waist: -2 },
  belly: { chest: 1, waist: 6 },
};

/** A man's body chest and waist (cm, all the way round) from height, weight and build. */
export function estimateBody(heightCm: number, weightKg: number, shape: Shape = "average") {
  const bmi = Math.min(38, Math.max(16, weightKg / (heightCm / 100) ** 2));
  const a = SHAPE_ADJ[shape] ?? SHAPE_ADJ.average;
  return {
    chest: Math.round(40 + 2.35 * bmi + 0.1 * (heightCm - 170) + a.chest),
    waist: Math.round(22 + 2.7 * bmi + a.waist),
  };
}

// ---------- Other brands ----------

export type BrandId = "generic" | "uniqlo" | "hm" | "zara" | "nike" | "adidas" | "indian";
export const BRANDS: { id: BrandId; name: string }[] = [
  { id: "generic", name: "Most brands" },
  { id: "uniqlo", name: "Uniqlo" },
  { id: "hm", name: "H&M" },
  { id: "zara", name: "Zara" },
  { id: "nike", name: "Nike" },
  { id: "adidas", name: "Adidas" },
  { id: "indian", name: "Roadster, HRX, Allen Solly" },
];
export const BRAND_SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

/** Body chest ranges (cm) for each brand's men's tops; Uniqlo is its Asian chart. */
const BRAND_CHEST: Record<BrandId, Partial<Record<Size, [number, number]>>> = {
  generic: { XS: [80, 86], S: [86, 94], M: [94, 102], L: [102, 110], XL: [110, 118], XXL: [118, 126] },
  uniqlo: { XS: [78, 85], S: [85, 91], M: [88, 96], L: [96, 104], XL: [104, 112], XXL: [112, 120] },
  hm: { XS: [82, 88], S: [88, 96], M: [96, 104], L: [104, 112], XL: [112, 120], XXL: [120, 128] },
  zara: { XS: [84, 88], S: [88, 94], M: [94, 100], L: [100, 106], XL: [106, 112], XXL: [112, 118] },
  nike: { XS: [80, 88], S: [88, 96], M: [96, 104], L: [104, 112], XL: [112, 124], XXL: [124, 136] },
  adidas: { XS: [82, 88], S: [88, 94], M: [94, 100], L: [100, 107], XL: [107, 115], XXL: [115, 124] },
  indian: { XS: [81, 86], S: [86, 91], M: [91, 97], L: [97, 102], XL: [102, 107], XXL: [107, 112] },
};

/** A body chest from a size in another brand, or null. */
export function chestFromBrand(brand: BrandId, size: Size): number | null {
  const r = BRAND_CHEST[brand]?.[size];
  return r ? Math.round((r[0] + r[1]) / 2) : null;
}

/** Body waist (cm) from a jeans waist size in inches (labels run ~1.5 cm small). */
export const waistFromJeans = (inches: number) => Math.round(inches * 2.54 + 1.5);

// ---------- Our sizes ----------

/** Body ranges by our size, for South Asian men (about a size under US charts). */
const CHART: { size: Size; chest: [number, number]; waist: [number, number]; jeans: number }[] = [
  { size: "XS", chest: [80, 86], waist: [66, 72], jeans: 28 },
  { size: "S", chest: [86, 92], waist: [72, 78], jeans: 30 },
  { size: "M", chest: [92, 98], waist: [78, 84], jeans: 32 },
  { size: "L", chest: [98, 104], waist: [84, 90], jeans: 34 },
  { size: "XL", chest: [104, 111], waist: [90, 98], jeans: 36 },
  { size: "XXL", chest: [111, 118], waist: [98, 106], jeans: 38 },
];

const JEANS = [28, 29, 30, 31, 32, 33, 34, 36, 38, 40];
/** The jeans waist size (inches) for a body waist: the reverse of waistFromJeans, to the nearest size made. */
export function jeansFor(waist: number) {
  const inches = (waist - 1.5) / 2.54;
  return JEANS.reduce((a, b) => (Math.abs(b - inches) < Math.abs(a - inches) ? b : a));
}

type Kind = "tee" | "shirt" | "layer" | "jacket" | "jeans" | "trousers" | "joggers";
const KIND: Partial<Record<Category, Kind>> = {
  tees: "tee",
  polos: "tee",
  "co-ords": "tee",
  shirts: "shirt",
  hoodies: "layer",
  sweatshirts: "layer",
  jackets: "jacket",
  jeans: "jeans",
  trousers: "trousers",
  shorts: "trousers",
  joggers: "joggers",
};
const BOTTOM: Kind[] = ["jeans", "trousers", "joggers"];

/** Room (cm) the garment has over the body, by kind and how it should fit. */
const EASE: Record<Kind, Record<Pref, number>> = {
  tee: { fitted: 4, regular: 10, relaxed: 15, oversized: 22 },
  shirt: { fitted: 8, regular: 14, relaxed: 20, oversized: 28 },
  layer: { fitted: 10, regular: 16, relaxed: 22, oversized: 32 },
  jacket: { fitted: 12, regular: 18, relaxed: 24, oversized: 34 },
  jeans: { fitted: -1, regular: 1, relaxed: 3, oversized: 5 },
  trousers: { fitted: 0, regular: 2, relaxed: 4, oversized: 6 },
  joggers: { fitted: -8, regular: -6, relaxed: -4, oversized: -2 },
};
const LENGTH_K: Partial<Record<Kind, number>> = { tee: 0.41, shirt: 0.43, layer: 0.4, jacket: 0.4 };
const RANK: Record<Pref, number> = { fitted: 0, regular: 1, relaxed: 2, oversized: 3 };

export interface Body {
  chest?: number;
  waist?: number;
  heightCm?: number;
  pref?: Pref;
  /** How the body numbers were found: from height and weight, a brand size, or both. */
  basis: "estimate" | "brand" | "both";
}

export interface Recommendation {
  size: Size;
  /** Garment minus what suits them, in cm: + roomier, − closer. */
  diff: number;
  on: "chest" | "waist";
  confidence: "high" | "medium" | "low";
  /** The size either side when it's close, e.g. L for roomier. */
  alt?: { size: Size; why: "roomier" | "closer" };
  /** True when worked out from our chart because the piece has no measurements. */
  typical?: boolean;
  tooSmall?: boolean;
}

const ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

/**
 * The best size of one piece for a body: its own measurements against the body plus the room the
 * customer likes (a piece cut oversized keeps its look: the room is never less than its cut's).
 */
export function recommend(category: Category, fit: Fit | undefined, measurements: Measurements, body: Body): Recommendation | null {
  const kind = KIND[category];
  if (!kind) return null; // caps and bags
  const bottom = BOTTOM.includes(kind);
  const on = bottom ? "waist" : "chest";
  const mine = body[on];
  if (!mine) return null;
  const pref = body.pref ?? "regular";
  const style: Pref = fit && RANK[fit as Pref] !== undefined && RANK[fit as Pref] > RANK[pref] ? (fit as Pref) : pref;
  const target = mine + EASE[kind][style];
  const targetLength = body.heightCm && LENGTH_K[kind] ? body.heightCm * LENGTH_K[kind]! + (style === "oversized" ? 3 : 0) : null;
  const capped = body.basis === "estimate" ? "medium" : "high";

  const rows = ORDER.flatMap((size) => {
    const m = measurements[size];
    const g = m?.[on];
    if (!g) return [];
    let d = g - target;
    if (kind === "joggers" && Math.abs(d) <= 4) d = 0; // an elastic waist stretches either way
    let pen = d < 0 ? 1.6 * -d : d;
    if (targetLength && m?.length) pen += 0.4 * Math.max(0, Math.abs(m.length - targetLength) - 2);
    return [{ size, d, pen }];
  });

  if (!rows.length) {
    // No measurements on the piece: our chart, a size up for a roomier look on a regular cut.
    const i = CHART.findIndex((c) => mine < c[on][1]);
    const at = i < 0 ? CHART.length - 1 : i;
    const up = (pref === "oversized" || pref === "relaxed") && fit !== "oversized" ? 1 : 0;
    const size = CHART[Math.min(CHART.length - 1, at + up)].size;
    return { size, diff: 0, on, confidence: "low", typical: true };
  }

  rows.sort((a, b) => a.pen - b.pen || ORDER.indexOf(b.size) - ORDER.indexOf(a.size));
  const best = rows[0];
  const second = rows[1];
  const gap = second ? second.pen - best.pen : Infinity;
  let confidence: Recommendation["confidence"] = best.pen <= 3 && gap >= 3 ? "high" : best.pen <= 6 ? "medium" : "low";
  if (confidence === "high" && capped === "medium") confidence = "medium";
  const near = second && gap < 2.5 && Math.abs(ORDER.indexOf(second.size) - ORDER.indexOf(best.size)) === 1;
  return {
    size: best.size,
    diff: Math.round(best.d),
    on,
    confidence,
    ...(near ? { alt: { size: second.size, why: ORDER.indexOf(second.size) > ORDER.indexOf(best.size) ? ("roomier" as const) : ("closer" as const) } } : {}),
    ...(best.pen > 12 && best.d < 0 ? { tooSmall: true } : {}),
  };
}

/** One line about a recommendation, for under the size. */
export function explain(r: Recommendation) {
  if (r.typical) return "From our size chart (no measurements on this piece)";
  if (r.tooSmall) return `May be tight: our largest is ${-r.diff} cm snug at the ${r.on}`;
  const d = Math.abs(r.diff);
  if (d <= 2) return `Right on your fit at the ${r.on}`;
  return r.diff > 0 ? `${d} cm roomier at the ${r.on}` : `${d} cm closer at the ${r.on}`;
}
