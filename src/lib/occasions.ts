// "Designer Fits": ready fits by occasion, picked from what's live on the rack.
// Each occasion holds three fits (Party: night out, house party, birthday); a fit is two to
// four pieces, and its colours lean dark or light to suit it.

import type { Category, Product, Size } from "./types";

type Tone = "dark" | "light" | "mixed";

/**
 * The six occasions the store launches with (docs/BLUEPRINT.md, section 07), each with three
 * fits. A fit says which kinds of piece make it up (one per place on the body) and its tone.
 * The first fit of an occasion keeps the occasion's own key.
 */
const PLAN = [
  {
    key: "party",
    label: "Party",
    fits: [
      { key: "party", label: "Night out", slots: [["jackets"], ["tees"], ["bottoms"]], tone: "dark" },
      { key: "party-house", label: "House party", slots: [["hoodies"], ["bottoms"], ["accessories"]], tone: "dark" },
      { key: "party-birthday", label: "Birthday", slots: [["tees", "co-ords"], ["bottoms"], ["jackets"]], tone: "mixed" },
    ],
  },
  {
    key: "date",
    label: "Date",
    fits: [
      { key: "date", label: "Dinner", slots: [["jackets"], ["tees"], ["bottoms"]], tone: "dark" },
      { key: "date-coffee", label: "Coffee", slots: [["tees", "hoodies"], ["bottoms"], ["accessories"]], tone: "light" },
      { key: "date-movie", label: "Movie night", slots: [["hoodies"], ["bottoms"]], tone: "mixed" },
    ],
  },
  {
    key: "college",
    label: "College",
    fits: [
      { key: "college", label: "Class day", slots: [["hoodies", "tees"], ["bottoms"], ["accessories"]], tone: "mixed" },
      { key: "college-presentation", label: "Presentation", slots: [["jackets"], ["tees"], ["bottoms"]], tone: "light" },
      { key: "college-fest", label: "Fest", slots: [["tees"], ["bottoms"], ["jackets"], ["accessories"]], tone: "dark" },
    ],
  },
  {
    key: "cafe",
    label: "Café",
    fits: [
      { key: "cafe", label: "Brunch", slots: [["tees", "co-ords"], ["bottoms"], ["accessories"]], tone: "light" },
      { key: "cafe-laptop", label: "Laptop day", slots: [["hoodies"], ["bottoms"]], tone: "mixed" },
      { key: "cafe-evening", label: "Evening", slots: [["jackets"], ["tees"], ["bottoms"]], tone: "mixed" },
    ],
  },
  {
    key: "dashain",
    label: "Dashain",
    fits: [
      { key: "dashain", label: "Tika day", slots: [["jackets"], ["tees"], ["bottoms"]], tone: "light" },
      { key: "dashain-family", label: "Family visit", slots: [["hoodies", "tees"], ["bottoms"], ["jackets"]], tone: "mixed" },
      { key: "dashain-travel", label: "Travel home", slots: [["hoodies"], ["bottoms"], ["accessories"]], tone: "dark" },
    ],
  },
  {
    key: "weekend",
    label: "Weekend",
    fits: [
      { key: "weekend", label: "Easy day", slots: [["tees", "hoodies"], ["bottoms"], ["accessories"]], tone: "mixed" },
      { key: "weekend-roadtrip", label: "Road trip", slots: [["hoodies"], ["bottoms"], ["accessories"]], tone: "mixed" },
      { key: "weekend-ride", label: "Bike ride", slots: [["jackets"], ["tees"], ["bottoms"], ["accessories"]], tone: "dark" },
    ],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  fits: readonly { key: string; label: string; slots: readonly (readonly Category[])[]; tone: Tone }[];
}[];

/** One fit inside an occasion, e.g. "party-house". */
export type OccasionKey = (typeof PLAN)[number]["fits"][number]["key"];

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
  /** The fit's own name inside its occasion: "Night out". */
  label: string;
  /** The occasion it belongs to: "party", "Party". */
  group: string;
  groupLabel: string;
  /** Set by the owner in /admin/looks, not picked by the site. */
  curated: boolean;
  pieces: LookPiece[];
}

/** What the owner picked per fit in /admin/looks: up to four pieces, each in a colour. */
export type SavedLooks = Partial<Record<OccasionKey, { place?: string; pieces: { slug: string; colour: string }[] }>>;

/** Every fit the owner can set, named with its occasion: "Party · Night out". */
export const OCCASIONS: { key: OccasionKey; label: string }[] = PLAN.flatMap((g) => g.fits.map((f) => ({ key: f.key, label: `${g.label} · ${f.label}` })));

const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function toPiece(p: Product, tone: Tone, slot: number, pickedColour?: string): LookPiece | null {
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

/**
 * The fits to show, in occasion order. A fit the owner set in /admin/looks is used as set;
 * the rest are picked from the rack. `curated` is true only when every fit shown is the
 * owner's, so the page says "curated" only when that is so.
 */
export function designerFits(products: Product[], saved: SavedLooks = {}): { looks: Look[]; curated: boolean } {
  const live = products.filter((p) => p.status === "live" && p.variants.some((v) => v.stock > 0));
  const looks: Look[] = [];
  const seen = new Set<string>(); // no two fits with exactly the same pieces
  let n = 0;
  for (const group of PLAN) {
    for (const plan of group.fits) {
      const i = n++;
      const base = { key: plan.key, label: plan.label, group: group.key, groupLabel: group.label };
      // The owner's fit, when at least two of its pieces are live and in stock.
      const mine = saved[plan.key];
      if (mine && mine.pieces.length) {
        const pieces = mine.pieces.flatMap((x, slot) => {
          const p = live.find((q) => q.slug === x.slug);
          const piece = p && toPiece(p, plan.tone, slot, x.colour);
          return piece ? [piece] : [];
        });
        if (pieces.length >= 2) {
          looks.push({ ...base, curated: true, pieces });
          continue;
        }
      }
      // Picked from the rack: rotate through the options so fits differ, and try the next
      // rotation when that lands on a fit already shown.
      let pieces: LookPiece[] = [];
      for (let turn = 0; turn < 4; turn++) {
        const used = new Set<string>();
        pieces = [];
        plan.slots.forEach((cats, slot) => {
          // Vault pieces are only in a fit when the owner puts them there.
          const options = live.filter((p) => !p.vault && (cats as readonly Category[]).includes(p.category) && !used.has(p.slug));
          if (options.length === 0) return;
          const p = options[(i + turn + (turn ? slot : 0)) % options.length];
          const piece = toPiece(p, plan.tone, slot);
          if (!piece) return;
          used.add(p.slug);
          pieces.push(piece);
        });
        if (!seen.has(signature(pieces))) break;
      }
      if (pieces.length >= 2 && !seen.has(signature(pieces))) {
        seen.add(signature(pieces));
        looks.push({ ...base, curated: false, pieces });
      }
    }
  }
  return { looks, curated: looks.length > 0 && looks.every((l) => l.curated) };
}

function signature(pieces: LookPiece[]) {
  return pieces.map((p) => `${p.slug}~${p.colour}`).sort().join("|");
}

/** Which /fit slot a category goes in, for "Build your own fit". */
export function fitSlot(category: Category): "top" | "bottom" | "layer" | "cap" {
  if (category === "bottoms") return "bottom";
  if (category === "jackets") return "layer";
  if (category === "accessories") return "cap";
  return "top";
}
