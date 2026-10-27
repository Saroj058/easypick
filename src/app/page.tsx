import type { Metadata } from "next";

import { FitsTeaser } from "@/components/home/fits-teaser";
import { GiftBlock } from "@/components/home/gift-block";
import { StoreBand } from "@/components/home/store-band";
import { Rail, toRailPiece } from "@/components/home/rail";
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

// The pictures inside the letters, and the four tiles above the rail (owner: "use the current images").
// Only the darker pictures, so the letters read crisp (owner, 26 Oct 2026: "make that hero better").
const WORDS = ["/drops/hero-2.webp", "/visit/store-night-open.avif", "/visit/door-poster.avif", "/visit/store-dusk-open.avif"];
// What plays after the word (owner, 27 Oct 2026: their cards, their names; "show how shopping, gifts,
// gift cards, Pick, the Vault, the fits and the drops work, recorded on the real site"). The how-to
// cards play a recording of the site in use (public/story/video, made on a test copy: no real orders),
// a little faster than life; each stays as long as its clip. Every fact is checked against the code.
/** A recording: how long it runs (s), played at up to 2× so it never drags. */
const clip = (name: string, seconds: number) => {
  const rate = Math.min(2, Math.max(1, seconds / 6.5));
  return { video: { src: `/story/video/${name}.webm`, poster: `/story/video/${name}.webp`, rate }, beat: Math.round((seconds / rate) * 1000 + 1600) };
};
const CHAPTERS: ChapterData[] = [
  { label: "Meet Easypick", title: ["Shopping,", "made *simple*."], line: "A men's streetwear store in Kathmandu, built around everyday style, fixed prices and a simpler way to shop.", facts: ["Men's streetwear", "Online and in store"], href: "/about", cta: "Our story", layout: "left", big: "/story/storefront.webp", bigAt: "40% 50%", small: "/story/man-backpack.webp" },
  { label: "Why Easypick", title: ["The price", "is the *price*."], line: "No bargaining. No awkward asking. Clear prices, good clothes, and time to shop at your own pace.", facts: ["Price on every tag", "Same online and in store"], href: "/how-it-works", cta: "How the store works", layout: "right", big: "/story/tees-rail.webp", bigAt: "40% 50%", small: "/story/hang-tag.webp" },
  { label: "How shopping works", title: ["Pick it.", "Pay it.", "*Wear it.*"], line: "Swipe the rail, pick your size, tap Buy now, give your number, and pay with eSewa. In the store, pay at the kiosk.", steps: ["Pick a size", "Buy now", "Pay with eSewa"], href: "/how-it-works", cta: "How it works", layout: "left", big: "/story/phone.webp", ...clip("shop", 15.0) },
  { label: "The Rail", title: ["Find your", "next", "*favourite*."], line: "Everyday pieces on one rail per kind. Swipe along, stop on one, pick your size and buy.", steps: ["Swipe", "Pick a size", "Buy now"], href: "/the-rail", cta: "Explore the rail", layout: "right", big: "/story/rails.webp" },
  { label: "The Pick", title: ["Your style.", "Your *choice*."], line: "Pick a top, a bottom and a layer. The total adds up as you go, and the whole fit goes in your bag.", steps: ["Pick a top", "Add a bottom", "Take the fit"], href: "/fit", cta: "Build your fit", layout: "left", big: "/story/flatlay-cargo.webp", ...clip("pick", 6.7) },
  { label: "The Gift", title: ["Good taste", "makes a", "good *gift*."], line: "Choose a piece and send it as a gift. They open it, pick their own size, and can swap within 14 days.", steps: ["Choose a piece", "Send as a gift", "They pick a size"], href: "/gift", cta: "Send a gift", layout: "right", big: "/story/gift-box.webp", ...clip("gift", 5.4) },
  { label: "Gift cards", title: ["Let them", "*choose*."], line: "Pick a card from Rs 1,000, add their name and pay. It arrives by email, works online and in the store, for 12 months.", steps: ["Pick an amount", "Their name", "Pay"], href: "/gift#buy", cta: "Send a gift card", layout: "left", big: "/story/gift-card.webp", ...clip("giftcards", 7.8) },
  { label: "The Fits", title: ["Know", "your *fit*."], line: "Your height and weight, a size you wear, or a piece you own: we work out your size, in cm, once.", steps: ["Height and weight", "Your build", "Your size"], href: "/size-guide", cta: "Find my size", layout: "right", big: "/story/tee-measure.webp", ...clip("fits", 12.5) },
  { label: "The Vault", title: ["Not", "everything", "is *ordinary*."], line: "Original brands and rare pieces, mostly one of each. Choose a brand, see every piece, open the one you want.", steps: ["Choose a brand", "Every piece", "Open one"], href: "/vault", cta: "Enter the Vault", layout: "left", big: "/story/vault.webp", ...clip("vault", 5.1) },
  { label: "The Drop", title: ["New pieces,", "every *drop*."], line: "Small batches of new pieces, each on its day. Leave your WhatsApp or email and we send one message when it lands.", steps: ["See the drop", "Notify me", "One message"], href: "/drops", cta: "See the drops", layout: "right", big: "/story/store-rails.webp", ...clip("drops", 6.4) },
  { label: "To Your Door", title: ["Your picks.", "Your *place*."], line: "Shop online and pay with eSewa. Kathmandu the next day, Lalitpur and Bhaktapur in one to two, or pick it up free.", steps: ["Buy now", "Pay", "At your door"], href: "/delivery", cta: "Delivery and pickup", layout: "left", big: "/story/door-box.webp", scene: { kind: "door" } },
  { label: "Easypick", title: ["Pick it.", "Pay it.", "*Wear it.*"], line: "Great everyday clothing. Clear prices. A simpler way to shop.", facts: ["Men's streetwear", "Kathmandu"], href: "/shop", cta: "Shop now", layout: "right", big: "/story/bag.webp", scene: { kind: "close" } },
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

  // The rail card's lesson plays on real pieces in stock; The Fits measures a real tee.
  const lessonPieces = range.filter((p) => p.status === "live" && p.images[0]?.src && p.variants.some((v) => v.stock > 0)).slice(0, 7).map(toRailPiece);
  const tee = products.find((p) => p.slug === "oversized-heavy-tee")?.measurements.M;
  const marks = Object.entries(tee ?? {}).filter(([k, v]) => typeof v === "number" && ["chest", "length", "sleeve"].includes(k)) as [string, number][];
  // The store's state comes from Admin → Visit, the same as the store line further down.
  const storeInfo = await getStoreInfo();
  const story = CHAPTERS.map((c) =>
    c.label === "How shopping works" && !storeInfo.opened ? { ...c, line: c.line.replace("In the store, pay", "In the store (opening soon), pay") } : c,
  ).map((c) =>
    c.href === "/the-rail" && lessonPieces.length >= 3 ? { ...c, lesson: lessonPieces, beat: 8600 } : c.scene?.kind === "fits" ? (marks.length ? { ...c, scene: { kind: "fits" as const, marks } } : { ...c, scene: undefined }) : c,
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <div className="flex flex-col">
      {/* Above the rail (owner, 26 Oct 2026, after a Zara redesign; plays by itself): EASYPICK with our
          pictures inside the letters, then four tiles. The rail and everything below are as they were. */}
      {on("hero") && (
        <div style={at("hero")}>
          <LandingHero words={WORDS} chapters={story} line={home.hero.eyebrow || "Pick it. Pay it. Wear it."} />
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
