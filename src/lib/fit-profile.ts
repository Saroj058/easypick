// The customer's size, saved once and used on every piece (owner, 19 Oct 2026: "Find my size").
// Three ways in, best first: a garment they own and love, measured flat (chest, length, waist); a
// size they know in another brand; or their height and weight with their build. With any of them,
// each product picks the size whose own measurements suit them, for the fit they like.
// Kept in this browser, and on the account when they're signed in (saveMyFit).

import { BRANDS, BRAND_SIZES, chestFromBrand, estimateBody, explain, HEIGHT, PREFS, recommend, SHAPES, WEIGHT, type Body, type BrandId, type Pref, type Recommendation, type Shape } from "./size-maths";
import type { Category, Fit, Measurements, Size } from "./types";
import { isBottom } from "./site";

export interface FitProfile {
  /** Chest of a favourite top, garment laid flat, armpit to armpit × 2 (cm). */
  chest?: number;
  /** Length of that top, shoulder to hem (cm). */
  length?: number;
  /** Waist of favourite trousers, laid flat × 2 (cm). */
  waist?: number;
  heightCm?: number;
  weightKg?: number;
  shape?: Shape;
  /** How they like things to fit. */
  pref?: Pref;
  /** A size they know in another brand's tops. */
  brand?: { id: BrandId; size: Size };
  /** Their jeans waist size in inches, if they know it. */
  jeans?: number;
  /** When it was last saved (ISO), so the newer of browser and account wins. */
  updatedAt?: string;
}

const KEY = "ep-fit-v1";
const EVENT = "ep-fit-change";

const inRange = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : undefined);

/** Keeps only fields that make sense, so a bad save (or an old one) never breaks sizing. */
export function normalizeFit(raw: unknown): FitProfile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: FitProfile = {};
  const chest = inRange(r.chest, 40, 200);
  const length = inRange(r.length, 40, 200);
  const waist = inRange(r.waist, 40, 200);
  const heightCm = inRange(r.heightCm, HEIGHT.min, HEIGHT.max);
  const weightKg = inRange(r.weightKg, WEIGHT.min, WEIGHT.max);
  const jeans = inRange(r.jeans, 26, 44);
  if (chest) out.chest = chest;
  if (length) out.length = length;
  if (waist) out.waist = waist;
  if (heightCm && weightKg) {
    out.heightCm = heightCm;
    out.weightKg = weightKg;
  } else if (heightCm) out.heightCm = heightCm;
  if (SHAPES.includes(r.shape as Shape)) out.shape = r.shape as Shape;
  if (PREFS.includes(r.pref as Pref)) out.pref = r.pref as Pref;
  const b = (r.brand ?? {}) as Record<string, unknown>;
  if (BRANDS.some((x) => x.id === b.id) && BRAND_SIZES.includes(b.size as Size)) out.brand = { id: b.id as BrandId, size: b.size as Size };
  if (jeans) out.jeans = jeans;
  if (typeof r.updatedAt === "string" && !Number.isNaN(Date.parse(r.updatedAt))) out.updatedAt = r.updatedAt;
  return out;
}

export function readFit(): FitProfile {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeFit(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveFit(p: FitProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage blocked: the match still works for this page view
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: p }));
}

export function onFitChange(fn: (p: FitProfile) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<FitProfile>).detail);
  const storage = (e: StorageEvent) => e.key === KEY && fn(readFit());
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", storage);
  };
}

/** Measured a garment they own (the most exact way). */
const hasGarment = (p: FitProfile) => Boolean(p.chest || p.waist);

export function hasFit(p: FitProfile) {
  return hasGarment(p) || Boolean(p.heightCm && p.weightKg) || Boolean(p.brand);
}

/** Their body's chest and waist from height/weight and build, a brand size, or both (blended). */
export function bodyOf(p: FitProfile): Body | null {
  const est = p.heightCm && p.weightKg ? estimateBody(p.heightCm, p.weightKg, p.shape) : null;
  const brandChest = p.brand ? chestFromBrand(p.brand.id, p.brand.size) : null;
  if (!est && !brandChest) return null;
  // What they actually wear counts for more than an estimate (about 70/30).
  const chest = est && brandChest ? Math.round(0.7 * brandChest + 0.3 * est.chest) : (brandChest ?? est!.chest);
  const jeansWaist = p.jeans ? Math.round(p.jeans * 2.54 + 1.5) : null;
  const waist = jeansWaist ?? est?.waist;
  return { chest, waist, heightCm: p.heightCm, pref: p.pref, basis: est && brandChest ? "both" : brandChest ? "brand" : "estimate" };
}

export interface SizeMatch {
  size: Size;
  /** Signed difference in cm on the main measurement: + means roomier than suits them. */
  diff: number;
  on: "chest" | "waist";
  /** Set when worked out from their body (height/weight or a brand) rather than a garment they own. */
  rec?: Recommendation;
}

/** Their size in a piece, or null if we can't tell (caps, or nothing saved). */
export function matchSize(category: Category, measurements: Measurements, profile: FitProfile, fit?: Fit): SizeMatch | null {
  if (category === "accessories") return null;
  const on = isBottom(category) ? "waist" : "chest";
  const mine = profile[on];
  if (mine) {
    // A garment they own: the closest garment.
    let best: SizeMatch | null = null;
    let bestScore = Infinity;
    for (const [size, m] of Object.entries(measurements) as [Size, Record<string, number>][]) {
      const theirs = m?.[on];
      if (!theirs || size === "ONE") continue;
      let score = Math.abs(theirs - mine);
      if (on === "chest" && profile.length && m.length) score += Math.abs(m.length - profile.length) * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = { size, diff: theirs - mine, on };
      }
    }
    return best;
  }
  const body = bodyOf(profile);
  if (!body) return null;
  const rec = recommend(category, fit, measurements, body);
  return rec ? { size: rec.size, diff: rec.diff, on: rec.on, rec } : null;
}

export function describeMatch(m: SizeMatch) {
  if (m.rec) return explain(m.rec);
  const d = Math.round(m.diff);
  if (Math.abs(d) <= 1) return `Same ${m.on} as yours`;
  return d > 0 ? `${d} cm roomier than yours` : `${-d} cm closer than yours`;
}

/** What their saved size is based on, in a few words. */
export function fitSummary(p: FitProfile) {
  if (p.chest || p.waist) return `From a piece you own${p.chest ? ` · chest ${p.chest} cm` : ""}${p.waist ? ` · waist ${p.waist} cm` : ""}`;
  const b = bodyOf(p);
  if (!b) return "";
  const parts = [p.heightCm && p.weightKg ? `${p.heightCm} cm · ${p.weightKg} kg` : "", p.brand ? `${p.brand.size} in another brand` : "", p.pref ? `${p.pref} fit` : ""].filter(Boolean);
  return parts.join(" · ");
}
