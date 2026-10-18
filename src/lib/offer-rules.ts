import type { Product } from "./types";

// Festival offers (owner, 18 Oct 2026): two or three named sales at once, each its own card and
// page. An offer adds no new pricing: it gathers pieces that already have a sale price, by a tag
// the owner ticks on the piece (e.g. "dashain-offer") or by a price ceiling. Pure, so the admin,
// the site and the tests share it.

export interface Offer {
  /** Short and stable: the link is /shop?offer=<id>. */
  id: string;
  name: string;
  /** One line under the name. */
  note: string;
  /** Pieces carrying this tag (ticked on the piece in the admin). None: every piece on sale. */
  tag: string | null;
  /** Only pieces whose sale price is under this, in rupees. */
  under: number | null;
  /** Last day, YYYY-MM-DD (Kathmandu). None: until switched off. */
  endsOn: string | null;
  on: boolean;
}

export const MAX_OFFERS = 3;

export const DEFAULT_OFFERS: Offer[] = [
  { id: "dashain", name: "Dashain sale", note: "Warm layers and Tika-day pieces, marked down.", tag: "dashain-offer", under: null, endsOn: null, on: true },
  { id: "tihar", name: "Tihar lights", note: "Deep colours for the festival of lights.", tag: "tihar-offer", under: null, endsOn: null, on: true },
  { id: "under-1000", name: "Under Rs 1,000", note: "Every marked-down piece under a thousand.", tag: null, under: 1000, endsOn: null, on: true },
];

/** Whether a piece is in an offer: live, on sale, not the Vault, and matching its tag and ceiling. */
export function inOffer(offer: Offer, p: Product): boolean {
  if (p.status !== "live" || !p.salePrice || p.vault) return false;
  if (offer.tag && !p.tags.includes(offer.tag)) return false;
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
    .filter((o) => running(o, today))
    .map((offer) => {
      const pieces = products.filter((p) => inOffer(offer, p));
      const upTo = pieces.reduce((n, p) => Math.max(n, Math.round((1 - (p.salePrice ?? p.price) / p.price) * 100)), 0);
      return { offer, count: pieces.length, upTo };
    })
    .filter((s) => s.count > 0);
}

/** A saved list, cleaned: known fields only, at most three, ids unique. Falls back to the defaults. */
export function cleanOffers(raw: unknown): Offer[] {
  if (!Array.isArray(raw)) return DEFAULT_OFFERS;
  const out: Offer[] = [];
  for (const r of raw.slice(0, MAX_OFFERS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) : "";
    const name = typeof o.name === "string" ? o.name.trim().slice(0, 40) : "";
    if (!id || !name || out.some((x) => x.id === id)) continue;
    out.push({
      id,
      name,
      note: typeof o.note === "string" ? o.note.trim().slice(0, 120) : "",
      tag: typeof o.tag === "string" && o.tag.trim() ? o.tag.trim().toLowerCase().slice(0, 30) : null,
      under: typeof o.under === "number" && o.under > 0 ? Math.round(o.under) : null,
      endsOn: typeof o.endsOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.endsOn) ? o.endsOn : null,
      on: o.on !== false,
    });
  }
  return out;
}
