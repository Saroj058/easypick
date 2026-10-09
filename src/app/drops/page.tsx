import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import { ArrowIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { FlowButton } from "@/components/ui/flow-button";
import { formatDropTime, formatPrice } from "@/lib/format";
import { getDropTimeline, getDrops, getProducts, isReleased } from "@/lib/store";
import type { Drop, Product, Size } from "@/lib/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Drops",
  description: "New Easypick drops every other Friday at 6 PM. See what's coming, what's out now and what sold through.",
  alternates: { canonical: "/drops" },
};

// The page is the clothes: each drop is one band with a row of its pieces, large, every one a
// single click from its own page. What can be bought comes first (out now), then what is coming
// (with its countdown and the alert sign-up), then what sold through, kept small.

type State = "upcoming" | "out" | "archive";
const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

/** One piece in a drop's row: its photo, name and fixed price; its sizes slide up when pointed at. */
function Piece({ p, quiet = false, priority = false }: { p: Product; quiet?: boolean; priority?: boolean }) {
  const colour = p.colours[0];
  const sizes = p.variants.filter((v) => v.colour === colour.name).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  const left = p.variants.reduce((n, v) => n + v.stock, 0);
  const gone = p.status === "sold_out" || left === 0;
  const oneSize = sizes.length === 1 && sizes[0].size === "ONE";
  const sizeLine = oneSize
    ? "One size"
    : sizes.map((v) =>
        v.stock > 0 ? (
          <span key={v.sku}>{v.size}</span>
        ) : (
          <s key={v.sku} className="text-steel-dark">
            {v.size}
          </s>
        ),
      );
  return (
    // "relative": the screen-reader-only "Sizes:" label is absolutely placed, and without a positioned
    // parent inside the swipe row it escapes the row's clipping and makes the whole page wider on phones.
    <li className="relative w-[68%] shrink-0 snap-start sm:w-[42%] md:w-auto">
      <Link href={`/product/${p.slug}`} className="group block">
        <div className="relative overflow-hidden">
          <ProductImage
            image={p.images[0]}
            category={p.category}
            colourHex={colour.hex}
            decorative
            priority={priority}
            sizes="(min-width: 768px) 25vw, 68vw"
            className={`transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-[1.04] ${quiet || gone ? "opacity-55 grayscale" : ""}`}
          />
          {gone ? (
            <span className="index absolute left-2 top-2 bg-paper px-2 py-1">Gone</span>
          ) : (
            !quiet && left <= 3 && <span className="index absolute left-2 top-2 bg-ink px-2 py-1 text-paper">{left} left</span>
          )}
          {/* The sizes, sliding up from the photo's foot when it is pointed at */}
          <p aria-hidden className="absolute inset-x-0 bottom-0 flex translate-y-full justify-center gap-3 bg-paper/95 py-2.5 font-mono text-[12px] transition-transform duration-300 ease-out [@media(hover:hover)]:group-hover:translate-y-0">
            {sizeLine}
          </p>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <h4 className="min-w-0 truncate text-[15px] font-semibold group-hover:underline">{p.name}</h4>
          <p className="shrink-0 font-mono text-[13px] tabular-nums">{formatPrice(p.salePrice ?? p.price)}</p>
        </div>
        {/* On touch screens nothing is hidden behind pointing: the sizes are always there */}
        <p className="mt-1 flex gap-2.5 font-mono text-[12px] text-ink/80 [@media(hover:hover)]:hidden">
          <span className="sr-only">Sizes: </span>
          {sizeLine}
        </p>
      </Link>
    </li>
  );
}

/** A drop's pieces in one row: a swipe row on phones, four across on desktop. */
function Row({ items, quiet = false, lead = false }: { items: Product[]; quiet?: boolean; lead?: boolean }) {
  if (items.length === 0) return null;
  return (
    <ul className="-mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:gap-x-5 md:gap-y-10 md:overflow-visible md:px-0 md:pb-0">
      {items.map((p, i) => (
        <Piece key={p.id} p={p} quiet={quiet} priority={lead && i < 2} />
      ))}
    </ul>
  );
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

  /** The alert sign-up, once: beside the next drop if there is one, else on its own after what is out. */
  const signup = (source: string) => (
    <div className="w-full md:max-w-[420px]">
      <AlertSignup source={source} />
    </div>
  );

  return (
    <div className="container-ep pb-24 pt-12 md:pt-20">
      <div className="flex items-end justify-between gap-4">
        <h1 className="display display-h1">Drops</h1>
        <p className="index pb-2 text-right text-steel-dark">Every other Friday · 6 PM</p>
      </div>

      {/* Out now: what can be bought today */}
      {out.length > 0 && (
        <section aria-labelledby="drops-out" className="mt-10 md:mt-14">
          <h2 id="drops-out" className="index flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 rounded-full bg-volt ring-1 ring-ink/30" />
            Out now
          </h2>
          {out.map((d, i) => {
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
                <Row items={items} lead={i === 0} />
              </article>
            );
          })}
        </section>
      )}

      {/* Coming: the countdown and the alert sit with the drop they are about */}
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
                  {first && signup(`drops-${d.slug}`)}
                </div>
                <Row items={of(d)} />
              </article>
            );
          })}
        </section>
      ) : (
        <section aria-labelledby="drops-alert" className="mt-16 flex flex-col gap-5 border-t border-ink pt-6 md:mt-24 md:flex-row md:items-center md:justify-between">
          <h2 id="drops-alert" className="display text-[clamp(1.8rem,1.5rem+1.6vw,2.6rem)] leading-[0.95]">
            Be told about the next one.
          </h2>
          {signup("drops")}
        </section>
      )}

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
  );
}
