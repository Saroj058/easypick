import { categoryLabels } from "./site";
import type { Product } from "./types";

// Instant search over the (small) catalogue, in the browser. Forgiving about the
// way people actually type: "hudi", "jogar", "tshirt", a missing letter, a typo.

/** Words people type → the word used on the site. */
const ALIASES: Record<string, string> = {
  hudi: "hoodie",
  hoody: "hoodie",
  hoodi: "hoodie",
  hudy: "hoodie",
  jogar: "jogger",
  joggar: "jogger",
  joger: "jogger",
  trackpant: "jogger",
  tshirt: "tee",
  tshirts: "tee",
  tshrt: "tee",
  tisat: "tee",
  shirt: "tee",
  pant: "pant",
  pants: "pant",
  paint: "pant",
  trouser: "pant",
  jeans: "jean",
  denim: "jean",
  hat: "cap",
  topi: "cap",
  jaket: "jacket",
  jacekt: "jacket",
  coord: "co-ord",
  coords: "co-ord",
  set: "co-ord",
  sweatshirt: "crewneck",
  sweater: "crewneck",
  kalo: "black",
  seto: "white",
};

const CATEGORY_WORDS: Record<string, string[]> = {
  tees: ["tee", "tees", "t-shirt", "top"],
  hoodies: ["hoodie", "hoodies", "top"],
  jackets: ["jacket", "jackets", "outerwear"],
  bottoms: ["bottom", "bottoms", "pant", "trouser"],
  "co-ords": ["co-ord", "set", "matching"],
  accessories: ["accessory", "accessories"],
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim();

function words(p: Product): string[] {
  const text = [p.name, categoryLabels[p.category], ...(CATEGORY_WORDS[p.category] ?? []), ...p.colours.map((c) => c.name), p.fit, p.gender, ...p.tags].join(" ");
  return Array.from(new Set(norm(text).split(/[\s-]+/).filter(Boolean)));
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** How well one typed word matches one product word: 3 exact/start, 1 close typo, 0 no. */
function wordScore(typed: string, word: string) {
  if (word.startsWith(typed)) return 3;
  if (typed.length < 4) return 0; // short words: only exact starts, or "tee" matches half the catalogue
  const allowed = typed.length >= 6 ? 2 : 1;
  if (distance(typed, word) <= allowed) return 1;
  // A typo in what they've typed so far: compare with the start of the word.
  if (word.length > typed.length && distance(typed, word.slice(0, typed.length)) <= allowed) return 1;
  return 0;
}

export function queryTokens(query: string) {
  return norm(query)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((t) => ALIASES[t] ?? t);
}

/** Products matching every typed word, best first. An empty query returns them all. */
export function searchProducts(products: Product[], query: string): Product[] {
  const tokens = queryTokens(query);
  if (!tokens.length) return products;
  return products
    .map((p) => {
      const ws = words(p);
      let score = 0;
      for (const t of tokens) {
        const best = Math.max(0, ...ws.map((w) => wordScore(t, w)));
        if (best === 0) return null;
        score += best;
      }
      if (p.status !== "live") score -= 0.5; // what they can buy now comes first
      return { p, score };
    })
    .filter((x): x is { p: Product; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}
