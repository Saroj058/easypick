import type { Metadata } from "next";
import Link from "next/link";

import { Countdown } from "@/components/countdown";
import { HeroRack, type RackPiece } from "@/components/hero-rack";
import { OccasionFits } from "@/components/home/occasion-fits";
import { OurStore } from "@/components/home/our-store";
import { PriceShown } from "@/components/home/price-shown";
import { Rail } from "@/components/home/rail";
import { Vault } from "@/components/home/vault";

import { ProductCard } from "@/components/product-card";
import { RefreshAt } from "@/components/refresh-at";
import { RevealRoot } from "@/components/reveal-root";
import { SelfCheckout } from "@/components/self-checkout";
import { getStoreInfo } from "@/lib/store-info";
import { formatDropTime, formatPrice } from "@/lib/format";
import { TrackForm } from "@/app/track/track-form";
import { jsonLd } from "@/lib/json-ld";
import { site } from "@/lib/site";
import { getDropTimeline, getHomeStats, getProducts } from "@/lib/store";
import { getSavedLooks } from "@/lib/looks";
import { buildLooks } from "@/lib/occasions";
import type { Category, Product } from "@/lib/types";

export const revalidate = 60;

// Concept: "the tag is the store". The page is built from what's printed on an
// Easypick hang tag: a fixed price, measurements in cm, a SKU. Numbers shown are
// computed from stock data, never decorative.

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const RACK_ORDER: Category[] = ["jackets", "hoodies", "tees", "co-ords", "bottoms", "accessories"];

/**
 * One of each kind for the hero rail, in a colour not already used so the rail
 * reads as a range. Two bottoms (jogger + jeans) when available.
 */
function pickRack(products: Product[]): RackPiece[] {
  const live = products.filter((p) => p.status === "live");
  const chosen: Product[] = [];
  for (const c of RACK_ORDER) {
    const inCat = live.filter((p) => p.category === c);
    chosen.push(...inCat.slice(0, c === "bottoms" ? 2 : 1));
  }
  const used = new Set<string>();
  return chosen.slice(0, 6).map((product) => {
    const colours = [...product.colours].sort((a, b) => luminance(b.hex) - luminance(a.hex));
    const colour = colours.find((c) => !used.has(c.name)) ?? colours[0];
    used.add(colour.name);
    return { product, colour };
  });
}

