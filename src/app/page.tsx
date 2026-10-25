import type { Metadata } from "next";
import Link from "next/link";

import { Countdown } from "@/components/countdown";
import { FitsTeaser } from "@/components/home/fits-teaser";
import { HeroPiece } from "@/components/hero-piece";
import { GiftBlock } from "@/components/home/gift-block";
import { StoreBand } from "@/components/home/store-band";
import { Rail } from "@/components/home/rail";
import { Vault } from "@/components/home/vault";

import { RefreshAt } from "@/components/refresh-at";
import { RevealRoot } from "@/components/reveal-root";
import { OfferSection } from "@/components/offer-section";
import { ktmDay } from "@/lib/ktm-day";
import { getOffers } from "@/lib/offers";
import { getStoreInfo } from "@/lib/store-info";
import { formatDropTime } from "@/lib/format";
import { TrackForm } from "@/app/track/track-form";
import { jsonLd } from "@/lib/json-ld";
import { cutoutOf } from "@/lib/rack-cutouts";
import { site } from "@/lib/site";
import { getDropTimeline, getProducts } from "@/lib/store";
import { getSavedLooks } from "@/lib/looks";
import { designerFits } from "@/lib/occasions";
import { homeSetting } from "@/lib/settings/home";
import { siteSetting } from "@/lib/settings/site";
import { kindsSetting } from "@/lib/settings/categories";
import { vaultSetting } from "@/lib/settings/vault";
import { kindView } from "@/lib/settings/categories-rules";
import { socialLinks } from "@/lib/settings/site-rules";
import type { HomeSection } from "@/lib/settings/home-rules";

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
      sameAs: [] as string[],
    },
    { "@type": "WebSite", name: site.name, url: site.url, publisher: { "@id": `${site.url}/#org` } },
  ],
};

