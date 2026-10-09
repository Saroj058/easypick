import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BalanceCheck } from "@/components/balance-check";
import { AskWhatsApp } from "@/components/ask-whatsapp";
import { GiftBox } from "@/components/gift/gift-box";
import { GiftCardPicker } from "@/components/gift/gift-card-picker";
import { GiftCardPicture } from "@/components/gift-card-art";
import { ArrowIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/lib/format";
import { sellable } from "@/lib/inventory";
import { categoryLabels, site } from "@/lib/site";
import { getProducts } from "@/lib/store";
import { getTrending } from "@/lib/trending";
import type { Product } from "@/lib/types";

// Find a gift ("I am buying for someone"). The page opens on the two things to do (send a piece,
// send a gift card), names the three ways to gift, then goes straight to pieces, filtered by budget. Every control is a plain link, so the
// page works without JavaScript. Pieces are not tagged by who they suit or by occasion, so the page
// doesn't ask.

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Gifts",
  description: "Send an Easypick piece or gift card in a minute. They pick their own size, with wrapping and a personal message.",
  alternates: { canonical: "/gift" },
};

const RAIL = 8;
const PAGE = 24;
/** The blueprint's budgets (section 08). */
const BUDGETS = [2000, 3500, 5000] as const;
type Cat = keyof typeof categoryLabels | "one";

const priceOf = (p: Product) => p.salePrice ?? p.price;
const inStock = (p: Product) => p.variants.some((v) => sellable(v) > 0);
const oneSize = (p: Product) => p.variants.every((v) => v.size === "ONE");

/** A piece to send: picture, name, price. Opens the send-as-gift form. */
function GiftTile({ p, sizes, priority }: { p: Product; sizes: string; priority?: boolean }) {
  return (
    <Link href={`/gift/${p.slug}`} className="group block transition-opacity duration-150 active:opacity-80">
      <ProductImage image={p.images[0]} category={p.category} colourHex={p.colours[0].hex} decorative sizes={sizes} priority={priority} />
      <p className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold group-hover:underline">{p.name}</span>
        <span className="shrink-0 font-mono text-[14px]">{formatPrice(priceOf(p))}</span>
      </p>
      {oneSize(p) && <p className="text-[13px] text-steel-dark">One size</p>}
    </Link>
  );
}

