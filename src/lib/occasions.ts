// "Designer Fits": ready fits by occasion, picked from what's live on the rack.
// Each occasion holds three fits (Party: night out, house party, birthday); a fit is two to
// four pieces, and its colours lean dark or light to suit it.

import { RACK_CUTOUTS } from "./rack-cutouts";
import type { Category, Product, Size } from "./types";
import { isBottom } from "./site";

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
      { key: "party", label: "Night out", note: "Dark, sharp, made for late.", slots: [["jackets"], ["tees", "shirts", "polos"], ["jeans", "trousers", "joggers", "shorts"]], tone: "dark" },
      { key: "party-house", label: "House party", note: "Easy enough to dance in.", slots: [["hoodies", "sweatshirts"], ["jeans", "trousers", "joggers", "shorts"], ["accessories"]], tone: "dark" },
      { key: "party-birthday", label: "Birthday", note: "Your day. Dress a bit louder.", slots: [["tees", "shirts", "polos", "co-ords"], ["jeans", "trousers", "joggers", "shorts"], ["jackets"]], tone: "mixed" },
    ],
  },
  {
    key: "date",
    label: "Date",
    fits: [
      { key: "date", label: "Dinner", note: "Sharp without trying too hard.", slots: [["jackets"], ["tees", "shirts", "polos"], ["jeans", "trousers", "joggers", "shorts"]], tone: "dark" },
      { key: "date-coffee", label: "Coffee", note: "Light colours for a daylight date.", slots: [["tees", "shirts", "polos", "hoodies", "sweatshirts"], ["jeans", "trousers", "joggers", "shorts"], ["accessories"]], tone: "light" },
      { key: "date-movie", label: "Movie night", note: "Comfy for the back row.", slots: [["hoodies", "sweatshirts"], ["jeans", "trousers", "joggers", "shorts"]], tone: "mixed" },
    ],
  },
  {
    key: "college",
    label: "College",
    fits: [
      { key: "college", label: "Class day", note: "First class to last, no fuss.", slots: [["hoodies", "sweatshirts", "tees", "shirts", "polos"], ["jeans", "trousers", "joggers", "shorts"], ["accessories"]], tone: "mixed" },
      { key: "college-presentation", label: "Presentation", note: "Clean lines, quiet confidence.", slots: [["jackets"], ["tees", "shirts", "polos"], ["jeans", "trousers", "joggers", "shorts"]], tone: "light" },
      { key: "college-fest", label: "Fest", note: "Built for a long day out.", slots: [["tees", "shirts", "polos"], ["jeans", "trousers", "joggers", "shorts"], ["jackets"], ["accessories"]], tone: "dark" },
    ],
  },
  {
    key: "cafe",
    label: "Café",
    fits: [
      { key: "cafe", label: "Brunch", note: "Fresh, light, unhurried.", slots: [["tees", "shirts", "polos", "co-ords"], ["jeans", "trousers", "joggers", "shorts"], ["accessories"]], tone: "light" },
      { key: "cafe-laptop", label: "Laptop day", note: "Comfy for hours at a table.", slots: [["hoodies", "sweatshirts"], ["jeans", "trousers", "joggers", "shorts"]], tone: "mixed" },
      { key: "cafe-evening", label: "Evening", note: "One more layer for when it cools.", slots: [["jackets"], ["tees", "shirts", "polos"], ["jeans", "trousers", "joggers", "shorts"]], tone: "mixed" },
    ],
  },
  {
    key: "dashain",
    label: "Dashain",
    fits: [
      { key: "dashain", label: "Tika day", note: "Neat and bright for the family.", slots: [["jackets"], ["tees", "shirts", "polos"], ["jeans", "trousers", "joggers", "shorts"]], tone: "light" },
      { key: "dashain-family", label: "Family visit", note: "Smart, but floor-sitting friendly.", slots: [["hoodies", "sweatshirts", "tees", "shirts", "polos"], ["jeans", "trousers", "joggers", "shorts"], ["jackets"]], tone: "mixed" },
      { key: "dashain-travel", label: "Travel home", note: "Easy for the long bus ride home.", slots: [["hoodies", "sweatshirts"], ["jeans", "trousers", "joggers", "shorts"], ["accessories"]], tone: "dark" },
    ],
  },
  {
    key: "weekend",
    label: "Weekend",
    fits: [
      { key: "weekend", label: "Easy day", note: "Nothing to think about.", slots: [["tees", "shirts", "polos", "hoodies", "sweatshirts"], ["jeans", "trousers", "joggers", "shorts"], ["accessories"]], tone: "mixed" },
      { key: "weekend-roadtrip", label: "Road trip", note: "Made for the passenger seat.", slots: [["hoodies", "sweatshirts"], ["jeans", "trousers", "joggers", "shorts"], ["accessories"]], tone: "mixed" },
      { key: "weekend-ride", label: "Bike ride", note: "Dark, easy to move in.", slots: [["jackets"], ["tees", "shirts", "polos"], ["jeans", "trousers", "joggers", "shorts"], ["accessories"]], tone: "dark" },
    ],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  fits: readonly { key: string; label: string; note: string; slots: readonly (readonly Category[])[]; tone: Tone }[];
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
  /** The piece cut out on transparent (public/rack), when it's photographed in this colour. */
  cutout?: string;
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
  /** One short line about the fit: "Dark, sharp, made for late." */
  note: string;
  /** A photo of the fit being worn, uploaded in /admin/looks. Only on a fit the owner set (so it shows these pieces). */
  photo?: string;
  pieces: LookPiece[];
}

