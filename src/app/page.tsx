import type { Metadata } from "next";
import Link from "next/link";

import { Countdown } from "@/components/countdown";
import { HeroRack, type RackPiece } from "@/components/hero-rack";
import { OccasionFits } from "@/components/home/occasion-fits";
import { OurStore } from "@/components/home/our-store";
import { Rail } from "@/components/home/rail";
import { Vault } from "@/components/home/vault";

import { ProductCard } from "@/components/product-card";
import { RefreshAt } from "@/components/refresh-at";
import { RevealRoot } from "@/components/reveal-root";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { SelfCheckout } from "@/components/self-checkout";
import { getStoreInfo } from "@/lib/store-info";
import { formatDropTime, formatPrice } from "@/lib/format";
import { TrackForm } from "@/app/track/track-form";
import { jsonLd } from "@/lib/json-ld";
import { site } from "@/lib/site";
import { getDropTimeline, getProducts } from "@/lib/store";
import { getSavedLooks } from "@/lib/looks";
import { designerFits } from "@/lib/occasions";
import type { Category, Product } from "@/lib/types";

export const revalidate = 60;

// Concept: "the tag is the store". The page is built from what's printed on an
// Easypick hang tag: a fixed price, measurements in cm, a SKU. Numbers shown are
// computed from stock data, never decorative.

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const STOREY = 7;
/** The two storeys of the hero's shelf: what hangs on the upper rail, and on the lower one. */
// Jackets hang with the bottoms so the lower rail isn't only trousers and caps.
const UPPER: Category[] = ["tees", "hoodies", "co-ords"];
const LOWER: Category[] = ["bottoms", "jackets", "accessories"];

/**
 * Up to seven live pieces for one storey, kinds mixed along the rail, each in a colour that
 * differs from its neighbour where the piece has a choice, so the rail reads as a range.
 */
