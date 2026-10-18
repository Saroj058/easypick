import type { Metadata } from "next";
import Link from "next/link";

import { Countdown } from "@/components/countdown";
import { FitsTeaser } from "@/components/home/fits-teaser";
import { HeroPiece } from "@/components/hero-piece";
import { GiftBlock } from "@/components/home/gift-block";
import { FlowButton } from "@/components/ui/flow-button";
import { OurStore } from "@/components/home/our-store";
import { Rail } from "@/components/home/rail";
import { Vault } from "@/components/home/vault";

import { RefreshAt } from "@/components/refresh-at";
import { RevealRoot } from "@/components/reveal-root";
import { OfferBoard } from "@/components/offer-board";
import { OfferStack } from "@/components/offer-stack";
import { liveOffers } from "@/lib/offer-rules";
import { ktmDay } from "@/lib/ktm-day";
import { getOffers } from "@/lib/offers";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { SelfCheckout } from "@/components/self-checkout";
import { getStoreInfo } from "@/lib/store-info";
import { formatDropTime } from "@/lib/format";
import { TrackForm } from "@/app/track/track-form";
import { jsonLd } from "@/lib/json-ld";
import { RACK_CUTOUTS } from "@/lib/rack-cutouts";
import { site } from "@/lib/site";
import { getDropTimeline, getProducts } from "@/lib/store";
import { getSavedLooks } from "@/lib/looks";
import { designerFits } from "@/lib/occasions";

export const revalidate = 60;

// Concept: "the tag is the store". The page is built from what's printed on an
// Easypick hang tag: a fixed price, measurements in cm, a SKU. Numbers shown are
// computed from stock data, never decorative.

export const metadata: Metadata = { alternates: { canonical: "/" } };

const orgLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${site.url}/#org`,
      name: site.name,
      legalName: site.company.legalName,
      url: site.url,
      logo: `${site.url}/brand/logo.png`,
      slogan: site.tagline,
      sameAs: [site.social.instagram, site.social.tiktok],
    },
    { "@type": "WebSite", name: site.name, url: site.url, publisher: { "@id": `${site.url}/#org` } },
  ],
};