export default async function HomePage() {
  const [products, { current, next }, home, siteSettings, kindList, vaultLook] = await Promise.all([getProducts(), getDropTimeline(), homeSetting.get(), siteSetting.get(), kindsSetting.get(), vaultSetting.get()]);
  const kv = kindView(kindList);
  // The organisation's social profiles for search engines (Admin → Site settings).
  const ld = { ...orgLd, "@graph": [{ ...orgLd["@graph"][0], sameAs: socialLinks(siteSettings).map((x) => x.href) }, orgLd["@graph"][1]] };
  // Section order and on/off, as set in Admin → Home page.
  const at = (id: HomeSection) => ({ order: home.sections.findIndex((x) => x.id === id) });
  const on = (id: HomeSection) => home.sections.find((x) => x.id === id)?.on !== false;
  const drop = current ?? next;
  // Vault pieces have their own section; the shelf and the rail hold the house range.
  const range = products.filter((p) => !p.vault);

  // The hero shows one piece at a time, with its price tag: every piece that has a cut-out photo
  // (owner, 9 Oct 2026: all of them, not only what is on sale today; one that is sold out or still
  // to come says so), kinds taken in turn (a hoodie, a tee, a jacket, trousers, …) so the row under
  // it is a mix. What can be bought now comes first.
  const withPhoto = range.filter((p) => cutoutOf(p) && (home.hero.showUnavailable || (p.status === "live" && p.variants.some((v) => v.stock > 0))));
  const buyable = (p: (typeof range)[number]) => p.status === "live" && p.variants.some((v) => v.stock > 0);
  const inTurn = (list: typeof withPhoto) => {
    const kinds = home.hero.kinds.map((k) => list.filter((p) => p.category === k));
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
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <div className="flex flex-col">
      {/* 01 — Hero: one piece and its price tag, the words, and the drop's numbers */}
      {on("hero") && (
      <section aria-labelledby="hero-title" style={at("hero")} className="bg-paper text-ink">
        <div className="container-ep grid min-h-[calc(100svh-56px-env(safe-area-inset-bottom))] grid-rows-[auto_1fr_auto] gap-y-8 pb-6 pt-[80px] md:pt-[104px] lg:min-h-svh lg:grid-cols-12 lg:grid-rows-[1fr_auto] lg:gap-x-6 lg:pt-[116px]">
          {/* Stage */}
          <div className="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:self-center">
            {/* One piece, large, with its price tag hanging beside it; the row under it switches the piece */}
            <HeroPiece seconds={home.hero.seconds} pieces={heroPieces.map((p) => ({ product: p, colour: p.colours[0], note: buyable(p) ? null : p.status === "scheduled" ? "Coming soon" : "Sold out" }))} />
          </div>

          {/* Words */}
          <div className="flex flex-col justify-end lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:justify-center lg:pb-10">
            {home.hero.eyebrow && (
              <p className="eyebrow flex w-fit items-center gap-2 rounded-[2px] bg-volt px-3 py-1.5 text-ink">
                <span className="h-1.5 w-1.5 bg-ink" aria-hidden />
                {home.hero.eyebrow}
              </p>
            )}
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
                  {home.hero.fallback[0]}
                  <br />
                  {home.hero.fallback[1]}
                </>
              )}
            </h1>
            {/* Why the store exists, in the owner's words: one calm line, then the small print (owner, 25 Oct 2026: "too much clutter"). */}
            <div className="mt-5 max-w-[440px]">
              <p className="text-[17px] font-semibold leading-snug sm:text-[19px]">
                {home.hero.pitch} <span className="font-normal text-steel-dark">{home.hero.pitchQuiet}</span>
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/65">
                {home.hero.line1} {home.hero.line2}
              </p>
            </div>
            {/* One clear way in (the drop) and a quiet link to the store, on one line. */}
            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href={drop ? `/drop/${drop.slug}` : "/drops"}
                className="group inline-flex h-12 items-center gap-3 rounded-full bg-ink px-7 text-[13px] font-semibold uppercase tracking-[0.08em] text-paper transition-colors hover:bg-ink/85"
              >
                {drop ? home.hero.dropButton.replace("{n}", drop.slug) : home.hero.noDropButton}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                  <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </Link>
              <Link href="/visit" className="inline-flex min-h-11 items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] underline decoration-ink/30 underline-offset-[6px] hover:decoration-ink">
                <span className="h-2 w-2 rounded-full bg-[#22c55e]" aria-hidden />
                {home.hero.visitLabel}
              </Link>
            </div>
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
      )}

      {/* The rail: products first, with quick filters and "My size" */}
      {on("rail") && (
        <div style={at("rail")}>
          <Rail products={range} settings={home.rail} kinds={{ order: kv.order, names: Object.fromEntries(kv.all.map((k) => [k, kv.name(k)])) }} />
        </div>
      )}



      {/* Designer Fits: just a pointer here; the fits themselves are on /fits (above the Vault, owner, 18 Oct 2026) */}
      {on("fits") && looks.length > 0 && (
        <section aria-labelledby="fits-title" style={at("fits")} className="py-8 md:py-10">
          <div className="container-ep">
            <FitsTeaser looks={looks} title={home.fits.title} button={home.fits.button} />
          </div>
        </section>
      )}

      {/* Pick your offer, under Designer Fits and above the Vault (owner, 18 Oct 2026) */}
      {on("offers") && offers.length > 0 && (
        <section aria-labelledby="pick-offer-title" style={at("offers")} className="overflow-hidden py-12 md:py-16">
          <div className="container-ep">
            {/* Pick your offer: the stack of offers; each opens onto a wheel of its pieces (owner, 18 Oct 2026). */}
            <div>
              <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">{home.offers.eyebrow}</p>
              <h2 id="pick-offer-title" className="mt-2 text-center text-[clamp(1.9rem,1.4rem+1.8vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
                {home.offers.title}
                <span className="block text-steel-dark">{home.offers.line}</span>
              </h2>
              <div className="mt-10">
                <OfferSection offers={offerList} products={products} today={ktmDay()} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* The Vault: original brands and numbered pieces */}
      {on("vault") && (
        <div style={at("vault")}>
          <Vault products={products} copy={home.vault} theme={vaultLook.cold} />
        </div>
      )}



      {/* Buying for someone: one quiet line, by Track an order (owner, 19 Oct 2026). */}
      {on("gift") && (
        <div style={at("gift")}>
          <GiftBlock copy={home.gift} />
        </div>
      )}

      {/* Our store and self-checkout, in one small band (owner, 19 Oct 2026); each half has its own switch. */}
      {(on("store") || on("checkout")) && (
        <div style={{ order: Math.min(on("store") ? at("store").order : 99, on("checkout") ? at("checkout").order : 99) }}>
          <StoreBand info={await getStoreInfo()} store={on("store")} checkout={on("checkout")} />
        </div>
      )}

      {/* Track an order: no account needed */}
      {on("track") && (
      <section aria-labelledby="track-title" style={at("track")} className="border-t border-mist py-7 md:py-8">
        <div className="container-ep grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end lg:gap-10">
          <div className="lg:pb-2.5">
            <h2 id="track-title" className="text-xl font-bold">
              {home.track.title}
            </h2>
            <p className="text-[13px] text-steel-dark">{home.track.line}</p>
          </div>
          <TrackForm compact id="home-track" />
        </div>
      </section>
      )}

      </div>
      {next && <RefreshAt at={next.releaseAt} />}
      <RevealRoot />
    </>
  );
}
