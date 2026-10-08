import type { Metadata } from "next";
import Link from "next/link";

import { GiftBox } from "@/components/gift/gift-box";
import { ArrowIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/lib/format";
import { GIFT_CARD_MIN } from "@/lib/gift-cards";
import { sellable } from "@/lib/inventory";
import { categoryLabels, site } from "@/lib/site";
import { getProducts } from "@/lib/store";
import { getTrending } from "@/lib/trending";
import type { Product } from "@/lib/types";

// Find a gift ("I am buying for someone"). The page starts from the one question the catalogue can
// answer honestly, the budget, and goes straight to pieces. Every control is a plain link, so the
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

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={`inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-[background-color,border-color,scale] duration-150 active:scale-[0.97] ${on ? "border-ink bg-ink text-paper" : "border-steel hover:border-ink"}`}
    >
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
  const tile = "group flex min-h-[88px] flex-col justify-between rounded-[2px] border border-paper/30 p-4 transition-colors duration-200 hover:border-paper hover:bg-paper hover:text-ink";

  return (
    <div className="pb-24">
      {/* The opening: the gift, and the one question that finds it. */}
      <section className="on-dark bg-ink text-paper">
        <div className="container-ep grid items-center gap-10 pb-10 pt-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:pb-16 md:pt-20">
          <div>
            <p className="index text-paper/60">Gifts</p>
            <h1 className="display display-h1 mt-3">
              Gift it.
              <br />
              They pick the size.
            </h1>
            <h2 id="budget-h" className="mt-8 font-mono text-[12px] uppercase tracking-[0.16em] text-paper/60">
              What&apos;s the budget?
            </h2>
            <nav aria-labelledby="budget-h" className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {BUDGETS.map((b) => (
                <Link key={b} href={q({ max: b, cat: null })} className={tile}>
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-60">Under</span>
                  <span>
                    <span className="display block text-[28px] leading-none">{formatPrice(b)}</span>
                    <span className="mt-1 block text-[13px] opacity-70">
                      {live.filter((p) => priceOf(p) <= b).length} pieces
                    </span>
                  </span>
                </Link>
              ))}
              <Link href={q({ max: null, cat: null })} className={tile}>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] opacity-60">Any</span>
                <span>
                  <span className="display block text-[28px] leading-none">Price</span>
                  <span className="mt-1 block text-[13px] opacity-70">{live.length} pieces</span>
                </span>
              </Link>
            </nav>
            <p className="mt-5">
              <Link href="/gift-cards#buy" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold underline underline-offset-4">
                Not sure? Send a gift card, from {formatPrice(GIFT_CARD_MIN)} <ArrowIcon className="h-4 w-4" />
              </Link>
            </p>
          </div>
          <GiftBox tag={["FOR THEM", "SIZE: THEIR PICK"]} state="idle" className="mx-auto w-full max-w-[360px] max-md:hidden" />
        </div>
      </section>

      <div className="container-ep space-y-14 pt-12 md:space-y-20 md:pt-16">
        {/* The pieces, with budget and kind as plain links */}
        <section id="pieces" aria-labelledby="pieces-h" className="scroll-mt-20">
          <h2 id="pieces-h" className="display display-h2">
            {max ? `Under ${formatPrice(max)}.` : "Every piece."}
          </h2>
          <nav aria-label="Budget" className="-mx-4 mt-6 flex scroll-px-4 gap-2 overflow-x-auto px-4 pb-1">
            <Chip href={q({ max: null })} on={!max}>
              Any price
            </Chip>
            {BUDGETS.map((b) => (
              <Chip key={b} href={q({ max: b })} on={max === b}>
                Under {formatPrice(b)}
              </Chip>
            ))}
          </nav>
          <nav aria-label="Kind of piece" className="-mx-4 mt-2 flex scroll-px-4 gap-2 overflow-x-auto px-4 pb-1">
            <Chip href={q({ cat: null })} on={!cat}>
              Anything
            </Chip>
            {cats.map((c) => (
              <Chip key={c} href={q({ cat: c })} on={cat === c}>
                {c === "one" ? "One size" : categoryLabels[c]}
              </Chip>
            ))}
          </nav>
          <p className="mt-4 text-[14px] text-steel-dark">
            {every.length} {every.length === 1 ? "piece" : "pieces"}
            {max ? ", best first" : ", cheapest first"}
          </p>
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
              <Link href="/gift-cards#buy" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
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
              <Link href="/gift-cards#buy" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
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
          <p className="mt-4 text-[15px] text-steel-dark">
            Got a gift card?{" "}
            <Link href="/gift-cards#balance" className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-2">
              Check its balance
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
