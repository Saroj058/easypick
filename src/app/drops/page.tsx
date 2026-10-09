import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import { DropStrip, type DropPiece } from "@/components/drop-strip";
import { ArrowIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { FlowButton } from "@/components/ui/flow-button";
import { formatDropTime } from "@/lib/format";
import { getDropTimeline, getDrops, getProducts, isReleased } from "@/lib/store";
import type { Drop, Product, Size } from "@/lib/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Drops",
  description: "New Easypick drops every other Friday at 6 PM. See what's coming, what's out now and what sold through.",
  alternates: { canonical: "/drops" },
};

// The page is the clothes: each drop is one band with its pieces as a row of cards swiped sideways
// (the middle one faces out, large; see components/drop-strip.tsx), every one a click from its
// own page. What can be bought comes first (out now), then what is coming
// (with its countdown), then what sold through, kept small. The alert sign-up is at the top.

type State = "upcoming" | "out" | "archive";
const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

/** What the carousel needs of each piece: its photo, name, fixed price and the sizes left. */
function asPieces(items: Product[]): DropPiece[] {
  return items.map((p) => {
    const colour = p.colours[0];
    const sizes = p.variants
      .filter((v) => v.colour === colour.name)
      .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size))
      .map((v) => ({ size: v.size as string, stock: v.stock }));
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: p.salePrice ?? p.price,
      image: p.images[0],
      category: p.category,
      hex: colour.hex,
      sizes,
      gone: p.status === "sold_out" || p.variants.every((v) => v.stock <= 0),
    };
  });
}

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
      <div className="container-ep pb-24 pt-12 md:pt-20">
      <div className="flex items-end justify-between gap-4">
        <h1 className="display display-h1">Drops</h1>
        <p className="index pb-2 text-right text-steel-dark">Every other Friday · 6 PM</p>
      </div>

      {/* The alert sign-up, first thing on the page: one message on each drop day */}
      <section aria-labelledby="drops-alert" className="mt-8 flex flex-col gap-5 border-y border-ink py-6 md:mt-10 md:flex-row md:items-center md:justify-between">
        <h2 id="drops-alert" className="display text-[clamp(1.8rem,1.5rem+1.6vw,2.6rem)] leading-[0.95]">
          {next ? `Be told when ${next.name} lands.` : "Be told about the next one."}
        </h2>
        <div className="w-full md:max-w-[420px]">
          <AlertSignup source={next ? `drops-${next.slug}` : "drops"} />
        </div>
      </section>

      {/* Out now: what can be bought today */}
      {out.length > 0 && (
        <section aria-labelledby="drops-out" className="mt-10 md:mt-14">
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
                <DropStrip pieces={asPieces(items)} label={d.name} />
              </article>
            );
          })}
        </section>
      )}

      {/* Coming: the countdown sits with the drop it is about */}
      {upcoming.length > 0 ? (
        <section aria-labelledby="drops-coming" className="mt-16 md:mt-24">
          <h2 id="drops-coming" className="index">
            Coming
          </h2>
          {upcoming.map((d) => {
            const first = next?.slug === d.slug;
            return (
              <article key={d.slug} className="mt-4 border-t border-ink pt-6 [&+article]:mt-14 md:[&+article]:mt-20">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                  <div className="min-w-0">
                    <h3 className="display text-[clamp(2.2rem,1.8rem+2.4vw,3.6rem)] leading-[0.9]">
                      <Link href={`/drop/${d.slug}`} className="inline-block hover:underline hover:decoration-2 hover:underline-offset-4">
                        {d.name}
                      </Link>
                    </h3>
                    <p className="mt-2 font-mono text-[13px]">Arrives {formatDropTime(d.releaseAt, { bs: true })}</p>
                    {first && (
                      <div className="mt-4">
                        <Countdown to={d.releaseAt} label={d.name} size="sm" />
                      </div>
                    )}
                  </div>
                </div>
                <DropStrip pieces={asPieces(of(d))} label={d.name} />
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
