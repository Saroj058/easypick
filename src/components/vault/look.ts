import type { CSSProperties } from "react";

// The Vault's palette (owner, 18 Oct 2026, from the FRZN reference), as CSS variables so each brand
// can wear its own (owner, 18 Oct 2026: "for each brand a different theme, different stories").
//   --v-frost  the page around the panel; headlines on it in --v-deep (large), small text in --v-ink
//   --v-slate  the panel; text on it in white or --v-dim
//   --v-tile   the ground a piece stands on; text on it in --v-ink
// Every theme below keeps those pairings at WCAG AA (4.5:1 for small text, 3:1 for headlines).

export const V = {
  frost: "bg-[var(--v-frost)]",
  slate: "bg-[var(--v-slate)]",
  tile: "bg-[var(--v-tile)]",
  /** Headlines on frost (large text). */
  deep: "text-[var(--v-deep)]",
  /** Small text on frost or on a tile. */
  ink: "text-[var(--v-ink)]",
  /** Quiet text on slate. */
  iceDim: "text-[var(--v-dim)]",
  mono: "font-mono text-[10.5px] uppercase tracking-[0.16em]",
} as const;

export interface Theme {
  frost: string;
  slate: string;
  tile: string;
  deep: string;
  ink: string;
  dim: string;
}

/** The Vault's own cold blue: "All" and any brand without a theme of its own. */
export const COLD: Theme = { frost: "#aec4d8", slate: "#4b6680", tile: "#c3d4e4", deep: "#3d566e", ink: "#1f3347", dim: "#d5e2ee" };

/** A brand's colours and a few true lines about it. Names describe the pieces; no logos, no slogans. */
export interface BrandWorld {
  theme: Theme;
  /** Where and when it began. */
  origin: string;
  /** The big line on its page. */
  line: [string, string];
  story: string;
}

const WORLDS: Record<string, BrandWorld> = {
  nike: {
    theme: { frost: "#d9d9d6", slate: "#26282b", tile: "#cbccc8", deep: "#26282b", ink: "#1a1b1d", dim: "#c7c9cc" },
    origin: "Beaverton, Oregon · 1964",
    line: ["Born on", "the track."],
    story: "Started by a running coach and one of his runners, selling shoes out of a car at meets. Sixty years on it still begins with how a piece moves.",
  },
  adidas: {
    theme: { frost: "#b9c7e6", slate: "#1e3a6e", tile: "#cbd6ee", deep: "#1e3a6e", ink: "#13254a", dim: "#c9d5ee" },
    origin: "Herzogenaurach, Germany · 1949",
    line: ["From the terraces,", "since '49."],
    story: "A shoemaker's workshop in a small Bavarian town that went on to dress football pitches, running tracks and terraces. Clean lines, made to be worn hard.",
  },
  "new-balance": {
    theme: { frost: "#cfc9c0", slate: "#4d4f53", tile: "#dcd7cf", deep: "#3b3d40", ink: "#2a2b2e", dim: "#dedad3" },
    origin: "Boston, Massachusetts · 1906",
    line: ["Quiet grey,", "built to last."],
    story: "It began with arch supports for people on their feet all day. The grey that followed became its own kind of uniform: comfortable first, never loud.",
  },
  puma: {
    theme: { frost: "#e3c9c4", slate: "#7a2730", tile: "#edd7d2", deep: "#6a1f28", ink: "#3d1218", dim: "#f0d9d5" },
    origin: "Herzogenaurach, Germany · 1948",
    line: ["Fast by", "nature."],
    story: "Founded across the river from its brother's company in the same town. Sport first, with a streak of style that made it a street favourite.",
  },
  converse: {
    theme: { frost: "#e7e0cf", slate: "#2d2a26", tile: "#efe9da", deep: "#2d2a26", ink: "#23201c", dim: "#ddd5c4" },
    origin: "Malden, Massachusetts · 1908",
    line: ["Canvas and", "rubber."],
    story: "A rubber shoe company that made a basketball sneaker, then watched musicians, skaters and students adopt it. Simple pieces that look better worn in.",
  },
  carhartt: {
    theme: { frost: "#d9c49c", slate: "#5a4630", tile: "#e5d4b2", deep: "#4a3826", ink: "#2e2214", dim: "#ead9b8" },
    origin: "Detroit, Michigan · 1889",
    line: ["Made for", "work."],
    story: "Workwear for railroad men, cut from heavy duck canvas. The same tough cloth and plain fits now live as much on the street as on the job.",
  },
};

const key = (brand: string) => brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A brand's world, or none (it wears the Vault's cold blue). */
export const brandWorld = (brand?: string): BrandWorld | null => (brand ? (WORLDS[key(brand)] ?? null) : null);

/** The CSS variables for a theme, to put on a wrapper. */
export function themeVars(t: Theme = COLD): CSSProperties {
  return { "--v-frost": t.frost, "--v-slate": t.slate, "--v-tile": t.tile, "--v-deep": t.deep, "--v-ink": t.ink, "--v-dim": t.dim } as CSSProperties;
}

/** A tile with two corners cut, like the reference's inventory cards. */
export const NOTCH = "[clip-path:polygon(0_0,calc(100%-18px)_0,100%_18px,100%_100%,18px_100%,0_calc(100%-18px))]";

export const two = (n: number) => String(n).padStart(2, "0");
