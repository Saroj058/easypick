import Link from "next/link";

import { GiftCardArt } from "@/components/gift-card-art";
import { ArrowIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

// Five ways to open the Gift page ("I am buying for someone"), for the owner to choose between.
// Shown only at /gift?design=1…5; without that mark the page is as it was. Each one replaces the
// top of the page (the headline and the piece-or-card choice) and hands on to the same lists below.
// All of them are plain links: nothing here needs JavaScript.

export const DESIGNS = [
  { n: 1, name: "Who is it for" },
  { n: 2, name: "The box" },
  { n: 3, name: "The receipt" },
  { n: 4, name: "Budget first" },
  { n: 5, name: "One sentence" },
] as const;
export type DesignNo = (typeof DESIGNS)[number]["n"];

export const WHO = [
  { key: "brother", label: "Brother", phrase: "your brother" },
  { key: "friend", label: "Friend", phrase: "a friend" },
  { key: "partner", label: "Partner", phrase: "your partner" },
  { key: "dad", label: "Dad", phrase: "your dad" },
  { key: "colleague", label: "Colleague", phrase: "a colleague" },
  { key: "myself", label: "Myself", phrase: "yourself" },
] as const;
export type WhoKey = (typeof WHO)[number]["key"];

export interface OpenerProps {
  /** "Dashain" while a festival is on. */
  festival: string | null;
  budgets: readonly number[];
  /** How many pieces can be sent at or under each budget. */
  counts: Record<number, number>;
  /** A few pieces to picture, cheapest first. */
  picks: Product[];
  who: WhoKey | null;
  max: number | null;
  forWho: string | null;
  cardFrom: number;
  /** The address of this page with these choices. */
  link: (next: { max?: number | null; for?: string | null; who?: WhoKey | null; jump?: boolean }) => string;
}

const priceOf = (p: Product) => p.salePrice ?? p.price;
const chip = (on: boolean, dark = false) =>
  `inline-flex h-12 shrink-0 items-center rounded-full border px-5 text-[15px] font-semibold transition-colors ${
    on ? (dark ? "border-paper bg-paper text-ink" : "border-ink bg-ink text-paper") : dark ? "border-paper/35 text-paper hover:border-paper" : "border-mist hover:border-ink"
  }`;

/** 1 · The blueprint's own order: who, then how much. Two questions, then the pieces. */
function WhoIsItFor({ festival, budgets, counts, who, max, cardFrom, link }: OpenerProps) {
  return (
    <section className="container-ep pb-12 pt-14 md:pb-16 md:pt-24">
      <p className="index text-steel-dark">{festival ? `${festival} gifts` : "Gifts"}</p>
      <h1 className="display display-h1 mt-3">Who is it for?</h1>
      <nav aria-label="Who is it for" className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {WHO.map((w) => (
          <Link key={w.key} href={link({ who: w.key })} scroll={false} aria-current={who === w.key ? "true" : undefined} className={chip(who === w.key)}>
            {w.label}
          </Link>
        ))}
      </nav>
      <h2 className={`display mt-12 text-[32px] leading-none md:text-[44px] ${who ? "" : "text-steel"}`}>How much?</h2>
      <nav aria-label="Budget" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {budgets.map((b) => (
          <Link key={b} href={link({ max: b, jump: true })} aria-current={max === b ? "true" : undefined} className={chip(max === b)}>
            Under {formatPrice(b)}
            <span className={`ml-2 font-mono text-[12px] ${max === b ? "text-paper/70" : "text-steel-dark"}`}>{counts[b]}</span>
          </Link>
        ))}
        <Link href={link({ max: null, jump: true })} className={chip(false)}>
          Any price
        </Link>
      </nav>
      <p className="mt-10 text-[15px] text-steel-dark">
        They pick the size.{" "}
        <Link href="/gift-cards#buy" className="font-semibold text-ink underline underline-offset-2">
          Or send a gift card, from {formatPrice(cardFrom)}
        </Link>
      </p>
    </section>
  );
}

/** 2 · A dark screen and one wrapped box: the gift itself is the picture. */
function TheBox({ festival, cardFrom, link }: OpenerProps) {
  return (
    <section className="on-dark bg-ink text-paper">
      <div className="container-ep grid items-center gap-10 py-14 md:grid-cols-2 md:py-24">
        <div>
          <p className="index text-paper/60">{festival ? `${festival} gifts` : "Gifts"}</p>
          <h1 className="display display-h1 mt-3">
            Wrapped.
            <br />
            Sent in a minute.
          </h1>
          <p className="mt-4 max-w-[38ch] text-lg text-paper/75">You choose the piece. They choose the size.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={link({ jump: true })} className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-paper px-7 text-[14px] font-semibold uppercase tracking-[0.08em] text-ink">
              Choose a piece <ArrowIcon className="h-4 w-4" />
            </Link>
            <Link href="/gift-cards#buy" className="inline-flex h-14 items-center justify-center rounded-full border border-paper/45 px-7 text-[14px] font-semibold uppercase tracking-[0.08em] hover:border-paper">
              Gift card from {formatPrice(cardFrom)}
            </Link>
          </div>
        </div>
        {/* The box: matte black, one lime ribbon, a tag. */}
        <div className="mx-auto w-full max-w-[380px]" aria-hidden>
          <svg viewBox="0 0 380 340" className="gift-box w-full">
            <ellipse cx="190" cy="318" rx="150" ry="12" fill="#000" opacity="0.6" />
            <rect x="50" y="120" width="280" height="190" rx="4" fill="#1b1c1f" stroke="#3a3b40" />
            <rect x="170" y="120" width="40" height="190" fill="#c6ff3d" />
            <g className="gift-lid">
              <rect x="36" y="78" width="308" height="52" rx="4" fill="#232428" stroke="#3a3b40" />
              <rect x="170" y="78" width="40" height="52" fill="#c6ff3d" />
              <path d="M190 78c-34-58-92-40-60-8 16 14 44 10 60 8zm0 0c34-58 92-40 60-8-16 14-44 10-60 8z" fill="#c6ff3d" stroke="#0a0a0a" strokeWidth="2" />
            </g>
            <g transform="rotate(8 286 196)">
              <rect x="252" y="168" width="68" height="44" rx="3" fill="#fff" />
              <circle cx="262" cy="178" r="3" fill="#0a0a0a" />
              <rect x="262" y="190" width="46" height="3" fill="#0a0a0a" />
              <rect x="262" y="198" width="30" height="3" fill="#8e8e93" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}

/** 3 · The whole thing as one receipt: what happens, in three lines, and where to start. */
function TheReceipt({ festival, cardFrom, link }: OpenerProps) {
  const lines = [
    ["01", "You choose a piece", "1 MIN"],
    ["02", "They pick the size", "THEIR CALL"],
    ["03", "It arrives, wrapped", "YOUR DATE"],
  ];
  return (
    <section className="bg-photo">
      <div className="container-ep grid items-center gap-10 py-14 md:grid-cols-[1fr_minmax(0,420px)] md:py-24">
        <div>
          <p className="index text-steel-dark">{festival ? `${festival} gifts` : "Gifts"}</p>
          <h1 className="display display-h1 mt-3">
            Buying for
            <br />
            someone?
          </h1>
          <p className="mt-4 max-w-[36ch] text-lg text-steel-dark">Three lines. No size to guess.</p>
        </div>
        <div className="bg-paper p-6 font-mono text-[13px] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)] md:p-8">
          <p className="text-center tracking-[0.2em]">EASYPICK · GIFT</p>
          <p className="my-4 border-t border-dashed border-ink/40" />
          <ol className="space-y-3">
            {lines.map(([n, t, r]) => (
              <li key={n} className="flex items-baseline justify-between gap-4">
                <span>
                  <span className="text-steel-dark">{n}</span>&nbsp;&nbsp;<span className="font-sans text-[15px] font-semibold">{t}</span>
                </span>
                <span className="shrink-0 text-steel-dark">{r}</span>
              </li>
            ))}
          </ol>
          <p className="my-4 border-t border-dashed border-ink/40" />
          <p className="flex justify-between">
            <span>SIZE SWAPS</span>
            <span>14 DAYS</span>
          </p>
          <div className="mt-6 grid gap-2 font-sans">
            <Link href={link({ jump: true })} className="btn btn-ink w-full">
              Choose a piece
            </Link>
            <Link href="/gift-cards#buy" className="btn btn-outline w-full">
              Gift card from {formatPrice(cardFrom)}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 4 · Start from the money: one tile per budget, each with a piece you could send for it. */
function BudgetFirst({ festival, budgets, counts, picks, max, cardFrom, link }: OpenerProps) {
  // A different piece on each tile: the dearest one that budget buys and no smaller budget already shows.
  const samples = budgets.reduce<(Product | undefined)[]>((shown, b) => [...shown, [...picks].reverse().find((p) => priceOf(p) <= b && !shown.includes(p))], []);
  return (
    <section className="container-ep pb-12 pt-14 md:pb-16 md:pt-24">
      <p className="index text-steel-dark">{festival ? `${festival} gifts` : "Gifts"}</p>
      <h1 className="display display-h1 mt-3">
        What&apos;s the
        <br />
        budget?
      </h1>
      <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-5">
        {budgets.map((b, i) => {
          const sample = samples[i];
          return (
            <li key={b}>
              <Link href={link({ max: b, jump: true })} aria-current={max === b ? "true" : undefined} className="group block">
                <span className="relative block overflow-hidden bg-photo">
                  {sample ? (
                    <ProductImage image={sample.images[0]} category={sample.category} colourHex={sample.colours[0].hex} decorative sizes="(min-width: 768px) 20vw, 50vw" />
                  ) : (
                    <span className="block aspect-[4/5]" />
                  )}
                </span>
                <span className="mt-3 block font-mono text-[12px] uppercase tracking-[0.14em] text-steel-dark">Under</span>
                <span className="display block text-[30px] leading-none group-hover:underline md:text-[36px]">{formatPrice(b)}</span>
                <span className="mt-1 block text-[13px] text-steel-dark">
                  {counts[b]} {counts[b] === 1 ? "piece" : "pieces"}
                </span>
              </Link>
            </li>
          );
        })}
        <li className="col-span-2 md:col-span-1">
          <Link href="/gift-cards#buy" className="on-dark group flex h-full min-h-[180px] flex-col justify-between overflow-hidden bg-ink p-5 text-paper">
            <span className="block w-[70%] max-w-[180px] rotate-[-6deg]" aria-hidden>
              <GiftCardArt design="lime" amount={null} />
            </span>
            <span>
              <span className="block font-mono text-[12px] uppercase tracking-[0.14em] text-paper/60">Any amount</span>
              <span className="display block text-[30px] leading-none group-hover:underline md:text-[32px]">Gift card</span>
              <span className="mt-1 block text-[13px] text-paper/70">From {formatPrice(cardFrom)}</span>
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

/** 5 · One sentence to finish: "A gift for … under …". The choices are the words. */
function OneSentence({ festival, budgets, picks, max, forWho, cardFrom, link }: OpenerProps) {
  const word = (on: boolean) => `border-b-[3px] pb-0.5 transition-colors ${on ? "border-ink text-ink" : "border-transparent text-steel hover:text-ink"}`;
  return (
    <section className="container-ep grid items-center gap-12 pb-12 pt-14 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:pb-16 md:pt-24">
      <div>
        <p className="index text-steel-dark">{festival ? `${festival} gifts` : "Gifts"}</p>
        <h1 className="sr-only">Find a gift</h1>
        <p className="display mt-4 text-[44px] leading-[1.02] md:text-[72px]">A gift for</p>
        <p className="display mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[44px] leading-[1.02] md:text-[72px]">
          {[
            [null, "anyone"],
            ["men", "him"],
            ["women", "her"],
          ].map(([key, label]) => (
            <Link key={label} href={link({ for: key })} scroll={false} className={word(forWho === key)}>
              {label}
            </Link>
          ))}
        </p>
        <p className="display mt-4 text-[44px] leading-[1.02] md:text-[72px]">under</p>
        <p className="display mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[36px] leading-[1.05] md:text-[56px]">
          {budgets.map((b) => (
            <Link key={b} href={link({ max: b })} scroll={false} className={word(max === b)}>
              {b.toLocaleString("en-IN")}
            </Link>
          ))}
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href={link({ jump: true })} className="btn btn-ink">
            Show the gifts
          </Link>
          <Link href="/gift-cards#buy" className="inline-flex min-h-11 items-center text-[15px] font-semibold underline underline-offset-4">
            Or a gift card, from {formatPrice(cardFrom)}
          </Link>
        </div>
      </div>
      {/* Three pieces, stacked like prints on a table. */}
      <div className="relative mx-auto hidden aspect-square w-full max-w-[460px] md:block" aria-hidden>
        {picks.slice(0, 3).map((p, i) => (
          <div key={p.id} className={`absolute w-[58%] bg-paper p-2 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.4)] ${["left-0 top-[6%] -rotate-6", "right-0 top-0 rotate-3", "bottom-0 left-[20%] rotate-[-1deg]"][i]}`}>
            <ProductImage image={p.images[0]} category={p.category} colourHex={p.colours[0].hex} decorative sizes="25vw" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function GiftOpener({ design, ...props }: OpenerProps & { design: DesignNo }) {
  const Opener = { 1: WhoIsItFor, 2: TheBox, 3: TheReceipt, 4: BudgetFirst, 5: OneSentence }[design];
  return <Opener {...props} />;
}

/** The owner's switch between the five, pinned to the bottom of the screen. Only on the design previews. */
export function DesignSwitch({ design }: { design: DesignNo }) {
  return (
    <nav aria-label="Design previews" className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-40 flex justify-center px-3 lg:bottom-5">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-ink p-1.5 text-paper shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <span className="shrink-0 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-paper/60 max-sm:hidden">Design</span>
        {DESIGNS.map((d) => (
          <Link key={d.n} href={`/gift?design=${d.n}`} title={d.name} aria-label={`Design ${d.n}: ${d.name}`} aria-current={d.n === design ? "page" : undefined} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-[14px] font-semibold ${d.n === design ? "bg-paper text-ink" : "hover:bg-paper/15"}`}>
            {d.n}
          </Link>
        ))}
        <Link href="/gift" className="shrink-0 rounded-full px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-paper/75 hover:text-paper">
          Current
        </Link>
      </div>
    </nav>
  );
}
