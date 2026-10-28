import type { Metadata } from "next";
import Link from "next/link";

import { StoryFilm } from "@/components/landing/story-film";
import { PageIntro } from "@/components/page-intro";
import { getProducts } from "@/lib/store";
import { siteSetting } from "@/lib/settings/site";
import { socialLinks } from "@/lib/settings/site-rules";

export const metadata: Metadata = {
  title: "About",
  description: "Easypick is a self-checkout clothing store in Kathmandu. Fair fixed prices, no pushy selling, new drops every two weeks.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const [settings, products] = await Promise.all([siteSetting.get(), getProducts()]);
  const social = socialLinks(settings);
  // The pieces for the cards at the end of the story film, as on the home page.
  const pieces = products
    .filter((p) => !p.vault && p.status === "live" && p.images[0])
    .sort((a, b) => Number(!!b.images[0].src) - Number(!!a.images[0].src))
    .slice(0, 30)
    .map((p) => ({ slug: p.slug, name: p.name, price: p.salePrice ?? p.price, category: p.category, hex: p.colours[0]?.hex ?? "#d9d9d6", image: p.images[0] }));
  return (
    <>
      {/* The brand's story as a film, every time the page opens (owner, 28 Oct 2026: "that full story should be on about us") */}
      <section aria-label="Our story" className="relative isolate h-[calc(100svh-62px-env(safe-area-inset-bottom))] min-h-[560px] overflow-hidden bg-white md:min-h-[640px] lg:h-svh">
        <StoryFilm pieces={pieces} story once={false} heading={false}>
          <Link href="/shop" className="sf-shop">
            Shop now
          </Link>
        </StoryFilm>
      </section>
      {/* The founder's own note, on its own page */}
      <Link href="/about/founder" className="group block border-b border-mist bg-paper">
        <span className="container-ep flex items-center justify-between gap-4 py-5">
          <span>
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">From the founder</span>
            <span className="mt-1 block font-didone text-[22px] font-bold leading-tight">A note from Saroj Devkota</span>
          </span>
          <span aria-hidden className="text-xl transition-transform group-hover:translate-x-1">
            →
          </span>
        </span>
      </Link>
      <PageIntro dark eyebrow="About" title="Shopping, minus the pressure." />
      <section className="section">
        <div className="container-ep max-w-3xl space-y-6 text-lg">
          <p>
            Buying clothes in Kathmandu usually means a salesperson at your shoulder and a price you have to argue down. We wanted a
            store where you can just look.
          </p>
          <p>
            At Easypick every price is on the tag, and it&apos;s the same one you&apos;d pay online. Every tag shows the garment&apos;s
            measurements, so you can find your size without asking. You try things on, pay at the kiosk with the wallet you already use,
            and walk out.
          </p>
          <p>
            We keep the range simple: good basics that fit, and a small drop of new pieces every other Friday. Small batches mean less
            waste and more reasons to come back.
          </p>
          <p>Someone&apos;s always around if you want a hand. If you don&apos;t, that&apos;s fine too.</p>
        </div>
        {social.length > 0 && (
          <div className="container-ep mt-12 flex max-w-3xl flex-wrap gap-3">
            {social.map((x, i) => (
              <a key={x.name} href={x.href} target="_blank" rel="noopener" className={`btn ${i === 0 ? "btn-ink" : "btn-outline"}`}>
                {x.name}
              </a>
            ))}
          </div>
        )}
        <p className="container-ep mt-12 max-w-3xl text-steel-dark">
          <Link href="/how-it-works" className="underline">
            How the store works
          </Link>
        </p>
      </section>
    </>
  );
}
