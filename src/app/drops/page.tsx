import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import { DropStrip } from "@/components/drop-strip";
import { toRailPiece } from "@/components/home/rail";
import { ArrowIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { FlowButton } from "@/components/ui/flow-button";
import { HeroPiece } from "@/components/hero-piece";
import { RefreshAt } from "@/components/refresh-at";
import { formatDropTime } from "@/lib/format";
import { cutoutOf } from "@/lib/rack-cutouts";
import { homeSetting } from "@/lib/settings/home";
import { getDropTimeline, getDrops, getProducts, isReleased } from "@/lib/store";
import type { Drop } from "@/lib/types";
import { HowItWorks } from "@/components/how-it-works";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Drops",
  description: "The latest Easypick drop: every piece at one fixed price, and one message when the next one lands.",
  alternates: { canonical: "/drops" },
};

// The Drops page (owner, 26 Oct 2026): the drop opening that used to top the home page, as it was,
// with the old Drops page's "notify me" where "Visit store" was; under it, as before, every drop:
// out now with its pieces, coming with its countdown, and what sold through. The opening's words come
// from Admin → Home page.

type State = "upcoming" | "out" | "archive";
export default async function DropsPage() {
  const [products, { current, next }, home, drops] = await Promise.all([getProducts(), getDropTimeline(), homeSetting.get(), getDrops()]);
  const of = (d: Drop) => products.filter((p) => p.dropSlug === d.slug);
  const state = (d: Drop): State => {
    if (!isReleased(d)) return "upcoming";
    const items = of(d);
    return items.length > 0 && items.every((p) => p.status === "sold_out") ? "archive" : "out";
  };
  const out = drops.filter((d) => state(d) === "out");
  const upcoming = drops.filter((d) => state(d) === "upcoming").reverse();
  const archive = drops.filter((d) => state(d) === "archive");
  const drop = current ?? next;
  const range = products.filter((p) => !p.vault);
  const withPhoto = range.filter((p) => cutoutOf(p) && (home.hero.showUnavailable || (p.status === "live" && p.variants.some((v) => v.stock > 0))));
  const buyable = (p: (typeof range)[number]) => p.status === "live" && p.variants.some((v) => v.stock > 0);
  const inTurn = (list: typeof withPhoto) => {
    const kinds = home.hero.kinds.map((k) => list.filter((p) => p.category === k));
    const out: typeof withPhoto = [];
    for (let round = 0; kinds.some((l) => l.length > round); round++) for (const l of kinds) if (l[round]) out.push(l[round]);
    return out;
  };
  const heroPieces = [...inTurn(withPhoto.filter(buyable)), ...inTurn(withPhoto.filter((p) => !buyable(p)))];
  return (
    <>
      {/* The drop: one piece and its price tag, the words, and the drop's numbers */}
      <section aria-labelledby="hero-title" className="bg-paper text-ink">
        <div className="container-ep grid min-h-[calc(100svh-56px-env(safe-area-inset-bottom))] grid-rows-[auto_1fr_auto] gap-y-8 pb-6 pt-[80px] md:pt-[104px] lg:min-h-svh lg:grid-cols-12 lg:grid-rows-[1fr_auto] lg:gap-x-6 lg:pt-[116px]">
          {/* Stage */}
          <div className="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:self-center">
            {/* One piece, large, with its price tag hanging beside it; the row under it switches the piece */}
            <HeroPiece seconds={home.hero.seconds} pieces={heroPieces.map((p) => ({ product: p, colour: p.colours[0], note: buyable(p) ? null : p.status === "scheduled" ? "Coming soon" : "Sold out" }))} />
          </div>

          {/* Words */}
          <div className="flex flex-col justify-end lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:justify-center lg:pb-10">
            {home.hero.eyebrow && (
              <p className="eyebrow flex w-fit items-center gap-2 rounded-[2px] bg-volt px-3 py-1.5 text-ink">
                <span className="h-1.5 w-1.5 bg-ink" aria-hidden />
                {home.hero.eyebrow}
              </p>
            )}
            <h1 id="hero-title" className="display display-hero mt-4">
              {current ? (
                <>
                  Drop {current.slug}.
                  <br />
                  Out now.
                </>
              ) : next ? (
                <>
                  Drop {next.slug}.
                  <br />
                  {formatDropTime(next.releaseAt).split(",")[0]}.
                </>
              ) : (
                <>
                  {home.hero.fallback[0]}
                  <br />
                  {home.hero.fallback[1]}
                </>
              )}
            </h1>
            {/* Why the store exists, in the owner's words: one calm line, then the small print (owner, 25 Oct 2026: "too much clutter"). */}
            <div className="mt-5 max-w-[440px]">
              <p className="text-[17px] font-semibold leading-snug sm:text-[19px]">
                {home.hero.pitch} <span className="font-normal text-steel-dark">{home.hero.pitchQuiet}</span>
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/65">
                {home.hero.line1} {home.hero.line2}
              </p>
            </div>
            <HowItWorks guide="drops" className="mt-4" />
            {/* One clear way in (the drop) and a quiet link to the store, on one line. */}
            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link
                href={drop ? `/drop/${drop.slug}` : "/shop"}
                className="group inline-flex h-12 items-center gap-3 rounded-full bg-ink px-7 text-[13px] font-semibold uppercase tracking-[0.08em] text-paper transition-colors hover:bg-ink/85"
              >
                {drop ? home.hero.dropButton.replace("{n}", drop.slug) : home.hero.noDropButton}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                  <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </Link>
            </div>
            {/* "Notify me", as the old Drops page had it, where "Visit store" was (owner, 26 Oct 2026) */}
            <div className="mt-7 max-w-[440px]">
              <p className="text-[14px] leading-snug text-ink/70">{next ? `${next.name} lands soon.` : "The next drop lands soon."} Get one message when it&apos;s out.</p>
              <div className="mt-3">
                <AlertSignup source={next ? `drops-${next.slug}` : "drops"} />
              </div>
            </div>
          </div>

          {/* At the end: the drop and its countdown, in the middle. */}
          <div className="flex flex-col items-center gap-3 border-t border-ink/15 pt-5 text-center lg:col-span-12 lg:row-start-2">
            <p className="index text-center text-ink/70">
              {next ? `Drop ${next.slug} opens in` : current ? `${current.name} · out now` : "Kathmandu"}
            </p>
            <div className="flex justify-center">{next && <Countdown to={next.releaseAt} label={next.name} size="sm" seconds />}</div>
          </div>
        </div>
      </section>

      {/* Every drop, as the Drops page always had it */}
      <div className="overflow-x-clip">
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
                    <Countdown to={d.releaseAt} label={d.name} size="sm" seconds />
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
      {next && <RefreshAt at={next.releaseAt} />}
    </>
  );
}
