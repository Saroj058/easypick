import { inOffer, liveOffers, type Offer } from "@/lib/offer-rules";
import type { Product } from "@/lib/types";
import { OfferOrbit, type OfferPicture } from "./offer-orbit";

/**
 * The festival offers in orbit (owner, 18 Oct 2026): every running offer as a card on the ring,
 * each with a piece from it for the photo cards. (The written list under it was taken out at the
 * owner's request the same day.)
 */
export function OfferBoard({ offers: all, products, today }: { offers: Offer[]; products: Product[]; today: string }) {
  const offers = liveOffers(all, products, today);
  if (!offers.length) return null;
  const pictures: Record<string, OfferPicture | undefined> = {};
  for (const s of offers) {
    const p = products.find((x) => inOffer(s.offer, x) && x.images[0]);
    if (p) pictures[s.offer.id] = { image: p.images[0], category: p.category, hex: p.colours[0]?.hex ?? "#888" };
  }

  return (
    <div>
      <OfferOrbit offers={offers} pictures={pictures} />
    </div>
  );
}