/** What the owner picked per fit in /admin/looks: up to four pieces, each in a colour. */
export type SavedLooks = Partial<Record<OccasionKey, { place?: string; pieces: { slug: string; colour: string }[]; /** The fit worn, photographed. */ photo?: string }>>;

/** Every fit the owner can set, named with its occasion: "Party · Night out". */
export const OCCASIONS: { key: OccasionKey; label: string }[] = PLAN.flatMap((g) => g.fits.map((f) => ({ key: f.key, label: `${g.label} · ${f.label}` })));

const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Colours that go with anything. */
const NEUTRAL = /(black|white|ivory|bone|cream|stone|sand|ash|charcoal|grey|gray|navy|indigo|slate|off-white|ecru|oat|denim)/i;

/**
 * A piece in the colour its place in the fit calls for (a stylist's rule, owner's review 16 Oct
 * 2026): the jacket darkest; a top under a jacket the lightest neutral; trousers the darkest
 * neutral; a cap dark. A top worn alone follows the fit's tone. When the photographed colour (the
 * first) is close enough, it wins, so the lay shows the real thing. `role` "any" (swapping) takes
 * the photographed colour.
 */
function toPiece(p: Product, tone: Tone, role: "top" | "bottom" | "layer" | "cap" | "any", pickedColour?: string, layered = false): LookPiece | null {
  const inStock = p.colours.filter((c) => p.variants.some((v) => v.colour === c.name && v.stock > 0));
  if (inStock.length === 0) return null;
  const byLight = [...inStock].sort((a, b) => luminance(a.hex) - luminance(b.hex));
  const neutral = byLight.filter((c) => NEUTRAL.test(c.name));
  const darkest = (list: typeof byLight) => list[0];
  const lightest = (list: typeof byLight) => list[list.length - 1];
  let want = byLight[0];
  if (role === "any") want = inStock.find((c) => c.name === p.colours[0]?.name) ?? byLight[0];
  else if (role === "layer" || role === "cap") want = darkest(byLight);
  else if (role === "bottom") want = darkest(neutral.length ? neutral : byLight);
  else if (layered) want = lightest(neutral.length ? neutral : byLight);
  else want = tone === "dark" ? darkest(byLight) : tone === "light" ? lightest(byLight) : lightest(neutral.length ? neutral : byLight);
  const first = inStock.find((c) => c.name === p.colours[0]?.name);
  if (first && Math.abs(luminance(first.hex) - luminance(want.hex)) < 0.15) want = first;
  const colour = inStock.find((c) => c.name === pickedColour) ?? want;
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
    // The cut-out shows the product's first colour.
    ...(RACK_CUTOUTS.has(p.slug) && colour.name === p.colours[0]?.name ? { cutout: `/rack/${p.slug}.webp` } : {}),
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
      const base = { key: plan.key, label: plan.label, note: plan.note, group: group.key, groupLabel: group.label };
      // The owner's fit, when at least two of its pieces are live and in stock.
      const mine = saved[plan.key];
      if (mine && mine.pieces.length) {
        const pieces = mine.pieces.flatMap((x) => {
          const p = live.find((q) => q.slug === x.slug);
          const piece = p && toPiece(p, plan.tone, fitSlot(p.category), x.colour);
          return piece ? [piece] : [];
        });
        if (pieces.length >= 2) {
          // The photo shows the pieces the owner set: only shown while all of them are still in it.
          const photo = mine.photo && pieces.length === mine.pieces.length ? mine.photo : undefined;
          looks.push({ ...base, curated: true, pieces, ...(photo ? { photo } : {}) });
          continue;
        }
      }
      // Picked from the rack: rotate through the options so fits differ, and try the next
      // rotation when that lands on a fit already shown.
      let pieces: LookPiece[] = [];
      for (let turn = 0; turn < 4; turn++) {
        const used = new Set<string>();
        pieces = [];
        const layered = plan.slots.some((cats) => (cats as readonly Category[]).includes("jackets"));
        plan.slots.forEach((cats, slot) => {
          // A co-ord set is top and bottom in one: no second pair of trousers with it.
          if ((cats as readonly Category[]).some(isBottom) && pieces.some((x) => x.category === "co-ords")) return;
          // Vault pieces are only in a fit when the owner puts them there.
          const options = live.filter((p) => !p.vault && (cats as readonly Category[]).includes(p.category) && !used.has(p.slug));
          if (options.length === 0) return;
          const p = options[(i + turn + (turn ? slot : 0)) % options.length];
          const piece = toPiece(p, plan.tone, fitSlot(p.category), undefined, layered);
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

/** Every piece that can go in a fit, by place on the body, for swapping one piece of a fit. */
export function swapOptions(products: Product[]): Record<"top" | "bottom" | "layer" | "cap", LookPiece[]> {
  const out: Record<"top" | "bottom" | "layer" | "cap", LookPiece[]> = { top: [], bottom: [], layer: [], cap: [] };
  for (const p of products) {
    if (p.status !== "live" || p.vault) continue;
    const piece = toPiece(p, "dark", "any");
    if (piece) out[fitSlot(p.category)].push(piece);
  }
  return out;
}

/** Which /fit slot a category goes in, for "Build your own fit". */
export function fitSlot(category: Category): "top" | "bottom" | "layer" | "cap" {
  if (isBottom(category)) return "bottom";
  if (category === "jackets") return "layer";
  if (category === "accessories") return "cap";
  return "top";
}
