import type { Metadata } from "next";

import { FitsTeaser } from "@/components/home/fits-teaser";
import { GiftBlock } from "@/components/home/gift-block";
import { StoreBand } from "@/components/home/store-band";
import { Rail } from "@/components/home/rail";
import { Vault } from "@/components/home/vault";
import { LandingHero } from "@/components/landing/landing-hero";
import type { ChapterData, Film } from "@/components/landing/landing-chapters";

import { RefreshAt } from "@/components/refresh-at";
import { RevealRoot } from "@/components/reveal-root";
import { OfferSection } from "@/components/offer-section";
import { ktmDay } from "@/lib/ktm-day";
import { getOffers } from "@/lib/offers";
import { getStoreInfo } from "@/lib/store-info";
import { TrackForm } from "@/app/track/track-form";
import { jsonLd } from "@/lib/json-ld";
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
// What plays after the word (owner, 27 Oct 2026, planned with twenty agents): why Easypick first ("why
// should a user choose it, as we have a lot of other options"), then how each part of the store works,
// each a whole process recorded on the real site (a test copy: no real orders) and edited with a camera
// that follows each action (public/story/video, scripts/record-story.mjs). The films play in full, a
// little faster than life ("run the full videos ... fast and easy to understand"), their steps listed
// beside them; each step's time is when its caption shows in the film. Every fact is checked against the code.
/** A recording: its length (s) and its steps. The window's bar shows the page, not a domain: the domain isn't chosen yet (site.ts). */
const film = (name: string, length: number, path: string, steps: [string, number][], label?: string): Film => ({
  src: `/story/video/${name}.webm`,
  poster: `/story/video/${name}.webp`,
  url: `easypick${path === "/" ? "" : path}`,
  length,
  steps,
  label,
});
const CHAPTERS: ChapterData[] = [
  {
    topic: "Why",
    label: "Why Easypick",
    title: ["Why", "*Easypick*?"],
    line: "There are lots of places to buy clothes. Here's what's different when you buy from us.",
    compare: [
      ["DM for the price, then bargain", "Same price on the tag, online and in store"],
      ["Guess your size", "Your size worked out, in cm"],
      ["Wrong size? Stuck with it", "Swap the size within 7 days"],
      ["Pay cash and hope it turns up", `Pay with ${walletList()}, no account needed`],
      ["Wait and keep asking", "Kathmandu the next day, or pick it up free"],
    ],
    href: "/how-it-works",
    cta: "How the store works",
    layout: "right",
    photo: "/story/storefront.webp",
    beat: 10000,
  },
  {
    topic: "Shop",
    label: "How shopping works",
    title: ["Pick it.", "Pay it.", "*Wear it.*"],
    line: `Swipe the rail, pick your size, tap Buy now, add your number and pay with ${walletList()}. No account, no bargaining.`,
    films: [film("shop", 40.8, "/", [["Find the rail", 1.6], ["Swipe to browse", 3.2], ["Pick your size", 7.6], ["Tap Buy now", 10.4], ["Enter your number", 13.6], ["Pickup is free", 17.6], ["Tap Pay", 18.8], ["Log in to eSewa", 22.4], ["Enter the code", 27.6], ["Confirm the payment", 32.4], ["Paid. Your order is in", 38]])],
    href: "/how-it-works",
    cta: "How it works",
    layout: "left",
    photo: "/story/tees-rail.webp",
  },
  {
    topic: "Pick",
    label: "Pick, our AI assistant",
    title: ["Not sure?", "Ask *Pick*."],
    line: "Tell him what you're after, in your own words. He shows real pieces in stock, in your size.",
    ask: ["Something oversized in M, under 2500", "A black hoodie in L", "A gift for my brother, under 3000"],
    films: [film("ask-pick", 31.1, "/shop", [["Tap Ask Pick", 2.3], ["Tap Pick to chat", 7.6], ["Ask in your own words", 11.1], ["Tap Send", 18], ["Real pieces, in your size", 22.4], ["Add one to your bag", 24.7]])],
    href: "/shop#pick",
    cta: "Shop with Pick",
    layout: "right",
  },
  {
    topic: "Gifts",
    label: "The Gift",
    title: ["Good taste", "makes a", "good *gift*."],
    line: "Send a piece as a gift: they open it, pick their own size, and can swap within 14 days. Or send a gift card, from Rs 1,000.",
    films: [
      film("gift", 59.2, "/gift", [["Send a piece", 1.6], ["Send it as a gift", 5.2], ["Let them pick the size", 9.2], ["Write their name", 15.2], ["Pick the occasion", 21.6], ["Add their email", 28.4], ["Your mobile number", 32.8], ["Tap Pay", 36.8], ["Log in to eSewa", 40.4], ["Enter the code", 46], ["Confirm the payment", 50.8], ["Sent. They pick their size", 56.4]], "A piece"),
      film("giftcards", 38.6, "/gift", [["Pick an amount", 2], ["Write their name", 5.2], ["Add their email", 8], ["Add your name", 12], ["Your mobile number", 14], ["Tap Buy gift card", 17.6], ["Log in to eSewa", 20], ["Enter the code", 25.2], ["Confirm the payment", 30.4], ["Sent, with its code", 36]], "A gift card"),
    ],
    href: "/gift",
    cta: "Send a gift",
    layout: "left",
    photo: "/story/gift-box.webp",
  },
  {
    topic: "Fits",
    label: "Designer Fits",
    title: ["Whole fits,", "*ready*."],
    line: "Ready-made outfits for every occasion. Choose one, pick each size, and buy the whole fit in one go.",
    films: [film("outfits", 47.7, "/fits", [["Choose an occasion", 1.6], ["Browse the fits", 6.4], ["Pick each size", 10.4], ["Tap Quick buy", 15.6], ["Enter your number", 20], ["Tap Pay", 24.8], ["Log in to eSewa", 28.4], ["Enter the code", 34.4], ["Confirm the payment", 39.2], ["Paid. Your order is in", 44.8]])],
    href: "/fits",
    cta: "See the fits",
    layout: "right",
    photo: "/story/flatlay-cargo.webp",
  },
  {
    topic: "Size",
    label: "Your size",
    title: ["Know", "your *size*."],
    line: "Your height and weight, a size you wear, or a piece you own: we work out your size, in cm, once. Every piece opens on it.",
    films: [film("size", 25.4, "/size-guide", [["Tap Find my size", 1.6], ["Use height and weight", 4.8], ["Set your height", 7.6], ["Tap Next", 11.2], ["See your size", 14], ["Save your size", 17.2], ["Your size, already picked", 20.4]])],
    href: "/size-guide",
    cta: "Find my size",
    layout: "left",
    photo: "/story/tee-measure.webp",
  },
  {
    topic: "Vault",
    label: "The Vault",
    title: ["Not", "everything", "is *ordinary*."],
    line: "Original brands and rare pieces, mostly one of each. Choose a brand, see every piece, open the one you want.",
    films: [film("vault", 23.4, "/vault", [["Choose a brand", 2], ["See every piece", 3.6], ["Open a piece", 4.8], ["Pick your size", 13.6], ["Tap Buy now", 16.8]])],
    href: "/vault",
    cta: "Enter the Vault",
    layout: "right",
    photo: "/story/vault.webp",
  },
  {
    topic: "Drop",
    label: "The Drop",
    title: ["New pieces,", "every *drop*."],
    line: "Small batches of new pieces, each on its day. Leave your WhatsApp or email and we send one message when it lands.",
    films: [film("drops", 15.8, "/drops", [["Leave your email", 1.6], ["Tap Notify me", 5.6], ["Shop the drop", 9.6]])],
    href: "/drops",
    cta: "See the drops",
    layout: "left",
    photo: "/story/store-rails.webp",
  },
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

  const storeInfo = await getStoreInfo();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <div className="flex flex-col">
      {/* Above the rail (owner, 26 Oct 2026, after a Zara redesign; plays by itself): EASYPICK with our
          pictures inside the letters, then four tiles. The rail and everything below are as they were. */}
      {on("hero") && (
        <div style={at("hero")}>
          <LandingHero words={WORDS} chapters={CHAPTERS} line={home.hero.eyebrow || "Pick it. Pay it. Wear it."} />
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
          <StoreBand info={storeInfo} store={on("store")} checkout={on("checkout")} />
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
