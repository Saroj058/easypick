import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import { Barcode } from "@/components/hang-tag";
import { HeroRack, type RackPiece } from "@/components/hero-rack";
import { ArrowIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { GarmentSvg } from "@/components/product-image";
import { RevealRoot } from "@/components/reveal-root";
import { Ticker } from "@/components/ticker";
import { VisitCard } from "@/components/visit-card";
import { formatDropTime, formatHour, formatPrice } from "@/lib/format";
import { jsonLd } from "@/lib/json-ld";
import { categoryLabels, site } from "@/lib/site";
import { getDropTimeline, getHomeStats, getProducts } from "@/lib/store";
import type { Category, Product } from "@/lib/types";

export const revalidate = 300;

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

function SectionIndex({ n, label, dark = false }: { n: string; label: string; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-4 border-t pt-4 ${dark ? "border-paper/15 text-paper/70" : "border-mist text-steel-dark"}`}>
      <span className="index">{n}</span>
      <span className="index">{label}</span>
    </div>
  );
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
  const featured = onRack.filter((p) => p.status === "live").slice(0, 5);
  const [storyHead, ...storyRest] = (current?.story ?? "").split(/(?<=\.)\s+/);
  const leftPct = stats.piecesTotal ? Math.round((stats.piecesLeft / stats.piecesTotal) * 100) : 0;

  const categories = (Object.keys(categoryLabels) as Category[])
    .map((c) => ({ c, count: products.filter((p) => p.category === c && p.status === "live").length }))
    .filter((x) => x.count > 0);

  // A believable bill: one top, one bottom.
  const basics = [
    products.find((p) => p.status === "live" && p.category === "hoodies"),
    products.find((p) => p.status === "live" && p.category === "bottoms"),
  ].filter((p): p is Product => Boolean(p));

  const ticker = [
    `Open daily ${formatHour(site.store.hours.open)} – ${formatHour(site.store.hours.close)}`,
    "Pay by QR · eSewa",
    ...stats.lowSizes.map((l) => `${l.stock} left · ${l.name} · ${l.colour} ${l.size}`),
    "Fixed prices. Same for everyone.",
    "Measurements in cm on every tag",
    next ? `${next.name} · ${formatDropTime(next.releaseAt)}` : "New drop every other Friday",
  ];

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

      {/* Ticker */}
      <Ticker items={ticker} />

      {/* 02 — The drop */}
      {current && featured.length > 0 && (
        <section aria-labelledby="drop-title" className="section">
          <div className="container-ep">
            <SectionIndex n="02" label={`${current.name} · ${current.pieceCount} pieces`} />
            <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-7" data-reveal>
                <h2 id="drop-title" className="display display-h1">
                  {storyHead || `${current.name}.`}
                </h2>
                {storyRest.length > 0 && <p className="mt-4 max-w-[40ch] text-lg text-steel-dark">{storyRest.join(" ")}</p>}
              </div>
              <div className="lg:col-span-4 lg:col-start-9 lg:text-right" data-reveal>
                <p className="font-mono text-[length:var(--text-stat)] font-semibold leading-[0.85] tabular-nums">{stats.piecesLeft}</p>
                <p className="index mt-3 text-steel-dark">
                  of {stats.piecesTotal} pieces left · {formatPrice(stats.priceFrom)} to {formatPrice(stats.priceTo)}
                </p>
              </div>
            </div>

            <ul className="no-scrollbar -mx-4 mt-12 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 md:-mx-8 md:scroll-px-8 md:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-x-5 lg:gap-y-10 lg:overflow-visible lg:px-0">
              {featured.map((p, i) => (
                <li
                  key={p.id}
                  data-reveal
                  style={{ "--i": i } as React.CSSProperties}
                  className={`w-[72vw] max-w-[300px] shrink-0 snap-start lg:w-auto lg:max-w-none ${i === 0 ? "lg:col-span-2 lg:row-span-2" : ""}`}
                >
                  <ProductCard product={p} sizes={i === 0 ? "(min-width: 1024px) 50vw, 72vw" : "(min-width: 1024px) 25vw, 72vw"} />
                </li>
              ))}
              <li className="w-[72vw] max-w-[300px] shrink-0 snap-start lg:hidden">
                <Link href={`/drop/${current.slug}`} className="grid aspect-[4/5] place-items-center bg-photo">
                  <span className="flex flex-col items-center gap-3 text-center">
                    <span className="display display-h2">See all {dropProducts.length}</span>
                    <ArrowIcon className="h-6 w-6" />
                  </span>
                </Link>
              </li>
            </ul>
            <Link
              href={`/drop/${current.slug}`}
              className="group mt-12 hidden items-center gap-2 font-semibold uppercase tracking-[0.06em] lg:inline-flex"
            >
              See all of {current.name}
              <ArrowIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      )}

      {/* 03 — Shop by category */}
      {categories.length > 0 && (
        <section aria-labelledby="cat-title" className="pb-16 md:pb-24">
          <div className="container-ep">
            <SectionIndex n="03" label="Shop by piece" />
            <h2 id="cat-title" className="sr-only">
              Shop by category
            </h2>
            <ul className="mt-6 grid grid-cols-3 gap-2 md:auto-cols-fr md:grid-flow-col md:grid-cols-none md:gap-3">
              {categories.map(({ c, count }, i) => (
                <li key={c} data-reveal style={{ "--i": i % 4 } as React.CSSProperties}>
                  <Link href={`/shop?category=${c}`} className="group block">
                    <div className="relative aspect-square bg-photo transition-colors duration-200 group-hover:bg-mist">
                      <GarmentSvg category={c} colourHex="#1c1c1e" className="absolute inset-0 m-auto h-[62%] w-[62%]" />
                    </div>
                    <p className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-semibold group-hover:underline">{categoryLabels[c]}</span>
                      <span className="font-mono text-[12px] text-steel-dark">{String(count).padStart(2, "0")}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 grid gap-2 md:grid-cols-2 md:gap-3">
              <Link href="/fit" className="group flex min-h-[88px] items-center justify-between gap-4 bg-ink px-6 py-5 text-paper">
                <span>
                  <span className="display display-h2 block">Build the fit.</span>
                  <span className="text-[14px] text-paper/80">Top, bottom, layer. See it together, see the total.</span>
                </span>
                <ArrowIcon className="h-6 w-6 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link href="/size-guide" className="group flex min-h-[88px] items-center justify-between gap-4 border border-ink px-6 py-5">
                <span>
                  <span className="display display-h2 block">Your size in cm.</span>
                  <span className="text-[14px] text-steel-dark">Measure a piece you love once. We mark your size everywhere.</span>
                </span>
                <ArrowIcon className="h-6 w-6 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 04 — Price trust, as a receipt */}
      <section aria-labelledby="price-title" className="section bg-photo">
        <div className="container-ep">
          <SectionIndex n="04" label="How we price" />
          <div className="mt-10 grid gap-14 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6" data-reveal>
              <h2 id="price-title" className="display display-h1">
                Price shown.
                <br />
                No DM needed.
              </h2>
              <p className="mt-5 max-w-[38ch] text-lg text-steel-dark">
                No &ldquo;price in DM&rdquo;, no New Road bargaining. The number on the tag is the number you pay, and it&apos;s the same for everyone.
              </p>
              <ul className="mt-8 space-y-3 text-[15px]">
                <li className="flex gap-3">
                  <span className="index mt-1 text-steel-dark">cm</span>Chest, length and sleeve on every tag.
                </li>
                <li className="flex gap-3">
                  <span className="index mt-1 text-steel-dark">qr</span>Scan and pay with the wallet you already use.
                </li>
                <li className="flex gap-3">
                  <span className="index mt-1 text-steel-dark">1×</span>One helper on the floor. They won&apos;t follow you.
                </li>
              </ul>
              <Link href="/how-it-works" className="group mt-10 inline-flex items-center gap-2 font-semibold uppercase tracking-[0.06em]">
                How the store works
                <ArrowIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>

            <figure className="lg:col-span-5 lg:col-start-8" data-reveal>
              <div className="receipt mx-auto max-w-[380px] px-6 pt-7 font-mono text-[13px] leading-relaxed shadow-[0_1px_0_rgba(0,0,0,0.06)]">
                <p className="text-center font-semibold tracking-[0.16em]">EASYPICK</p>
                <p className="text-center text-[11px] uppercase tracking-[0.12em] text-steel-dark">Self-checkout · {site.store.area}</p>
                <div className="my-4 border-t border-dashed border-steel" />
                <ul>
                  {basics.map((p) => (
                    <li key={p.id} className="flex items-baseline">
                      <span className="truncate">{p.name} · M</span>
                      <span className="leader" aria-hidden />
                      <span className="tabular-nums">{formatPrice(p.salePrice ?? p.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="my-4 border-t border-dashed border-steel" />
                <ul className="uppercase">
                  {[
                    ["Pick", "take your time"],
                    ["Try", "token at the room"],
                    ["Pay", "scan the QR"],
                    ["Queue", "0"],
                    ["Bargaining", "0"],
                  ].map(([k, v]) => (
                    <li key={k} className="flex items-baseline text-[12px] tracking-[0.06em]">
                      <span>{k}</span>
                      <span className="leader" aria-hidden />
                      <span className="text-steel-dark">{v}</span>
                    </li>
                  ))}
                </ul>
                <div className="my-4 border-t border-dashed border-steel" />
                <p className="flex items-baseline text-[15px] font-semibold">
                  <span>TOTAL</span>
                  <span className="leader" aria-hidden />
                  <span className="tabular-nums">{formatPrice(basics.reduce((n, p) => n + (p.salePrice ?? p.price), 0))}</span>
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-steel-dark">VAT incl. · Paid by QR</p>
                <p className="display mt-6 text-center text-[26px] leading-none">Pick it. Pay it. Wear it.</p>
                <Barcode value="EASYPICK-KTM" className="mx-auto mt-4 h-8 w-40 text-ink" />
              </div>
              <figcaption className="sr-only">An example Easypick bill: fixed prices, paid by QR, no queue and no bargaining.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 05 — Next drop */}
      <section aria-labelledby="next-title" className="on-dark section bg-ink text-paper">
        <div className="container-ep">
          <SectionIndex n="05" label={next ? `${next.name} · ${formatDropTime(next.releaseAt)}` : "Every other Friday"} dark />
          <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7" data-reveal>
              <h2 id="next-title" className="display display-h1">
                Hear first.
              </h2>
              <p className="mt-4 max-w-[36ch] text-lg text-paper/80">One message the day before each drop. Nothing else.</p>
              {next && (
                <div className="mt-10">
                  <Countdown to={next.releaseAt} label={next.name} />
                </div>
              )}
            </div>
            <div className="lg:col-span-5" data-reveal>
              <AlertSignup dark source="home" />
            </div>
          </div>
        </div>
      </section>

      {/* 06 — Visit, as a shop signboard */}
      <section aria-labelledby="visit-title" className="section">
        <div className="container-ep">
          <SectionIndex n="06" label="Visit the store" />
          <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7" data-reveal>
              <h2 id="visit-title">
                <span className="sr-only">Visit the store: </span>
                <span lang="ne" className="block font-nepali text-[clamp(4.5rem,2rem+10vw,10rem)] font-semibold leading-[0.9]">
                  आउनुस्
                </span>
                <span className="display display-h1 mt-2 block">
                  <span lang="ne-Latn">Aaunus.</span>
                </span>
              </h2>
              <p className="mt-5 max-w-[38ch] text-lg text-steel-dark">
                Just looking is fine too. One helper on the floor. Wave if you need a size.
              </p>
            </div>
            <div className="lg:col-span-4 lg:col-start-9" data-reveal>
              <VisitCard />
            </div>
          </div>
        </div>
      </section>

      {/* Colophon: findable text for search */}
      <section aria-labelledby="about-title" className="border-t border-mist py-12">
        <div className="container-ep grid gap-4 lg:grid-cols-12">
          <h2 id="about-title" className="index text-steel-dark lg:col-span-3">
            About Easypick
          </h2>
          <p className="max-w-[70ch] font-mono text-[13px] leading-relaxed text-steel-dark lg:col-span-7 lg:col-start-6">
            Easypick is a self-checkout clothing store in Kathmandu for streetwear and everyday basics: oversized tees, hoodies, joggers,
            relaxed jeans and co-ords. Every tag shows the price and the garment&apos;s measurements in cm, so you can pick your size without
            asking. Try things on, pay at the kiosk with eSewa, and walk out. Prices are fixed and fair, with no
            bargaining. New drops land every other Friday. Prefer to shop from home? Order online for store pickup or delivery inside the
            Kathmandu Valley.
          </p>
        </div>
      </section>

      <RevealRoot />
    </>
  );
}
