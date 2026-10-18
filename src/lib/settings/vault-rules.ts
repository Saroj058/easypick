import { brandKey, COLD, DEFAULT_WORLDS, type BrandWorld, type Theme } from "@/components/vault/look";
import { obj, text } from "./clean";

// The Vault as the owner sets it in Admin → The Vault (owner, 18 Oct 2026): each brand's colours,
// origin, line and story; the Vault's own cold blue; the page's words; and which pieces it features
// first. Pure, so the admin's live preview and the site use the same rules.

export interface VaultSettings {
  /** Keyed by brandKey(name), e.g. "new-balance". */
  brands: Record<string, BrandWorld>;
  cold: Theme;
  copy: { intro: string; left: [string, string]; right: [string, string]; listTitle: string; listNote: string };
  /** Slugs to put first in the hero, in order; the rest are picked as before. */
  featured: string[];
}

export const DEFAULT_VAULT: VaultSettings = {
  brands: DEFAULT_WORLDS,
  cold: COLD,
  copy: {
    intro: "Original brands, one of each. Checked by hand, never restocked, gone when it's gone.",
    left: ["Not for many.", "For the few."],
    right: ["Checked by hand.", "Never restocked."],
    listTitle: "Hear it first.",
    listNote: "One message when a new piece lands. Stop anytime.",
  },
  featured: [],
};

const THEME_KEYS = ["frost", "slate", "tile", "deep", "ink", "dim"] as const;
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback);

function theme(v: unknown, fallback: Theme): Theme {
  const o = obj(v);
  return Object.fromEntries(THEME_KEYS.map((k) => [k, hex(o[k], fallback[k])])) as unknown as Theme;
}

function pair(v: unknown, fallback: [string, string], max = 40): [string, string] {
  const a = Array.isArray(v) ? v : [];
  return [text(a[0], fallback[0], max), text(a[1], fallback[1], max)];
}

export function cleanVault(raw: unknown): VaultSettings {
  const r = obj(raw);
  const d = DEFAULT_VAULT;
  const brands: Record<string, BrandWorld> = {};
  const saved = obj(r.brands);
  const keys = Object.keys(saved).length ? Object.keys(saved) : Object.keys(d.brands);
  for (const k of keys.slice(0, 40)) {
    const key = brandKey(k);
    if (!key) continue;
    const b = obj(saved[k]);
    const base = d.brands[key] ?? { theme: COLD, origin: "", line: ["", ""] as [string, string], story: "" };
    brands[key] = Object.keys(b).length
      ? { theme: theme(b.theme, base.theme), origin: text(b.origin, base.origin, 60), line: pair(b.line, base.line), story: text(b.story, base.story, 400) }
      : base;
  }
  const c = obj(r.copy);
  return {
    brands,
    cold: theme(r.cold, d.cold),
    copy: {
      intro: text(c.intro, d.copy.intro, 200),
      left: pair(c.left, d.copy.left),
      right: pair(c.right, d.copy.right),
      listTitle: text(c.listTitle, d.copy.listTitle, 60) || d.copy.listTitle,
      listNote: text(c.listNote, d.copy.listNote, 160),
    },
    featured: Array.isArray(r.featured) ? [...new Set(r.featured.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 80)))].slice(0, 5) : [],
  };
}

// ---------- Contrast (WCAG) for the live preview ----------

function lum(h: string) {
  const n = parseInt(h.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** The contrast ratio between two colours, 1–21. */
export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 10) / 10;
}

/** The pairings the Vault uses, each with the ratio it needs: small text 4.5, big headlines 3. */
export function themeChecks(t: Theme): { label: string; ratio: number; need: number }[] {
  return [
    { label: "White on panel", ratio: contrast("#ffffff", t.slate), need: 4.5 },
    { label: "Quiet text on panel", ratio: contrast(t.dim, t.slate), need: 4.5 },
    { label: "Text on tiles", ratio: contrast(t.ink, t.tile), need: 4.5 },
    { label: "Text on page", ratio: contrast(t.ink, t.frost), need: 4.5 },
    { label: "Headline on page", ratio: contrast(t.deep, t.frost), need: 3 },
  ];
}
