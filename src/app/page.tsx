import { existsSync } from "node:fs";
import { join } from "node:path";

import type { Metadata } from "next";

import { FitsTeaser } from "@/components/home/fits-teaser";
import { StoreAndGift } from "@/components/home/store-and-gift";
import { Rail } from "@/components/home/rail";
import { Vault, vaultBrands } from "@/components/home/vault";
import { LandingHero } from "@/components/landing/landing-hero";

import { RefreshAt } from "@/components/refresh-at";
import { RevealRoot } from "@/components/reveal-root";
import { OfferSection } from "@/components/offer-section";
import { ktmDay } from "@/lib/ktm-day";
import { getOffers } from "@/lib/offers";
import { getStoreInfo } from "@/lib/store-info";
import { sellable } from "@/lib/inventory";
import { jsonLd } from "@/lib/json-ld";
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
  const [products, { next }, home, siteSettings, kindList, vaultLook] = await Promise.all([getProducts(), getDropTimeline(), homeSetting.get(), siteSetting.get(), kindsSetting.get(), vaultSetting.get()]);
  const kv = kindView(kindList);
  // The organisation's social profiles for search engines (Admin → Site settings).
  const ld = { ...orgLd, "@graph": [{ ...orgLd["@graph"][0], sameAs: socialLinks(siteSettings).map((x) => x.href) }, orgLd["@graph"][1]] };
  // Section order and on/off, as set in Admin → Home page.
  const at = (id: HomeSection) => ({ order: home.sections.findIndex((x) => x.id === id) });
  const on = (id: HomeSection) => home.sections.find((x) => x.id === id)?.on !== false;
  // Vault pieces have their own section; the rail holds the house range.
  const range = products.filter((p) => !p.vault);
  const offers = products.filter((p) => p.salePrice && p.status === "live" && !p.vault);
  // The showroom at the top (owner, 28 Oct 2026, design 2): the live house pieces, those in stock first, with what
  // each size has left online; the Vault's count and brands; the next drop.
  const VAULT_LOGOS = new Set(["nike", "adidas", "carhartt", "new-balance", "converse", "puma"]);
  const left = (p: (typeof products)[number]) => p.variants.reduce((n, v) => n + sellable(v), 0);
  const liveRange = range.filter((p) => p.status === "live");
  const showPieces = [...liveRange]
    .sort((a, b) => Number(left(b) > 0) - Number(left(a) > 0) || Number(!!b.cutout) - Number(!!a.cutout))
    .slice(0, 12)
    .map((p) => {
      const colour = p.colours.find((c) => p.variants.some((v) => v.colour === c.name && sellable(v) > 0))?.name ?? p.colours[0]?.name ?? "";
      return {
        slug: p.slug,
        name: p.name,
        kind: kv.name(p.category),
        price: p.salePrice ?? p.price,
        line: p.shortDescription,
        isNew: !!p.isNew,
        // Its cut-out from Admin → Photos, else the rack's own cut-out of it when there is one.
        cutout: p.cutout ?? (existsSync(join(process.cwd(), "public/rack", `${p.slug}.webp`)) ? `/rack/${p.slug}.webp` : null),
        photo: p.images[0] ?? { src: null, alt: p.name, kind: "front" as const },
        category: p.category,
        hex: p.colours.find((c) => c.name === colour)?.hex ?? "#d9d9d6",
        colour,
        sizes: p.variants.filter((v) => v.colour === colour).map((v) => ({ size: v.size, sku: v.sku, left: sellable(v) })),
      };
    });
  const stocked = liveRange.filter((p) => left(p) > 0);
  const vaultLive = products.filter((p) => p.vault && (p.status === "live" || p.status === "sold_out"));
  const { looks } = designerFits(products, await getSavedLooks());
  const showroom = {
    pieces: showPieces,
    inStock: stocked.length,
    from: stocked.length ? Math.min(...stocked.map((p) => p.salePrice ?? p.price)) : null,
    fresh: liveRange.filter((p) => p.isNew).length,
    vault: {
      pieces: vaultLive.length,
      brands: vaultBrands(vaultLive).map((b) => {
        const slug = b.name.toLowerCase().replace(/\s+/g, "-");
        return { name: b.name, logo: VAULT_LOGOS.has(slug) ? `/brand/vault/${slug}.png` : null };
      }),
    },
    drop: next ? { name: next.name, at: next.releaseAt } : null,
    fits: looks.slice(0, 4).map((l) => ({
      label: l.label,
      group: l.groupLabel,
      total: l.pieces.reduce((n, x) => n + x.price, 0),
      pieces: l.pieces.map((x) => ({ name: x.name, cutout: x.cutout ?? null, photo: x.image, category: x.category, hex: x.hex })),
    })),
  };
  const offerList = await getOffers();


  const storeInfo = await getStoreInfo();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <div className="flex flex-col">
      {/* Above the rail: the showroom (owner, 28 Oct 2026, design 2 of five). The story film is on /about.
          How each part works is shown in its own section instead. */}
      {on("hero") && (
        <div style={at("hero")}>
          <LandingHero data={showroom} />
        </div>
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
      {/* The end: the live store and sending a gift (owner, 29 Oct 2026, design 4 of ten); each half has its own switch. */}
      {(on("store") || on("gift")) && (
        <div style={{ order: Math.min(on("store") ? at("store").order : 99, on("gift") ? at("gift").order : 99) }}>
          <StoreAndGift info={storeInfo} store={on("store")} gift={on("gift")} copy={home.gift} />
        </div>
      )}

      {/* Track an order lives in the showroom at the top now (owner, 29 Oct 2026: "remove the track order as it's already on top") */}

      </div>
      {next && <RefreshAt at={next.releaseAt} />}
      <RevealRoot />
    </>
  );
}
