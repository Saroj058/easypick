import type { Metadata } from "next";

import { FitsTeaser } from "@/components/home/fits-teaser";
import { GiftBlock } from "@/components/home/gift-block";
import { StoreBand } from "@/components/home/store-band";
import { Rail } from "@/components/home/rail";
import { Vault } from "@/components/home/vault";
import { LandingHero } from "@/components/landing/landing-hero";
import type { ChapterData } from "@/components/landing/landing-chapters";

import { RefreshAt } from "@/components/refresh-at";
import { RevealRoot } from "@/components/reveal-root";
import { OfferSection } from "@/components/offer-section";
import { ktmDay } from "@/lib/ktm-day";
import { getOffers } from "@/lib/offers";
import { getStoreInfo } from "@/lib/store-info";
import { TrackForm } from "@/app/track/track-form";
import { formatPrice } from "@/lib/format";
import { jsonLd } from "@/lib/json-ld";
import { railReel } from "@/lib/rail-reel";
import { site, walletList } from "@/lib/site";
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

// The pictures inside the letters, and the four tiles above the rail (owner: "use the current images").
// Only the darker pictures, so the letters read crisp (owner, 26 Oct 2026: "make that hero better").
const WORDS = ["/drops/hero-2.webp", "/visit/store-night-open.avif", "/visit/door-poster.avif", "/visit/store-dusk-open.avif"];
// What plays after the word, one chapter at a time (owner, 26 Oct 2026: "the whole system, how to use
// it, in a creative way"; planned with ten agents). The story: what we promise (price, size, door,
// swap), what to come for (fits, drops, gifts, the Vault), then the store. Every fact is checked
// against the code and settings; things not built yet (Reserve & Try, the kiosk) are not promised.
const clock = (t: string) => {
  const h = Number(t.split(":")[0]);
  return h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
};
const CHAPTERS: ChapterData[] = [
  { label: "Fixed prices", title: ["Price shown.", "*No DM.*"], line: "Every tag shows its price, the same online and in the store. Nothing to ask, nothing to bargain.", steps: ["Pick a size", "Buy now", `Pay with ${walletList()}`], href: "/how-it-works", cta: "How the store works", layout: "left", big: "/drops/hero-showroom.webp", bigAt: "72% 50%", small: "/products/oversized-heavy-tee/front.jpg" },
  { label: "The rails", title: ["Scroll.", "*Choose.*"], line: "Every piece hangs on a rail, with its price under the name. Slide along, stop on the one you like, take it.", steps: ["Scroll", "Stop", "Choose"], href: "/the-rail", cta: "How the rail works", layout: "right", big: "/rack/hung/everyday-hoodie.webp" },
  { label: "Your size", title: ["Your size,", "*in cm*"], line: "Every piece is measured in cm. Give your height and weight, or a size you already wear, and we pick yours.", steps: ["Height", "Weight", "Your size"], href: "/size-guide", cta: "Find my size", layout: "left", big: "/poses/coach-jacket-3.webp", bigAt: "50% 25%", small: "/products/relaxed-straight-jean/front.jpg" },
  { label: "Delivery", title: ["To your", "*door*"], line: "Kathmandu the next day, Lalitpur and Bhaktapur in one to two. Or pick it up free in the store.", facts: [`Free over ${formatPrice(site.delivery.freeAbove)}`, "Track it, no account"], href: "/delivery", cta: "Delivery and pickup", layout: "right", big: "/visit/route-static.avif", bigAt: "40% 60%", small: "/rack/hung/everyday-hoodie.webp" },
  { label: "Exchange", title: ["Seven days", "*to swap*"], line: "Swap for another size within 7 days, tags on, in the store or by rider.", steps: ["Tags on", "Within 7 days", "New size"], href: "/returns", cta: "Returns and exchange", layout: "left", big: "/poses/coach-jacket-2.webp", bigAt: "50% 25%", small: "/rack/hung/brushed-crewneck.webp" },
  { label: "Designer Fits", title: ["The whole", "*outfit*"], line: "Pick the occasion and your size. The whole fit goes in your bag in one tap.", steps: ["Occasion", "Your size", "Add the fit"], href: "/fits", cta: "See the fits", layout: "right", big: "/poses/coach-jacket-1.webp", bigAt: "50% 25%", small: "/products/washed-co-ord-set/front.jpg" },
  { label: "Drops", title: ["Every other", "*Friday*"], line: "New pieces land at 6 PM. Leave your WhatsApp or email and we send one message when it lands.", steps: ["Notify me", "6 PM", "One message"], href: "/drops", cta: "See the drops", layout: "left", big: "/visit/store-dusk-closed.avif", bigAt: "50% 50%", small: "/rack/acc/sneakers-clear.webp" },
  { label: "Gifts", title: ["For", "*someone*"], line: "Send a piece or a gift card. They open it, pick their size, and can swap it within 14 days.", steps: ["Send a piece", "They open it", "They pick a size"], href: "/gift", cta: "Send a gift", layout: "right", big: "/gift/hero-white.webp", bigAt: "80% 50%", small: "/gift-cards/front-5000.webp" },
  { label: "The Vault", title: ["The", "*Vault*"], line: "Original brands, checked by hand. Rare pairs, mostly one of each, not restocked.", facts: ["Original brands", "Checked by hand"], href: "/vault", cta: "Enter the Vault", layout: "figure", big: "/drops/hero-white.webp", bigAt: "75% 50%", figure: { src: "/vault/hero-figure.webp", width: 410, height: 925 } },
  { label: "The store", title: ["Pick it.", "*Pay it.*"], line: site.store.address ? `Our store in ${site.store.area}: pick, try and pay yourself at the kiosk.` : `Our store in ${site.store.area}, opening soon: pick, try and pay yourself at the kiosk.`, facts: [site.store.address ? site.store.area : "Opening soon", `${clock(site.store.hours.open)} to ${clock(site.store.hours.close)}, daily`], href: "/how-it-works", cta: "How the store works", layout: "left", big: "/visit/store-dawn-open.avif", bigAt: "50% 55%", small: "/rack/hung/coach-jacket.webp" },
];

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
  const offerList = await getOffers();

  const { looks } = designerFits(products, await getSavedLooks());

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <div className="flex flex-col">
      {/* Above the rail (owner, 26 Oct 2026, after a Zara redesign; plays by itself): EASYPICK with our
          pictures inside the letters, then four tiles. The rail and everything below are as they were. */}
      {on("hero") && (
        <div style={at("hero")}>
          <LandingHero words={WORDS} chapters={CHAPTERS.map((c) => (c.href === "/the-rail" ? { ...c, reel: railReel(products) } : c))} line={home.hero.eyebrow || "Pick it. Pay it. Wear it."} />
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
