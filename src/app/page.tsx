import type { Metadata } from "next";

import { LandingChapters, type Chapter } from "@/components/landing/landing-chapters";
import { LandingHero, type LandingTile } from "@/components/landing/landing-hero";
import { formatDropTime } from "@/lib/format";
import { jsonLd } from "@/lib/json-ld";
import { siteSetting } from "@/lib/settings/site";
import { socialLinks } from "@/lib/settings/site-rules";
import { site } from "@/lib/site";
import { getDropTimeline } from "@/lib/store";

export const revalidate = 60;

// The home page (owner, 26 Oct 2026): image-led, after a Zara redesign and a parallax editorial.
// EASYPICK huge with our black-and-white pictures inside the letters, opening into four tiles
// (Tees, Hoodies, Jackets, Bottoms), then the store in six chapters. What was the home page is
// now the Drops page (app/drops/page.tsx).

export const metadata: Metadata = {
  title: { absolute: "Easypick: men's streetwear, Kathmandu" },
  alternates: { canonical: "/" },
};

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
    {
      "@type": "WebSite",
      name: site.name,
      url: site.url,
      publisher: { "@id": `${site.url}/#org` },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${site.url}/shop?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ],
};

// The pictures inside the letters, and the four tiles (owner: "use the current images, everything available").
const WORDS = ["/drops/hero-2.webp", "/drops/hero-showroom.webp", "/visit/door-poster.avif", "/gift/hero-white.webp"];
const TILES: LandingTile[] = [
  { label: "Tees", href: "/shop?category=tees", images: ["/products/oversized-heavy-tee/front.jpg", "/products/boxy-pocket-tee/front.jpg"] },
  { label: "Hoodies", href: "/shop?category=hoodies,sweatshirts", images: ["/products/everyday-hoodie/front.jpg", "/products/brushed-crewneck/front.jpg", "/products/fleece-quarter-zip/front.jpg"] },
  { label: "Jackets", href: "/shop?category=jackets", images: ["/poses/coach-jacket-1.webp", "/products/coach-jacket/front.jpg", "/poses/coach-jacket-2.webp", "/poses/coach-jacket-3.webp"] },
  { label: "Bottoms", href: "/shop?category=jeans,trousers,joggers,shorts", images: ["/products/relaxed-straight-jean/front.jpg", "/products/tapered-jogger/front.jpg", "/products/wide-cargo-pant/front.jpg"] },
];

export default async function HomePage() {
  const [{ current, next }, siteSettings] = await Promise.all([getDropTimeline(), siteSetting.get()]);
  // The organisation's social profiles for search engines (Admin → Site settings).
  const ld = { ...orgLd, "@graph": [{ ...orgLd["@graph"][0], sameAs: socialLinks(siteSettings).map((x) => x.href) }, orgLd["@graph"][1]] };
  const drop = current ?? next;

  const chapters: Chapter[] = [
    {
      title: drop ? [`Drop ${drop.slug}`, current ? "Out now" : formatDropTime(drop.releaseAt).split(",")[0]] : ["The drops", "Every other Friday"],
      text: drop ? `${drop.name}. New pieces every other Friday at 6 PM, at one fixed price online and in store.` : "New pieces every other Friday at 6 PM, at one fixed price online and in store.",
      link: { href: "/drops", label: "Shop the drop" },
      image: "/drops/hero-2.webp",
      small: "/drops/hero-showroom.webp",
    },
    {
      title: ["Designer", "Fits"],
      text: "Whole outfits for every occasion, put together for you. Add the fit to your bag in one go.",
      link: { href: "/fits", label: "See the fits" },
      image: "/poses/coach-jacket-1.webp",
      small: "/poses/coach-jacket-3.webp",
    },
    {
      title: ["The", "Vault"],
      text: "Original brands, checked by hand. One of each, never restocked.",
      link: { href: "/vault", label: "Enter the Vault" },
      image: "/vault/hero-figure.webp",
      figure: { src: "/vault/hero-figure.webp", width: 410, height: 925 },
    },
    {
      title: ["Buy for", "someone"],
      text: "Send a piece, or a gift card. They pick their own size, or swap it in the store.",
      link: { href: "/gift", label: "Send a gift" },
      image: "/gift/hero-white.webp",
      small: "/gift-cards/back.webp",
    },
    {
      title: ["Try it on", "in store"],
      text: "Every piece, at the same price as online. Walk the store from here before you come.",
      link: { href: "/visit", label: "Plan a visit" },
      image: "/visit/store-night-open-tall.avif",
      small: "/visit/door-poster.avif",
    },
    {
      title: ["Hear it", "first"],
      text: "One message when a drop lands. Stop anytime.",
      image: "/drops/hero-showroom.webp",
      signup: true,
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <LandingHero words={WORDS} tiles={TILES} />
      <LandingChapters chapters={chapters} />
    </>
  );
}
