import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import { ProductCard } from "@/components/product-card";
import { RefreshAt } from "@/components/refresh-at";
import { ShareDrop } from "@/components/share-drop";
import { formatDropTime } from "@/lib/format";
import { sellable } from "@/lib/inventory";
import { getDrop, getDrops, getDropTimeline, getProducts, isReleased } from "@/lib/store";

// Short, so the page turns buyable within moments of the drop opening.
export const revalidate = 30;

export async function generateStaticParams() {
  return (await getDrops()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/drop/[slug]">): Promise<Metadata> {
  const drop = await getDrop((await params).slug);
  if (!drop) return {};
  return { title: drop.name, description: `${drop.story} ${drop.pieceCount} pieces.`, alternates: { canonical: `/drop/${drop.slug}` } };
}

export default async function DropPage({ params }: PageProps<"/drop/[slug]">) {
  const { slug } = await params;
  const drop = await getDrop(slug);
  if (!drop) notFound();

  const [all, { next }] = await Promise.all([getProducts(), getDropTimeline()]);
  const released = isReleased(drop);
  // Pieces you can still buy come first.
  const products = all.filter((p) => p.dropSlug === drop.slug).sort((a, b) => Number(a.status === "sold_out") - Number(b.status === "sold_out"));

  // What can still be bought online, against how many the drop started with.
  const left = products.reduce((n, p) => n + (p.status === "live" ? p.variants.reduce((m, v) => m + sellable(v), 0) : 0), 0);
  const total = Math.max(drop.pieceCount, left);
  const soldOut = released && products.length > 0 && products.every((p) => p.status === "sold_out");
  const stylesGone = products.filter((p) => p.status === "sold_out").length;
  const upcoming = next && next.slug !== drop.slug ? next : null;

  return (
    <>
      {/* Masthead: the drop as a numbered run. */}
      <section className="pb-10 pt-14 md:pb-14 md:pt-24">
        <div className="container-ep">
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-steel-dark">
            EP / {drop.name} / {drop.pieceCount} pieces / {formatDropTime(drop.releaseAt, { bs: true })}
          </p>
          <div className="mt-4 grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <p aria-hidden className="display text-[clamp(7rem,6rem+16vw,17rem)] leading-[0.78] lg:col-span-5">
              {drop.slug}
            </p>
            <div className="lg:col-span-7">
              <span className={released && !soldOut ? "tag-volt" : "index bg-photo px-2 py-1"}>
                {soldOut ? "Sold out" : released ? "Out now" : `Arrives ${formatDropTime(drop.releaseAt)}`}
              </span>
              <h1 className="display display-h1 mt-3">{drop.name}</h1>
              {drop.story && <p className="mt-3 max-w-[46ch] text-lg text-steel-dark md:text-xl">{drop.story}</p>}

              {released && !soldOut && total > 0 && (
                <div className="mt-6 max-w-sm">
                  <p className="font-mono text-[15px]">
                    <span className="font-semibold tabular-nums">{left}</span> of <span className="tabular-nums">{total}</span> left
                    {stylesGone > 0 && <span className="text-steel-dark"> · {stylesGone} sold out</span>}
                  </p>
                  <div className="mt-2 h-1 bg-mist" aria-hidden>
                    <div className="h-full bg-ink" style={{ width: `${Math.round((left / total) * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className="mt-5">
                <ShareDrop slug={drop.slug} name={drop.name} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-ep pb-24">
        {!released && (
          <div className="mb-10">
            <Countdown to={drop.releaseAt} label={drop.name} />
            <RefreshAt at={drop.releaseAt} />
            <p className="mt-4 max-w-[52ch] text-steel-dark">Every piece is below with its price and sizes. Pick yours now, and it takes seconds when it opens.</p>
          </div>
        )}
        {!released && (
          <section aria-label="Get a message when it drops" className="mb-12 bg-photo p-6 md:p-10">
            <p className="mb-5 text-lg font-semibold">Get one message on drop day.</p>
            <AlertSignup source={`drop-${drop.slug}`} />
          </section>
        )}

        {/* Sold through: point at what's next instead of a dead end. */}
        {soldOut && (
          <section aria-labelledby="next-title" className="mb-12 grid gap-8 bg-photo p-6 md:grid-cols-2 md:items-center md:p-10">
            <div>
              <h2 id="next-title" className="text-2xl font-semibold">
                {upcoming ? `${upcoming.name} arrives ${formatDropTime(upcoming.releaseAt)}.` : "The next drop is on its way."}
              </h2>
              <p className="mt-2 text-steel-dark">{drop.name} sold through. Get one message on the day the next one opens.</p>
              {upcoming && (
                <div className="mt-5">
                  <Countdown to={upcoming.releaseAt} label={upcoming.name} size="sm" />
                </div>
              )}
            </div>
            <AlertSignup source={`drop-${drop.slug}-soldout`} />
          </section>
        )}


        <h2 className="sr-only">The pieces</h2>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <li key={p.id}>
              <ProductCard
                product={p}
                priority={i < 2}
                plate={`${drop.slug}/${String(i + 1).padStart(2, "0")}`}
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              />
            </li>
          ))}
        </ul>

        {released && !soldOut && upcoming && (
          <section aria-label="Hear about the next drop" className="mt-16 bg-photo p-6 md:p-10">
            <p className="mb-5 text-lg font-semibold">
              {upcoming.name} arrives {formatDropTime(upcoming.releaseAt)}. Get one message that day.
            </p>
            <AlertSignup source={`drop-${drop.slug}-next`} />
          </section>
        )}
      </div>
    </>
  );
}
