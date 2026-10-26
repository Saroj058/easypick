import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { Countdown } from "@/components/countdown";
import { HeroPiece } from "@/components/hero-piece";
import { RefreshAt } from "@/components/refresh-at";
import { formatDropTime } from "@/lib/format";
import { cutoutOf } from "@/lib/rack-cutouts";
import { homeSetting } from "@/lib/settings/home";
import { getDropTimeline, getProducts } from "@/lib/store";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Drops",
  description: "The latest Easypick drop: every piece at one fixed price, and one message when the next one lands.",
  alternates: { canonical: "/drops" },
};

// The Drops page (owner, 26 Oct 2026): the drop opening that used to top the home page, as it was,
// with the old Drops page's "notify me" where "Visit store" was. The rest of the old Drops page is
// gone; each drop keeps its own page (/drop/07). The words come from Admin → Home page.
export default async function DropsPage() {
  const [products, { current, next }, home] = await Promise.all([getProducts(), getDropTimeline(), homeSetting.get()]);
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
      {next && <RefreshAt at={next.releaseAt} />}
    </>
  );
}
