import { categoryLabels } from "../site";
import type { Category } from "../types";
import { bool, label, num, numbers, obj, pick, text } from "./clean";

// The home page, as the owner sets it in Admin → Home page (owner, 18 Oct 2026): which sections
// show and in what order, and every line of copy on it. The defaults are the page as it was built,
// so a fresh database shows exactly that. Pure: the admin form, the page and the tests share it.

export const HOME_SECTIONS = ["hero", "rail", "fits", "offers", "vault", "gift", "store", "checkout", "track"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

export const SECTION_NAMES: Record<HomeSection, string> = {
  hero: "Hero (the piece and the drop)",
  rail: "The rail (products)",
  fits: "Designer Fits",
  offers: "Pick your offer",
  vault: "The Vault",
  gift: "Buying for someone?",
  store: "Our store",
  checkout: "Self-checkout",
  track: "Track an order",
};

const KINDS = Object.keys(categoryLabels) as Category[];

export interface RailBay {
  name: string;
  caption: string;
  kinds: Category[];
}

export interface HomeSettings {
  sections: { id: HomeSection; on: boolean }[];
  hero: {
    eyebrow: string;
    /** Shown when there's no drop: two lines. */
    fallback: [string, string];
    pitch: string;
    pitchQuiet: string;
    line1: string;
    line2: string;
    visitLabel: string;
    /** "{n}" becomes the drop number. */
    dropButton: string;
    noDropButton: string;
    /** Kinds taken in turn for the row of pieces. */
    kinds: Category[];
    showUnavailable: boolean;
    seconds: number;
  };
  rail: { title: string; budgets: number[]; perSection: number; bays: RailBay[] };
  fits: { title: string; button: string };
  offers: { eyebrow: string; title: string; line: string };
  vault: { title: string; line: string; button: string };
  gift: { title: string; line: string; send: string; cards: string };
  track: { title: string; line: string };
}

export const DEFAULT_HOME: HomeSettings = {
  sections: HOME_SECTIONS.map((id) => ({ id, on: true })),
  hero: {
    eyebrow: "Pick it. Pay it. Wear it.",
    fallback: ["Pick it.", "Wear it."],
    pitch: "Shopping shouldn't feel like negotiation.",
    pitchQuiet: "That's why we built Easypick.",
    line1: "Fixed prices. Automated checkout.",
    line2: "Same price online and in-store.",
    visitLabel: "Visit store",
    dropButton: "Shop Drop {n}",
    noDropButton: "See the drops",
    kinds: ["hoodies", "tees", "jackets", "joggers", "shirts", "jeans", "sweatshirts", "polos", "trousers", "shorts", "co-ords", "accessories"],
    showUnavailable: true,
    seconds: 4,
  },
  rail: {
    title: "The rail",
    budgets: [1000, 1500, 2500],
    perSection: 4,
    bays: [
      { name: "Tops", caption: "Start on top", kinds: ["tees", "shirts", "polos", "co-ords"] },
      { name: "Layers", caption: "Layer up", kinds: ["hoodies", "sweatshirts", "jackets"] },
      { name: "Bottoms", caption: "Bottom half", kinds: ["jeans", "trousers", "joggers", "shorts"] },
      { name: "Extras", caption: "Finish", kinds: ["accessories"] },
    ],
  },
  fits: { title: "Designer Fits", button: "See the fits" },
  offers: { eyebrow: "Festival offers", title: "Pick your offer.", line: "Same price in store." },
  vault: { title: "The Vault", line: "Original brands. One of each. Never restocked.", button: "Enter the Vault" },
  gift: { title: "Buying for someone?", line: "You pick the piece. They pick the size. We wrap it and bring it.", send: "Send a gift", cards: "Gift cards" },
  track: { title: "Track an order.", line: "No account needed." },
};

function cleanSections(v: unknown): HomeSettings["sections"] {
  const out: HomeSettings["sections"] = [];
  if (Array.isArray(v))
    for (const r of v) {
      const o = obj(r);
      const id = o.id as HomeSection;
      if (HOME_SECTIONS.includes(id) && !out.some((x) => x.id === id)) out.push({ id, on: bool(o.on, true) });
    }
  // A section added in code later still appears, at the end, switched on.
  for (const id of HOME_SECTIONS) if (!out.some((x) => x.id === id)) out.push({ id, on: true });
  return out;
}

export function cleanHome(raw: unknown): HomeSettings {
  const r = obj(raw);
  const d = DEFAULT_HOME;
  const h = obj(r.hero);
  const fb = Array.isArray(h.fallback) ? h.fallback : [];
  const rl = obj(r.rail);
  const bays: RailBay[] = Array.isArray(rl.bays)
    ? rl.bays
        .slice(0, 8)
        .map((b) => {
          const o = obj(b);
          return { name: label(o.name, "Section", 40), caption: text(o.caption, "", 60), kinds: pick(o.kinds, KINDS, []) };
        })
        .filter((b) => b.kinds.length)
    : d.rail.bays;
  const sec = (k: keyof HomeSettings, fields: string[]) => {
    const o = obj(r[k]);
    const def = d[k] as unknown as Record<string, string>;
    return Object.fromEntries(fields.map((f) => [f, label(o[f], def[f], 140)]));
  };
  return {
    sections: cleanSections(r.sections),
    hero: {
      eyebrow: text(h.eyebrow, d.hero.eyebrow, 60),
      fallback: [label(fb[0], d.hero.fallback[0], 30), label(fb[1], d.hero.fallback[1], 30)],
      pitch: text(h.pitch, d.hero.pitch, 120),
      pitchQuiet: text(h.pitchQuiet, d.hero.pitchQuiet, 120),
      line1: text(h.line1, d.hero.line1, 80),
      line2: text(h.line2, d.hero.line2, 80),
      visitLabel: label(h.visitLabel, d.hero.visitLabel, 30),
      dropButton: label(h.dropButton, d.hero.dropButton, 30),
      noDropButton: label(h.noDropButton, d.hero.noDropButton, 30),
      kinds: (() => {
        const k = pick(h.kinds, KINDS, d.hero.kinds);
        return k.length ? k : d.hero.kinds;
      })(),
      showUnavailable: bool(h.showUnavailable, d.hero.showUnavailable),
      seconds: num(h.seconds, d.hero.seconds, 2, 20),
    },
    rail: {
      title: label(rl.title, d.rail.title, 30),
      budgets: numbers(rl.budgets, d.rail.budgets, 100, 100000, 5),
      perSection: num(rl.perSection, d.rail.perSection, 2, 12),
      bays: bays.length ? bays : d.rail.bays,
    },
    fits: sec("fits", ["title", "button"]) as HomeSettings["fits"],
    offers: sec("offers", ["eyebrow", "title", "line"]) as HomeSettings["offers"],
    vault: sec("vault", ["title", "line", "button"]) as HomeSettings["vault"],
    gift: sec("gift", ["title", "line", "send", "cards"]) as HomeSettings["gift"],
    track: sec("track", ["title", "line"]) as HomeSettings["track"],
  };
}
