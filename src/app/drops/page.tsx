import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import { DropStrip } from "@/components/drop-strip";
import { toRailPiece } from "@/components/home/rail";
import { ArrowIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { FlowButton } from "@/components/ui/flow-button";
import { formatDropTime } from "@/lib/format";
import { getDropTimeline, getDrops, getProducts, isReleased } from "@/lib/store";
import type { Drop } from "@/lib/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Drops",
  description: "New Easypick drops every other Friday at 6 PM. See what's coming, what's out now and what sold through.",
  alternates: { canonical: "/drops" },
};

// The page is the clothes: each drop is one band with its pieces as a row of cards swiped sideways
// (the middle one faces out, large; see components/drop-strip.tsx), every one a click from its
// own page. What can be bought comes first (out now), then what is coming
// (with its countdown), then what sold through, kept small. The page opens with a full-screen picture
// of the store carrying its name and the alert sign-up.

type State = "upcoming" | "out" | "archive";

export default async function DropsPage() {
  const [drops, products, { next }] = await Promise.all([getDrops(), getProducts(), getDropTimeline()]);
  const of = (d: Drop) => products.filter((p) => p.dropSlug === d.slug);
  const state = (d: Drop): State => {
    if (!isReleased(d)) return "upcoming";
    const items = of(d);
    return items.length > 0 && items.every((p) => p.status === "sold_out") ? "archive" : "out";
  };
  const out = drops.filter((d) => state(d) === "out");
  const upcoming = drops.filter((d) => state(d) === "upcoming").reverse();
  const archive = drops.filter((d) => state(d) === "archive");

  return (
    <div className="overflow-x-clip">
      {/* The opening: one full screen of the store at dusk (the owner's picture and concept, 10 Oct 2026).
          The page's name and what the alert is for on the left; when drops happen and the sign-up, on a
          sheet of dark glass, on the right. The picture is decoration: every word is real text over it. */}
      <section aria-labelledby="drops-title" className="on-dark relative isolate overflow-hidden bg-[#0c0c0c] text-paper">
        <Image src="/drops/hero.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[62%_center] max-md:hidden" />
        <Image src="/drops/hero-phone.webp" alt="" fill priority sizes="100vw" className="-z-10 object-cover md:hidden" />
        {/* Shade for the words: darker on the left and at the foot, lighter where the rail and the sign are */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.38)_42%,rgba(0,0,0,0.3)_100%)] max-md:bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.55)_45%,rgba(0,0,0,0.85)_100%)]" />

        <div className="container-ep grid min-h-[calc(100svh-72px-56px-env(safe-area-inset-bottom))] content-end gap-8 py-8 md:min-h-[calc(100svh-88px)] md:grid-cols-[minmax(0,1fr)_minmax(0,430px)] md:content-center md:items-center md:gap-12 md:py-14">
          <div className="min-w-0">
            <h1 id="drops-title" className="display text-[clamp(4.5rem,2.6rem+10vw,11.5rem)] leading-[0.8]">
              Drops
            </h1>
            <span aria-hidden className="mt-5 block h-1 w-14 bg-volt md:mt-7" />
            <h2 id="drops-alert" className="mt-5 font-mono text-[clamp(0.95rem,0.8rem+0.7vw,1.45rem)] uppercase leading-snug tracking-[0.14em] md:mt-6">
              {next ? `Be told when ${next.name} lands.` : "Be told about the next one."}
            </h2>
            <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-paper/75 md:text-[17px]">Small batches. Fixed prices. Be the first to know, straight to your WhatsApp or email.</p>
          </div>

          <div className="min-w-0">
            <p className="index text-paper/85 md:text-right">
              Every other Friday · 6 PM
              <span aria-hidden className="mt-2 block h-0.5 w-10 bg-volt md:ml-auto" />
            </p>
            {/* The sign-up, on dark glass */}
            <div className="mt-5 rounded-2xl border border-paper/15 bg-black/45 p-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-md md:mt-7 md:p-6">
              <AlertSignup dark source={next ? `drops-${next.slug}` : "drops"} />
            </div>
          </div>
        </div>
      </section>

      <div className="container-ep pb-24 pt-10 md:pt-16">

      {/* Out now: what can be bought today */}
      {out.length > 0 && (
        <section aria-labelledby="drops-out">
          <h2 id="drops-out" className="index flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 rounded-full bg-volt ring-1 ring-ink/30" />
            Out now
          </h2>
          {out.map((d) => {
            const items = of(d);
            return (
              <article key={d.slug} className="mt-4 border-t border-ink pt-6 [&+article]:mt-14 md:[&+article]:mt-20">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="min-w-0">
                    <h3 className="display text-[clamp(2.6rem,2rem+3vw,4.5rem)] leading-[0.9]">
                      <Link href={`/drop/${d.slug}`} className="inline-block hover:underline hover:decoration-2 hover:underline-offset-4">
                        {d.name}
                      </Link>
                    </h3>
                    {d.story && <p className="mt-2 max-w-[56ch] text-steel-dark">{d.story}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <p className="index text-steel-dark max-md:hidden">
                      {items.length} {items.length === 1 ? "style" : "styles"}
                    </p>
                    <FlowButton href={`/drop/${d.slug}`} text={`Shop Drop ${d.slug}`} solid />
                  </div>
                </div>
                <DropStrip pieces={items.map(toRailPiece)} label={d.name} />
              </article>
            );
          })}
        </section>
      )}

      {/* Coming: the countdown sits with the drop it is about */}
      {upcoming.length > 0 ? (
        <section aria-labelledby="drops-coming" className="mt-16 md:mt-24">
          <h2 id="drops-coming" className="sr-only">
            Coming
          </h2>
          {upcoming.map((d) => {
            return (
              <article key={d.slug} className="border-t border-ink pt-6 [&+article]:mt-14 md:[&+article]:mt-20">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                  <div className="min-w-0">
                    <p className="index text-steel-dark">Coming soon</p>
                    <h3 className="display mt-2 text-[clamp(2.6rem,2rem+3vw,4.5rem)] leading-[0.9]">
                      <Link href={`/drop/${d.slug}`} className="inline-block hover:underline hover:decoration-2 hover:underline-offset-4">
                        {d.name}
                      </Link>
                    </h3>
                    <p className="mt-2 font-mono text-[13px]">Arrives {formatDropTime(d.releaseAt, { bs: true })}</p>
                  </div>
                  <div className="shrink-0">
                    <Countdown to={d.releaseAt} label={d.name} size="sm" />
                  </div>
                </div>
                <DropStrip pieces={of(d).map(toRailPiece)} label={d.name} soon />
              </article>
            );
          })}
        </section>
      ) : null}

      {/* Sold through: kept, and kept small */}
      {archive.length > 0 && (
        <section aria-labelledby="drops-archive" className="mt-16 md:mt-24">
          <h2 id="drops-archive" className="index text-steel-dark">
            Sold through
          </h2>
          <ul className="mt-4 border-t border-ink/20">
            {archive.map((d) => {
              const items = of(d);
              return (
                <li key={d.slug} className="border-b border-ink/20">
                  <Link href={`/drop/${d.slug}`} className="group flex min-h-16 items-center gap-4 py-3 text-steel-dark hover:text-ink">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">{d.name}</span>
                      <span className="block font-mono text-[12px]">
                        {formatDropTime(d.releaseAt)} · {items.length} {items.length === 1 ? "style" : "styles"}
                      </span>
                    </span>
                    <span aria-hidden className="flex shrink-0 gap-1.5 opacity-60 grayscale max-sm:hidden">
                      {items.slice(0, 4).map((p) => (
                        <span key={p.id} className="block w-11">
                          <ProductImage image={p.images[0]} category={p.category} colourHex={p.colours[0].hex} decorative sizes="44px" />
                        </span>
                      ))}
                    </span>
                    <ArrowIcon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      </div>
    </div>
  );
}