function timeNpt(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
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
  const dropProducts = drop ? products.filter((p) => p.dropSlug === drop.slug) : products;
  const onRack = dropProducts.filter((p) => p.status !== "scheduled");
  const stats = getHomeStats(onRack, current?.pieceCount ?? null);
  const rack = pickRack(products);
  const leftPct = stats.piecesTotal ? Math.round((stats.piecesLeft / stats.piecesTotal) * 100) : 0;

  const offers = products.filter((p) => p.salePrice && p.status === "live");
  const bestSaving = offers.reduce((n, p) => Math.max(n, p.price - (p.salePrice ?? p.price)), 0);

  const looks = buildLooks(products, await getSavedLooks());

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(orgLd)} />
      {/* 01 — Hero: the rail, a tag, and the drop's numbers */}
      <section aria-labelledby="hero-title" className="on-dark bg-ink text-paper">
        <div className="container-ep grid min-h-[calc(100svh-56px-env(safe-area-inset-bottom))] grid-rows-[auto_1fr_auto] gap-y-8 pb-6 pt-[80px] md:pt-[104px] lg:min-h-svh lg:grid-cols-12 lg:grid-rows-[1fr_auto] lg:gap-x-6 lg:pt-[116px]">
          {/* Stage */}
          <div className="relative -mx-4 h-[46svh] min-h-[360px] overflow-hidden bg-graphite md:-mx-8 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:mx-0 lg:h-auto lg:min-h-[560px]">
            <HeroRack pieces={rack} dropLabel={drop ? `Drop ${drop.slug}` : "Core"} />
          </div>

          {/* Words */}
          <div className="flex flex-col justify-end lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:justify-center lg:pb-10">
            <p className="eyebrow flex items-center gap-2 text-paper/80">
              <span className="h-1.5 w-1.5 bg-volt" aria-hidden />
              {current ? `${current.name} · Out now · Kathmandu` : next ? `${next.name} · ${formatDropTime(next.releaseAt)}` : "Kathmandu"}
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
            <p className="mt-5 max-w-[36ch] text-[15px] text-paper/80 sm:text-[17px]">
              Tees, hoodies, jackets, jeans and caps. {formatPrice(stats.priceFrom)} to {formatPrice(stats.priceTo)}, price on every tag.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={drop ? `/drop/${drop.slug}` : "/drops"} className="btn btn-volt">
                {drop ? `Shop Drop ${drop.slug}` : "See the drops"}
              </Link>
              <Link href="/visit" className="btn btn-outline">
                Find the store
              </Link>
            </div>
          </div>

          {/* Data rail */}
          <dl className="grid grid-cols-3 border-t border-paper/15 pt-5 lg:col-span-12 lg:row-start-2">
            <div className="pr-3">
              <dt className="index text-paper/70">Pieces left</dt>
              <dd className="mt-2 font-mono text-[28px] font-semibold leading-none tabular-nums md:text-[40px]">
                {stats.piecesLeft}
                <span className="text-[15px] font-normal text-paper/70 md:text-lg"> / {stats.piecesTotal}</span>
              </dd>
              <dd className="mt-3 h-0.5 max-w-[180px] bg-paper/15" aria-hidden>
                <div className="h-full bg-volt" style={{ width: `${leftPct}%` }} />
              </dd>
            </div>
            <div className="border-l border-paper/15 px-3 md:px-6">
              <dt className="index text-paper/70">Styles</dt>
              <dd className="mt-2 font-mono text-[28px] font-semibold leading-none tabular-nums md:text-[40px]">
                {stats.styles}
                <span className="hidden text-[15px] font-normal text-paper/70 sm:inline md:text-lg"> · {stats.colourways} colours</span>
              </dd>
            </div>
            <div className="border-l border-paper/15 pl-3 md:pl-6">
              <dt className="index text-paper/70">{next ? `Until Drop ${next.slug}` : "Price range"}</dt>
              <dd className="mt-2">
                {next ? (
                  <Countdown to={next.releaseAt} label={next.name} size="sm" />
                ) : (
                  <span className="font-mono text-[20px] font-semibold tabular-nums md:text-[28px]">
                    {formatPrice(stats.priceFrom)}–{stats.priceTo.toLocaleString("en-IN")}
                  </span>
                )}
              </dd>
            </div>
            <div className="col-span-3 mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-paper/60">
              Stock as of {timeNpt(stats.asOf)} NPT · counted by RFID
            </div>
          </dl>
        </div>
      </section>

      {/* The rail: products first, with quick filters and "My size" */}
      <Rail products={products} />

      {/* Price shown. No DM needed. */}
      <PriceShown products={products} />

      {/* Wear it to…: a ready fit per occasion */}
      {looks.length > 0 && (
        <section aria-labelledby="occasion-title" className="section">
          <div className="container-ep">
            <OccasionFits looks={looks} />
          </div>
        </section>
      )}

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
      <section aria-labelledby="track-title" className="border-t border-mist py-14 md:py-20">
        <div className="container-ep grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-4">
            <h2 id="track-title" className="display display-h2">
              Track an order.
            </h2>
            <p className="mt-3 max-w-[36ch] text-steel-dark">No account needed. Use the order number from your SMS or receipt and the phone you ordered with.</p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <TrackForm compact id="home-track" />
          </div>
        </div>
      </section>

      {next && <RefreshAt at={next.releaseAt} />}
      <RevealRoot />
    </>
  );
}