export default async function HomePage() {
  const [products, { current, next }] = await Promise.all([getProducts(), getDropTimeline()]);
  const drop = current ?? next;
  // Vault pieces have their own section; the shelf and the rail hold the house range.
  const range = products.filter((p) => !p.vault);

  // The hero shows one piece at a time, with its price tag: every piece that has a cut-out photo
  // (owner, 9 Oct 2026: all of them, not only what is on sale today; one that is sold out or still
  // to come says so), kinds taken in turn (a hoodie, a tee, a jacket, trousers, …) so the row under
  // it is a mix. What can be bought now comes first.
  const withPhoto = range.filter((p) => RACK_CUTOUTS.has(p.slug));
  const buyable = (p: (typeof range)[number]) => p.status === "live" && p.variants.some((v) => v.stock > 0);
  const inTurn = (list: typeof withPhoto) => {
    const kinds = ["hoodies", "tees", "jackets", "joggers", "shirts", "jeans", "sweatshirts", "polos", "trousers", "shorts", "co-ords", "accessories"].map((k) => list.filter((p) => p.category === k));
    const out: typeof withPhoto = [];
    for (let round = 0; kinds.some((l) => l.length > round); round++) for (const l of kinds) if (l[round]) out.push(l[round]);
    return out;
  };
  const heroPieces = [...inTurn(withPhoto.filter(buyable)), ...inTurn(withPhoto.filter((p) => !buyable(p)))];

  const offers = products.filter((p) => p.salePrice && p.status === "live" && !p.vault);
  const offerList = await getOffers();

  const { looks } = designerFits(products, await getSavedLooks());

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(orgLd)} />
      {/* 01 — Hero: one piece and its price tag, the words, and the drop's numbers */}
      <section aria-labelledby="hero-title" className="bg-paper text-ink">
        <div className="container-ep grid min-h-[calc(100svh-56px-env(safe-area-inset-bottom))] grid-rows-[auto_1fr_auto] gap-y-8 pb-6 pt-[80px] md:pt-[104px] lg:min-h-svh lg:grid-cols-12 lg:grid-rows-[1fr_auto] lg:gap-x-6 lg:pt-[116px]">
          {/* Stage */}
          <div className="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:self-center">
            {/* One piece, large, with its price tag hanging beside it; the row under it switches the piece */}
            <HeroPiece pieces={heroPieces.map((p) => ({ product: p, colour: p.colours[0], note: buyable(p) ? null : p.status === "scheduled" ? "Coming soon" : "Sold out" }))} />
          </div>

          {/* Words */}
          <div className="flex flex-col justify-end lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:justify-center lg:pb-10">
            <p className="eyebrow flex w-fit items-center gap-2 rounded-[2px] bg-volt px-3 py-1.5 text-ink">
              <span className="h-1.5 w-1.5 bg-ink" aria-hidden />
              Pick it. Pay it. Wear it.
            </p>
            <h1 id="hero-title" className="display display-hero mt-4">
              {current ? (
                <>
                  Drop {current.slug}.
                  <br />
                  Out now.
                </>
              ) : next ? (
                <>
                  Drop {next.slug}.
                  <br />
                  {formatDropTime(next.releaseAt).split(",")[0]}.
                </>
              ) : (
                <>
                  Pick it.
                  <br />
                  Wear it.
                </>
              )}
            </h1>
            {/* Why the store exists, in the owner's words */}
            <div className="mt-6 max-w-[460px]">
              <p className="display text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] leading-[0.95]">
                Shopping shouldn&apos;t feel like negotiation. <span className="text-steel-dark">That&apos;s why we built Easypick.</span>
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-ink/75 sm:text-[16px]">
                Fixed prices. Automated checkout.
                <br />
                Same price online and in-store.
              </p>
            </div>
            {/* Visit store, and the two ways to do it: they slide out beside the button on hover or focus (always shown on touch screens). */}
            <div className="group/visit mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <InteractiveHoverButton href="/visit" text="Visit store" tone="light" className="w-full sm:w-auto" />
              <ul className="flex gap-2 transition-all duration-300 [@media(hover:hover)]:-translate-x-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/visit:translate-x-0 [@media(hover:hover)]:group-focus-within/visit:opacity-100 [@media(hover:hover)]:group-hover/visit:translate-x-0 [@media(hover:hover)]:group-hover/visit:opacity-100">
                {[
                  { href: "/visit", label: "In person" },
                  { href: "/visit/tour", label: "Virtual tour" },
                ].map((o) => (
                  <li key={o.href} className="flex-1 sm:flex-none">
                    <Link
                      href={o.href}
                      className="flex h-12 items-center justify-center whitespace-nowrap rounded-full border border-ink/40 px-5 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink hover:border-ink hover:bg-ink hover:text-paper"
                    >
                      {o.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {/* The way into the drop, under Visit store */}
            <FlowButton href={drop ? `/drop/${drop.slug}` : "/drops"} text={drop ? `Shop Drop ${drop.slug}` : "See the drops"} className="mt-3 w-full sm:w-auto sm:self-start" />
          </div>

          {/* At the end: the drop and its countdown, in the middle. */}
          <div className="flex flex-col items-center gap-3 border-t border-ink/15 pt-5 text-center lg:col-span-12 lg:row-start-2">
            <p className="index text-center text-ink/70">
              {next ? `Drop ${next.slug} opens in` : current ? `${current.name} · out now` : "Kathmandu"}
            </p>
            <div className="flex justify-center">{next && <Countdown to={next.releaseAt} label={next.name} size="sm" seconds />}</div>
          </div>
        </div>
      </section>

      {/* The rail: products first, with quick filters and "My size" */}
      <Rail products={range} />



      {/* Designer Fits: just a pointer here; the fits themselves are on /fits (above the Vault, owner, 18 Oct 2026) */}
      {looks.length > 0 && (
        <section aria-labelledby="fits-title" className="py-8 md:py-10">
          <div className="container-ep">
            <FitsTeaser looks={looks} />
          </div>
        </section>
      )}

      {/* Pick your offer, under Designer Fits and above the Vault (owner, 18 Oct 2026) */}
      {offers.length > 0 && (
        <section aria-labelledby="pick-offer-title" className="overflow-hidden py-12 md:py-16">
          <div className="container-ep">
            {/* Pick your offer: one stack, every offer fanned out left and right (owner, 18 Oct 2026). */}
            <div>
              <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">Festival offers</p>
              <h2 id="pick-offer-title" className="mt-2 text-center text-[clamp(1.9rem,1.4rem+1.8vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
                Pick your offer.
                <span className="block text-steel-dark">Same price in store.</span>
              </h2>
              <div className="mt-10">
                <OfferStack offers={liveOffers(offerList, products, ktmDay())} label="Festival" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* The Vault: original brands and numbered pieces */}
      <Vault products={products} />


      {/* Festival offers: only while a real sale runs. The pieces move along by themselves. */}
      {offers.length > 0 && (
        <section aria-labelledby="offers-title" className="section overflow-hidden pb-0 md:pb-0 lg:pb-0">
          <div className="container-ep">
            {/* The ring, with only its name and the way in set in the curve under the cards (owner, 18 Oct 2026). */}
            <OfferBoard offers={offerList} products={products} today={ktmDay()}>
              <h2 id="offers-title" className="text-[clamp(1.9rem,1.4rem+1.8vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
                Festival offers.
              </h2>
              <Link href="/shop?sale=1" className="inline-flex h-11 items-center rounded-full bg-paper px-6 text-[14px] font-semibold text-ink shadow-[0_6px_18px_-10px_rgba(0,0,0,0.35)] ring-1 ring-ink/10 transition hover:ring-ink">
                See all offers
              </Link>
            </OfferBoard>
          </div>
        </section>
      )}

      {/* Buying for someone, just above Our store (owner, 18 Oct 2026). */}
      <section aria-labelledby="gift-title" className="py-14 md:py-20">
        <div className="container-ep">
          <GiftBlock />
        </div>
      </section>

      {/* Our store: the physical shop */}
      <OurStore info={await getStoreInfo()} />

      {/* Self-checkout: the kiosk, the steps, and the Nepali line */}
      <SelfCheckout />

      {/* Track an order: no account needed */}
      <section aria-labelledby="track-title" className="border-t border-mist py-7 md:py-8">
        <div className="container-ep grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end lg:gap-10">
          <div className="lg:pb-2.5">
            <h2 id="track-title" className="text-xl font-bold">
              Track an order.
            </h2>
            <p className="text-[13px] text-steel-dark">No account needed.</p>
          </div>
          <TrackForm compact id="home-track" />
        </div>
      </section>

      {next && <RefreshAt at={next.releaseAt} />}
      <RevealRoot />
    </>
  );
}