/** A short curated row: swipe on phones, a grid of four on larger screens. */
function Rail({ id, title, note, products }: { id: string; title: string; note?: string; products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="display display-h2">
        {title}
      </h2>
      {note && <p className="mt-2 text-steel-dark">{note}</p>}
      <ul className="-mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {products.slice(0, RAIL).map((p) => (
          <li key={p.id} className="w-[44%] shrink-0 snap-start md:w-auto">
            <GiftTile p={p} sizes="(min-width: 768px) 25vw, 44vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One choice in the finder. Budgets are segments of one control; kinds are quiet words with a line under the chosen one. */
function Chip({ href, on, tab = false, children }: { href: string; on: boolean; tab?: boolean; children: React.ReactNode }) {
  const look = tab
    ? `px-1 font-medium after:absolute after:inset-x-1 after:bottom-1.5 after:h-[2px] after:origin-left after:bg-ink after:transition-transform after:duration-200 ${on ? "text-ink after:scale-x-100" : "text-steel-dark after:scale-x-0 hover:text-ink"}`
    : `flex-1 justify-center rounded-full px-2 font-semibold sm:flex-none sm:px-4 ${on ? "bg-ink text-paper shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)]" : "text-ink/70 hover:text-ink"}`;
  return (
    <Link href={href} scroll={false} aria-current={on ? "true" : undefined} className={`relative inline-flex h-11 shrink-0 items-center whitespace-nowrap text-sm transition-[background-color,color,scale] duration-150 active:scale-[0.97] ${look}`}>
      {children}
    </Link>
  );
}

export default async function GiftPage({ searchParams }: PageProps<"/gift">) {
  const sp = await searchParams;
  const max = BUDGETS.find((b) => String(b) === sp.max) ?? null;
  const cat = ([...Object.keys(categoryLabels), "one"] as Cat[]).find((c) => c === sp.cat) ?? null;
  const shown = Math.min(Math.max(Number(sp.show) || PAGE, PAGE), 600);

  const [all, trending] = await Promise.all([getProducts(), getTrending()]);
  const live = all.filter((p) => p.status === "live" && inStock(p));
  const inBudget = (p: Product, m: number | null) => (m ? priceOf(p) <= m : true);
  const inCat = (p: Product, c: Cat | null) => (c === "one" ? oneSize(p) : c ? p.category === c : true);

  // With a budget, the best that money buys comes first; without one, the small everyday gifts do.
  const every = live.filter((p) => inBudget(p, max) && inCat(p, cat)).sort((a, b) => (max ? priceOf(b) - priceOf(a) : priceOf(a) - priceOf(b)));
  const noSize = live.filter(oneSize);
  const liveSlugs = new Set(live.map((p) => p.slug));
  const popular = trending.items.map((i) => i.product).filter((p) => liveSlugs.has(p.slug));
  const popularTitle = trending.mode === "trending" ? "What people are buying." : trending.label === "Staff picks" ? "Staff picks." : "From the latest drop.";
  const cats = ([...Object.keys(categoryLabels), "one"] as Cat[]).filter((c) => live.some((p) => inBudget(p, max) && inCat(p, c)));

  const q = (next: { max?: number | null; cat?: Cat | null; show?: number }) => {
    const u = new URLSearchParams();
    const m = next.max === undefined ? max : next.max;
    const c = next.cat === undefined ? cat : next.cat;
    if (m) u.set("max", String(m));
    if (c) u.set("cat", c);
    if (next.show) u.set("show", String(next.show));
    const s = u.toString();
    return `/gift${s ? `?${s}` : ""}#pieces`;
  };
  const filtered = Boolean(max || cat);

  return (
    <div className="pb-24">
      {/* The opening: the owner's picture (a white room, the box, two cards) fills the screen; the words sit on its open left side. */}
      <section className="relative overflow-hidden bg-[#f1f2f5] text-ink">
        {/* Phones: the box and cards at the top, the words over the picture's pale foot. */}
        <Image src="/gift/hero-white-phone.webp" alt="" width={900} height={804} priority sizes="100vw" className="absolute inset-x-0 top-0 h-auto w-full md:hidden" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent from-[36%] to-[#f1f2f5] to-[48%] md:hidden" aria-hidden />
        <Image src="/gift/hero-white.webp" alt="" fill priority sizes="100vw" className="object-cover object-right max-md:hidden" />
        <div className="container-ep relative flex min-h-[calc(100svh-72px-56px-env(safe-area-inset-bottom))] items-end pb-6 pt-[66vw] md:min-h-[calc(100svh-88px)] md:items-center md:py-20">
          <div className="md:max-w-[50%]">
            <p className="index text-ink/60">Gifting, simplified</p>
            <h1 className="display display-h1 mt-3">
              You know them.
              <br />
              We handle the rest.
            </h1>
            <p className="mt-3 max-w-[40ch] text-base text-ink/75 md:mt-4 md:text-lg">Whether you know their style, their size, or neither, send them something they&apos;ll love.</p>
            {/* The two things to do, each with its own object: the box opens, the cards fan out. */}
            <nav aria-label="Start a gift" className="mt-6 grid gap-3 sm:grid-cols-2 md:mt-8 md:max-w-[440px] md:grid-cols-1">
              <a href="#pieces" className="gift-tile on-dark group relative flex h-[88px] items-center overflow-hidden rounded-2xl bg-ink pl-5 text-paper shadow-[0_14px_30px_-18px_rgba(0,0,0,0.6)] transition-transform duration-150 active:scale-[0.99] md:h-[104px]">
                <span className="relative z-10">
                  <span className="display block text-[26px] leading-none">Send a piece</span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-paper/70">
                    Wrapped in the box <ArrowIcon className="h-3.5 w-3.5 rotate-90 transition-transform duration-200 group-hover:translate-y-0.5" />
                  </span>
                </span>
                <GiftBox className="absolute -right-2 bottom-[-18px] w-[118px]" />
              </a>
              <a href="#buy" className="group relative flex h-[88px] items-center overflow-hidden rounded-2xl border border-ink/15 bg-paper/85 pl-5 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-transform duration-150 active:scale-[0.99] md:h-[104px]">
                <span className="relative z-10">
                  <span className="display block text-[26px] leading-none">Send a gift card</span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-steel-dark">
                    They choose anything <ArrowIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </span>
                {/* Three of the cards, held like a hand: they spread when the tile is pointed at */}
                <span className="absolute -right-3 top-1/2 block h-[84px] w-[120px] -translate-y-1/2" aria-hidden>
                  <span className="absolute inset-x-0 top-2 block origin-bottom-left rotate-[-14deg] transition-transform duration-300 group-hover:rotate-[-24deg]">
                    <GiftCardPicture amount={20000} className="shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)]" />
                  </span>
                  <span className="absolute inset-x-0 top-2 block origin-bottom-left rotate-[-4deg] transition-transform duration-300 group-hover:rotate-[-8deg]">
                    <GiftCardPicture amount={5000} className="shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)]" />
                  </span>
                  <span className="absolute inset-x-0 top-2 block origin-bottom-left rotate-[6deg] transition-transform duration-300 group-hover:rotate-[10deg]">
                    <GiftCardPicture amount={2000} className="shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)]" />
                  </span>
                </span>
              </a>
            </nav>
          </div>
        </div>
      </section>

      <div className="container-ep space-y-14 pt-10 md:space-y-20 md:pt-14">
        {/* Already holding a gift card: one thin rectangle. The code goes in the rounded field in the middle; Check stands apart at the end. */}
        <section id="balance" aria-labelledby="balance-h" className="scroll-mt-24 flex flex-col gap-3 rounded-2xl border border-ink px-4 py-3 md:flex-row md:items-center md:gap-6 md:py-2.5 md:pl-3 md:pr-3">
          <div className="flex shrink-0 items-center gap-3">
            <span className="block w-14 shrink-0 -rotate-3" aria-hidden>
              <GiftCardPicture amount={null} side="back" className="shadow-[0_6px_14px_-8px_rgba(0,0,0,0.5)]" />
            </span>
            <h2 id="balance-h" className="display text-[22px] leading-none">
              Got a gift card?
            </h2>
            <p className="text-[14px] text-steel-dark max-xl:hidden">See what&apos;s left on it.</p>
          </div>
          <div className="min-w-0 flex-1">
            <BalanceCheck />
          </div>
        </section>

        {/* The pieces, with budget and kind as plain links */}
        <section id="pieces" aria-labelledby="pieces-h" className="scroll-mt-20">
          <div className="flex items-end justify-between gap-4">
            <h2 id="pieces-h" className="display display-h2">
              {max ? `Under ${formatPrice(max)}.` : "Every piece."}
            </h2>
            <p className="index shrink-0 pb-1 text-right text-steel-dark">
              {every.length} {every.length === 1 ? "piece" : "pieces"}
              <span className="max-sm:hidden">{max ? " · best first" : " · cheapest first"}</span>
            </p>
          </div>
          {/* The finder: one thin outlined card. Budget is a single control; kind is a row of words. */}
          <div className="mt-5 rounded-2xl border border-ink">
            <div className="flex items-center gap-3 px-3 py-2 md:px-4">
              <span className="index w-14 shrink-0 text-steel-dark max-sm:hidden">Budget</span>
              <nav aria-label="Budget" className="flex min-w-0 gap-1 rounded-full bg-mist p-1 max-sm:flex-1">
                <Chip href={q({ max: null })} on={!max}>
                  Any<span className="max-sm:sr-only">&nbsp;price</span>
                </Chip>
                {BUDGETS.map((b) => (
                  <Chip key={b} href={q({ max: b })} on={max === b}>
                    <span className="max-sm:sr-only">Under&nbsp;</span>
                    {formatPrice(b)}
                  </Chip>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3 border-t border-ink/15 px-3 md:px-4">
              <span className="index w-14 shrink-0 text-steel-dark max-sm:hidden">Kind</span>
              <nav aria-label="Kind of piece" className="flex min-w-0 flex-1 gap-4 overflow-x-auto md:gap-6">
                <Chip tab href={q({ cat: null })} on={!cat}>
                  Anything
                </Chip>
                {cats.map((c) => (
                  <Chip tab key={c} href={q({ cat: c })} on={cat === c}>
                    {c === "one" ? "One size" : categoryLabels[c]}
                  </Chip>
                ))}
              </nav>
              {filtered && (
                <Link href={q({ max: null, cat: null })} scroll={false} className="inline-flex h-11 shrink-0 items-center text-[13px] font-semibold underline underline-offset-4">
                  Clear
                </Link>
              )}
            </div>
          </div>
          {every.length > 0 ? (
            <ul key={`${max}-${cat}`} className="mt-6 grid animate-fade-up grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {every.slice(0, shown).map((p, i) => (
                <li key={p.id}>
                  <GiftTile p={p} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" priority={i < 2} />
                </li>
              ))}
            </ul>
          ) : live.length === 0 ? (
            <p className="mt-6">
              Nothing to send right now.{" "}
              <Link href="#buy" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
                A gift card works today
              </Link>
            </p>
          ) : (
            <p className="mt-6">
              Nothing here right now.{" "}
              <Link href={q({ max: null, cat: null })} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
                Show every piece
              </Link>{" "}
              or{" "}
              <Link href="#buy" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
                send a gift card
              </Link>
            </p>
          )}
          {every.length > shown && (
            <div className="mt-10 text-center">
              <Link href={q({ show: shown + PAGE })} scroll={false} className="btn btn-outline">
                Show more ({every.length - shown} left)
              </Link>
            </div>
          )}
        </section>

        {/* Gift cards: this section is where they are chosen and bought (the form opens over the page) */}
        <section id="buy" aria-labelledby="cards-h" className="scroll-mt-24 rounded-2xl border border-ink p-4 md:p-8">
          <GiftCardPicker />
        </section>

        {/* Two short rows, only while nothing is filtered */}
        {!filtered && <Rail id="nosize-h" title="No size to guess." note="One size. Nothing to swap." products={noSize} />}
        {!filtered && <Rail id="popular-h" title={popularTitle} note={trending.mode === "picks" ? trending.why : undefined} products={popular} />}

        {/* How it works, as three receipt lines */}
        <section aria-labelledby="how-h" className="border-t border-mist pt-14">
          <h2 id="how-h" className="display display-h2">
            How it works.
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              ["01", "You choose.", "A piece, a note, the wrap. Pay with eSewa."],
              ["02", "They pick the size.", `We email them a private link. They choose online or try it on in our store, and get ${formatPrice(site.gifting.welcomeCredit)} off their own first order.`],
              ["03", "It arrives, wrapped.", "With your note. Wrong size? They swap it within 14 days."],
            ].map(([n, t, d]) => (
              <li key={n}>
                <p className="font-mono text-[13px] text-steel-dark">{n}</p>
                <p className="display mt-2 text-[28px] leading-none">{t}</p>
                <p className="mt-3 text-steel-dark">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Questions */}
        <section aria-labelledby="faq-h" className="max-w-3xl">
          <h2 id="faq-h" className="display display-h2">
            Questions.
          </h2>
          <div className="mt-6 divide-y divide-mist border-y border-mist">
            {[
              ["What if it doesn't fit?", "They swap the size within 14 days, in store or by delivery. If their size sells out, they can turn the gift into a gift card for the full amount."],
              ["When do they choose the size?", "As soon as they open the link. We hold one piece for them in the meantime, so it can't sell out under them."],
              ["Can I choose the size myself?", "Yes. Pick “I know their size” and add a date. We send them the link that morning, so the surprise holds."],
              ["Do they see the price?", "Yes, unless you tick “Hide the price”. You can also send it without your name."],
              ["How is it wrapped?", `In our bag with tissue and a printed note, free. Or a premium black box for ${formatPrice(site.gifting.premiumWrapFee)}.`],
              ["Do they need an account?", "No. The link opens on any phone or laptop. No app, no sign-up."],
            ].map(([qq, a]) => (
              <details key={qq} className="group py-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {qq}
                  <span className="text-xl leading-none transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-steel-dark">{a}</p>
              </details>
            ))}
          </div>
          <div className="mt-4" />
          <AskWhatsApp text="Hi Easypick, I need help sending a gift." label="Stuck? Ask us on WhatsApp" />
        </section>
      </div>
    </div>
  );
}
