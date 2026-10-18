import Link from "next/link";

import { inOffer, liveOffers, offerStacks, type Offer } from "@/lib/offer-rules";
import { site } from "@/lib/site";
import type { Product } from "@/lib/types";
import { OfferOrbit, type OfferPicture } from "./offer-orbit";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short" });

/**
 * The festival offers (owner, 18 Oct 2026): the cards in orbit, and under them every offer written
 * out in its group (festivals, by price, by kind), each with its cut, how many pieces and when it
 * ends, as a link to it in the shop.
 */
export function OfferBoard({ offers: all, products, today, active }: { offers: Offer[]; products: Product[]; today: string; active?: string }) {
  const offers = liveOffers(all, products, today);
  if (!offers.length) return null;
  const pictures: Record<string, OfferPicture | undefined> = {};
  for (const s of offers) {
    const p = products.find((x) => inOffer(s.offer, x) && x.images[0]);
    if (p) pictures[s.offer.id] = { image: p.images[0], category: p.category, hex: p.colours[0]?.hex ?? "#888" };
  }
  const groups = offerStacks(offers);

  return (
    <div>
      <OfferOrbit offers={offers} pictures={pictures} />
      <div className={`mt-10 grid gap-x-10 gap-y-8 md:mt-14 ${groups.length > 2 ? "md:grid-cols-3" : groups.length === 2 ? "md:grid-cols-2" : ""}`}>
        {groups.map((g) => (
          <section key={g.group} aria-label={g.group}>
            <h3 className="border-b border-ink pb-2 font-mono text-[11px] uppercase tracking-[0.14em]">{g.group}</h3>
            <ul>
              {g.offers.map(({ offer, count, upTo }) => (
                <li key={offer.id}>
                  <Link
                    href={`/shop?offer=${offer.id}`}
                    aria-current={active === offer.id ? "true" : undefined}
                    className={`group flex items-center gap-4 border-b border-ink/10 py-4 transition-colors ${active === offer.id ? "bg-ink/[0.04]" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="display block text-[24px] leading-none transition-transform duration-300 group-hover:translate-x-1">{offer.name}</span>
                      <span className="mt-1 block truncate text-[13px] text-steel-dark">{offer.note}</span>
                      <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-steel-dark">
                        Up to {upTo}% off · {count} {count === 1 ? "piece" : "pieces"}
                        {offer.endsOn ? ` · ends ${day.format(new Date(`${offer.endsOn}T12:00:00+05:45`))}` : ""}
                      </span>
                    </span>
                    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/15 transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
