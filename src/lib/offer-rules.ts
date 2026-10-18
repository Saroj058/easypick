import type { Category, Product } from "./types";

// Festival offers (owner, 18 Oct 2026): named sales, each its own card and page, shown as three
// stacks of cards side by side (left, middle, right), up to three offers in each. An offer adds no
// new pricing: it gathers pieces that already have a sale price, by a tag the owner ticks on the
// piece (e.g. "dashain-offer"), by kind, or by a price ceiling. Pure, so the admin, the site and the
// tests share it.

export interface Offer {
  /** Short and stable: the link is /shop?offer=<id>. */
  id: string;
  name: string;
  /** One line under the name. */
  note: string;
  /** Which stack it sits in, e.g. "Festivals". */
  group: string;
  /** Pieces carrying this tag (ticked on the piece in the admin). */
  tag: string | null;
  /** Only these kinds. */
  kinds: Category[] | null;
  /** Only pieces whose sale price is under this, in rupees. */
  under: number | null;
  /** Last day, YYYY-MM-DD (Kathmandu). None: until switched off. */
  endsOn: string | null;
  on: boolean;
}

export const MAX_OFFERS = 9;
/** The three stacks, in order: left, middle, right. */
export const OFFER_GROUPS = ["Festivals", "By price", "By kind"] as const;

const o = (id: string, name: string, note: string, group: string, rule: Partial<Pick<Offer, "tag" | "kinds" | "under">>): Offer => ({
  id,
  name,
  note,
  group,
  tag: rule.tag ?? null,
  kinds: rule.kinds ?? null,
  under: rule.under ?? null,
  endsOn: null,
  on: true,
});

export const DEFAULT_OFFERS: Offer[] = [
  o("dashain", "Dashain sale", "Warm layers and Tika-day pieces, marked down.", "Festivals", { tag: "dashain-offer" }),
  o("tihar", "Tihar lights", "Deep colours for the festival of lights.", "Festivals", { tag: "tihar-offer" }),
  o("festival-all", "Every festival price", "Everything marked down, in one place.", "Festivals", {}),
  o("under-1000", "Under Rs 1,000", "Every marked-down piece under a thousand.", "By price", { under: 1000 }),
  o("under-1500", "Under Rs 1,500", "Small price, full fit.", "By price", { under: 1500 }),
  o("under-2500", "Under Rs 2,500", "The middle of the range, marked down.", "By price", { under: 2500 }),
  o("tops", "Tops on sale", "Tees, shirts and polos.", "By kind", { kinds: ["tees", "shirts", "polos"] }),
  o("layers", "Layers on sale", "Hoodies, sweatshirts and jackets.", "By kind", { kinds: ["hoodies", "sweatshirts", "jackets"] }),
  o("bottoms", "Bottoms on sale", "Jeans, trousers, joggers and shorts.", "By kind", { kinds: ["jeans", "trousers", "joggers", "shorts"] }),
];

/** Whether a piece is in an offer: live, on sale, not the Vault, and matching its tag, kinds and ceiling. */
export function inOffer(offer: Offer, p: Product): boolean {
  if (p.status !== "live" || !p.salePrice || p.vault) return false;
  if (offer.tag && !p.tags.includes(offer.tag)) return false;
  if (offer.kinds?.length && !offer.kinds.includes(p.category)) return false;
  if (offer.under && !(p.salePrice < offer.under)) return false;
  return true;
}

/** Whether an offer runs on a given day (YYYY-MM-DD). */
export const running = (offer: Offer, today: string) => offer.on && (!offer.endsOn || offer.endsOn >= today);

export interface OfferSummary {
  offer: Offer;
  count: number;
  /** The biggest cut, as a percentage. */
  upTo: number;
}

/** The offers running today that have at least one piece, with how many and the biggest cut. */
export function liveOffers(offers: Offer[], products: Product[], today: string): OfferSummary[] {
  return offers
    .filter((x) => running(x, today))
    .map((offer) => {
      const pieces = products.filter((p) => inOffer(offer, p));
      const upTo = pieces.reduce((n, p) => Math.max(n, Math.round((1 - (p.salePrice ?? p.price) / p.price) * 100)), 0);
      return { offer, count: pieces.length, upTo };
    })
    .filter((s) => s.count > 0);
}

/** Running offers by stack, in the order the groups first appear, at most three stacks of three. */
export function offerStacks(list: OfferSummary[]): { group: string; offers: OfferSummary[] }[] {
  const out: { group: string; offers: OfferSummary[] }[] = [];
  for (const s of list) {
    const g = out.find((x) => x.group === s.offer.group);
    if (g) {
      if (g.offers.length < 3) g.offers.push(s);
    } else if (out.length < 3) out.push({ group: s.offer.group, offers: [s] });
  }
  return out;
}

const KINDS: Category[] = ["tees", "shirts", "polos", "hoodies", "sweatshirts", "jackets", "jeans", "trousers", "joggers", "shorts", "co-ords", "accessories"];

/** A saved list, cleaned: known fields only, at most nine, ids unique. Falls back to the defaults. */
export function cleanOffers(raw: unknown): Offer[] {
  if (!Array.isArray(raw)) return DEFAULT_OFFERS;
  const out: Offer[] = [];
  for (const r of raw.slice(0, MAX_OFFERS)) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const id = typeof x.id === "string" ? x.id.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) : "";
    const name = typeof x.name === "string" ? x.name.trim().slice(0, 40) : "";
    if (!id || !name || out.some((y) => y.id === id)) continue;
    const kinds = Array.isArray(x.kinds) ? x.kinds.filter((k): k is Category => typeof k === "string" && (KINDS as string[]).includes(k)) : [];
    out.push({
      id,
      name,
      note: typeof x.note === "string" ? x.note.trim().slice(0, 120) : "",
      group: typeof x.group === "string" && x.group.trim() ? x.group.trim().slice(0, 24) : OFFER_GROUPS[0],
      tag: typeof x.tag === "string" && x.tag.trim() ? x.tag.trim().toLowerCase().slice(0, 30) : null,
      kinds: kinds.length ? kinds : null,
      under: typeof x.under === "number" && x.under > 0 ? Math.round(x.under) : null,
      endsOn: typeof x.endsOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.endsOn) ? x.endsOn : null,
      on: x.on !== false,
    });
  }
  return out;
}
