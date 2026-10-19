import { formatPrice } from "@/lib/format";
import { inOffer, liveOffers, type Offer } from "@/lib/offer-rules";
import type { Product } from "@/lib/types";
import { OfferExplorer, type OfferPiece } from "./offer-explorer";

/** How many of an offer's pieces show when it opens; "Shop all" opens the rest in the shop. */
const SHOWN = 12;

const cut = (p: Product) => Math.round((1 - (p.salePrice ?? p.price) / p.price) * 100);

/**
 * The festival offers: the running ones as a stack of cards, each opening onto a row of its own
 * pieces (biggest cut first). Everything the client needs is worked out here; each product is sent
 * once even when it's in several offers.
 */
export function OfferSection({ offers, products, today, start }: { offers: Offer[]; products: Product[]; today: string; start?: string }) {
  const list = liveOffers(offers, products, today);
  if (!list.length) return null;
  const pieces: Record<string, OfferPiece[]> = {};
  const used = new Map<string, Product>();
  for (const s of list) {
    pieces[s.offer.id] = products
      .filter((p) => inOffer(s.offer, p))
      .sort((a, b) => cut(b) - cut(a))
      .slice(0, SHOWN)
      .map((p) => {
        used.set(p.id, p);
        return { id: p.id, slug: p.slug, name: p.name, price: formatPrice(p.salePrice ?? p.price), was: formatPrice(p.price), off: cut(p) };
      });
  }
  return <OfferExplorer offers={list} pieces={pieces} products={Object.fromEntries(used)} start={start} />;
}
