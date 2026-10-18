import { formatPrice } from "@/lib/format";
import { inOffer, liveOffers, type Offer } from "@/lib/offer-rules";
import type { Product } from "@/lib/types";
import { OfferExplorer } from "./offer-explorer";
import type { WheelItem } from "./offer-wheel";

/** How many of an offer's pieces ride the wheel; "See all" opens the rest in the shop. */
const ON_WHEEL = 16;

const cut = (p: Product) => Math.round((1 - (p.salePrice ?? p.price) / p.price) * 100);

/**
 * The festival offers: the running ones as a stack of cards, each opening onto a wheel of its own
 * pieces (biggest cut first). Everything the client needs is worked out here.
 */
export function OfferSection({ offers, products, today, start }: { offers: Offer[]; products: Product[]; today: string; start?: string }) {
  const list = liveOffers(offers, products, today);
  if (!list.length) return null;
  const items: Record<string, WheelItem[]> = {};
  for (const s of list) {
    items[s.offer.id] = products
      .filter((p) => inOffer(s.offer, p))
      .sort((a, b) => cut(b) - cut(a))
      .slice(0, ON_WHEEL)
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: formatPrice(p.salePrice ?? p.price),
        was: formatPrice(p.price),
        off: cut(p),
        image: p.images[0] ?? { src: null, alt: p.name, kind: "front" },
        category: p.category,
        hex: p.colours[0]?.hex ?? "#888",
      }));
  }
  return <OfferExplorer offers={list} products={items} start={start} />;
}
