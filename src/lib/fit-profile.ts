// "Your size in cm": the customer measures a piece they already love, once, and
// every product then shows the size closest to it. Stored only in this browser.

import type { Category, Measurements, Size } from "./types";

export interface FitProfile {
  /** Chest of a favourite top, garment laid flat, armpit to armpit × 2 (cm). */
  chest?: number;
  /** Length of that top, shoulder to hem (cm). */
  length?: number;
  /** Waist of favourite trousers, laid flat × 2 (cm). */
  waist?: number;
}

const KEY = "ep-fit-v1";
const EVENT = "ep-fit-change";

export function readFit(): FitProfile {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FitProfile) : {};
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

export function hasFit(p: FitProfile) {
  return Boolean(p.chest || p.waist);
}

export interface SizeMatch {
  size: Size;
  /** Signed difference in cm on the main measurement: + means roomier than yours. */
  diff: number;
  on: "chest" | "waist";
}

/** Closest size to the customer's own piece, or null if we can't compare. */
export function matchSize(category: Category, measurements: Measurements, profile: FitProfile): SizeMatch | null {
  const on = category === "bottoms" ? "waist" : "chest";
  const mine = profile[on];
  if (!mine || category === "accessories") return null;

  let best: SizeMatch | null = null;
  let bestScore = Infinity;
  for (const [size, m] of Object.entries(measurements) as [Size, Record<string, number>][]) {
    const theirs = m?.[on];
    if (!theirs) continue;
    let score = Math.abs(theirs - mine);
    if (on === "chest" && profile.length && m.length) score += Math.abs(m.length - profile.length) * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = { size, diff: theirs - mine, on };
    }
  }
  return best;
}

export function describeMatch(m: SizeMatch) {
  const d = Math.round(m.diff);
  if (Math.abs(d) <= 1) return `Same ${m.on} as yours`;
  return d > 0 ? `${d} cm roomier than yours` : `${-d} cm closer than yours`;
}