function pickStorey(products: Product[], kinds: Category[]): RackPiece[] {
  const live = products.filter((p) => p.status === "live");
  const byKind = kinds.map((k) => live.filter((p) => p.category === k));
  const chosen: Product[] = [];
  // One of each kind in turn, until the rail is full or the kinds run out.
  for (let round = 0; chosen.length < STOREY && byKind.some((list) => list.length > round); round++) {
    for (const list of byKind) if (list[round] && chosen.length < STOREY) chosen.push(list[round]);
  }
  let last = "";
  return chosen.map((product) => {
    const colours = [...product.colours].sort((a, b) => luminance(b.hex) - luminance(a.hex));
    const colour = colours.find((c) => c.name !== last) ?? colours[0];
    last = colour.name;
    return { product, colour };
  });
}

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
  const upper = pickStorey(range, UPPER);
  const lower = pickStorey(range, LOWER);

  const offers = products.filter((p) => p.salePrice && p.status === "live");
  const bestSaving = offers.reduce((n, p) => Math.max(n, p.price - (p.salePrice ?? p.price)), 0);

  const { looks, curated } = designerFits(products, await getSavedLooks());

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(orgLd)} />
      {/* 01 — Hero: the rail, a tag, and the drop's numbers */}
      <section aria-labelledby="hero-title" className="on-dark bg-ink text-paper">
        <div className="container-ep grid min-h-[calc(100svh-56px-env(safe-area-inset-bottom))] grid-rows-[auto_1fr_auto] gap-y-8 pb-6 pt-[80px] md:pt-[104px] lg:min-h-svh lg:grid-cols-12 lg:grid-rows-[1fr_auto] lg:gap-x-6 lg:pt-[116px]">
          {/* Stage */}
          <div className="relative -mx-4 h-[46svh] min-h-[360px] overflow-hidden bg-graphite md:-mx-8 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:mx-0 lg:h-auto lg:min-h-[560px]">
            <HeroRack top={upper} bottom={lower} />
          </div>

          {/* Words */}
          <div className="flex flex-col justify-end lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:justify-center lg:pb-10">
            <p className="eyebrow flex items-center gap-2 text-paper/80">
              <span className="h-1.5 w-1.5 bg-paper" aria-hidden />
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
                Shopping shouldn&apos;t feel like negotiation. <span className="text-paper/60">That&apos;s why we built Easypick.</span>
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-paper/80 sm:text-[16px]">
                Fixed prices. Automated checkout.
                <br />
                Same price online and in-store.
              </p>
            </div>
            {/* Visit store, and the two ways to do it: they slide out beside the button on hover or focus (always shown on touch screens). */}
            <div className="group/visit mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <InteractiveHoverButton href="/visit" text="Visit store" className="w-full sm:w-auto" />
              <ul className="flex gap-2 transition-all duration-300 [@media(hover:hover)]:-translate-x-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/visit:translate-x-0 [@media(hover:hover)]:group-focus-within/visit:opacity-100 [@media(hover:hover)]:group-hover/visit:translate-x-0 [@media(hover:hover)]:group-hover/visit:opacity-100">
                {[
                  { href: "/visit", label: "In person" },
                  { href: "/visit/tour", label: "Virtual tour" },
                ].map((o) => (
                  <li key={o.href} className="flex-1 sm:flex-none">
                    <Link
                      href={o.href}
                      className="flex h-12 items-center justify-center whitespace-nowrap rounded-full border border-paper/40 px-5 text-[13px] font-semibold uppercase tracking-[0.06em] text-paper hover:border-paper hover:bg-paper hover:text-ink"
                    >
                      {o.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* At the end: the drop. The countdown in the middle, the way into the drop beside it. */}
          <div className="grid items-center gap-x-6 gap-y-4 border-t border-paper/15 pt-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:col-span-12 lg:row-start-2">
            <p className="index text-center text-paper/70 md:text-left">
              {next ? `Drop ${next.slug} opens in` : current ? `${current.name} · out now` : "Kathmandu"}
            </p>
            <div className="flex justify-center">{next && <Countdown to={next.releaseAt} label={next.name} size="sm" seconds />}</div>
            <div className="flex md:justify-end">
              <Link href={drop ? `/drop/${drop.slug}` : "/drops"} className="btn w-full bg-paper text-ink hover:bg-paper/85 md:w-auto">
                {drop ? `Shop Drop ${drop.slug}` : "See the drops"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The rail: products first, with quick filters and "My size" */}
      <Rail products={range} />


      {/* Designer Fits: a ready fit per occasion */}
      {looks.length > 0 && (
        <section aria-labelledby="occasion-title" className="py-10 md:py-14">
          <div className="container-ep">
            <OccasionFits looks={looks} curated={curated} />
          </div>
        </section>
      )}

      {/* Find a gift and gift cards (docs/BLUEPRINT.md, home page order) */}
      <section aria-labelledby="gift-title" className="border-t border-mist py-10 md:py-14">
        <div className="container-ep">
          <h2 id="gift-title" className="display text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[0.92]">
            Buying for someone?
          </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Link href="/gift" className="group flex min-h-[112px] items-center justify-between gap-4 bg-ink px-6 py-5 text-paper">
              <span>
                <span className="block text-xl font-bold">Send a gift</span>
                <span className="mt-1 block text-[15px] text-paper/75">You pay. They pick the size.</span>
              </span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0 transition-transform duration-200 group-hover:translate-x-1">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link href="/gift-cards" className="group flex min-h-[112px] items-center justify-between gap-4 border border-ink px-6 py-5">
              <span>
                <span className="block text-xl font-bold">Gift cards</span>
                <span className="mt-1 block text-[15px] text-steel-dark">Rs 1,000 to 20,000. Sent by email or SMS.</span>
              </span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0 transition-transform duration-200 group-hover:translate-x-1">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* The Vault: original brands and numbered pieces */}
      <Vault products={products} />

      {/* Festival offers: only while a real sale runs */}
      {offers.length > 0 && (
        <section aria-labelledby="offers-title" className="section">
          <div className="container-ep">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="offers-title" className="display display-h1">
                Festival offers
              </h2>
              <Link href="/shop?sale=1" className="shrink-0 text-[15px] font-semibold underline underline-offset-4">
                See all
              </Link>
            </div>
            <p className="mt-2 text-steel-dark">
              {offers.length} pieces marked down, up to {formatPrice(bestSaving)} off. Same price in store.
            </p>
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {offers.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} sizes="(min-width: 768px) 25vw, 50vw" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

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
