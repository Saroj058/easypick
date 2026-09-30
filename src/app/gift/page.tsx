import type { Metadata } from "next";
import Link from "next/link";

import { GiftCardArt } from "@/components/gift-card-art";
import { ArrowIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { bothDates, currentFestival } from "@/lib/festival";
import { formatPrice } from "@/lib/format";
import { GIFT_CARD_MIN } from "@/lib/gift-cards";
import { sellable } from "@/lib/inventory";
import { site } from "@/lib/site";
import { getProducts } from "@/lib/store";
import { getTrending } from "@/lib/trending";
import type { Product } from "@/lib/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Gifts",
  description: "Send an Easypick piece or gift card in a minute. They pick their own size, with wrapping and a personal message.",
  alternates: { canonical: "/gift" },
};

const RAIL = 8;
const PAGE = 24;
const BUDGETS = [1500, 2000, 3000, 5000] as const;
const FOR = [
  { key: "men", label: "For him" },
  { key: "women", label: "For her" },
] as const;

const priceOf = (p: Product) => p.salePrice ?? p.price;
const inStock = (p: Product) => p.variants.some((v) => sellable(v) > 0);
const oneSize = (p: Product) => p.variants.every((v) => v.size === "ONE");

/** A piece to send: picture, name, price. Opens the send-as-gift form. */
function GiftTile({ p, sizes, priority }: { p: Product; sizes: string; priority?: boolean }) {
  return (
    <Link href={`/gift/${p.slug}`} className="group block">
      <ProductImage image={p.images[0]} category={p.category} colourHex={p.colours[0].hex} decorative sizes={sizes} priority={priority} />
      <p className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold group-hover:underline">{p.name}</span>
        <span className="shrink-0 font-mono text-[14px]">{formatPrice(priceOf(p))}</span>
      </p>
      <p className="text-[13px] text-steel-dark">{oneSize(p) ? "One size · nothing to guess" : "They pick the size"}</p>
    </Link>
  );
}

/** A short curated row: swipe on phones, a grid of four on larger screens. */
function Rail({ id, title, note, products, more }: { id: string; title: string; note?: string; products: Product[]; more?: { href: string; label: string } }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={id} className="display display-h2">
            {title}
          </h2>
          {note && <p className="mt-2 text-steel-dark">{note}</p>}
        </div>
        {more && (
          <Link href={more.href} className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold underline-offset-4 hover:underline">
            {more.label} <ArrowIcon className="h-4 w-4" />
          </Link>
        )}
      </div>
      <ul className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
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
      aria-current={on ? "page" : undefined}
      className={`inline-flex h-11 shrink-0 items-center rounded-[2px] border px-4 text-sm font-semibold ${on ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
    >
      {children}
    </Link>
  );
}

export default async function GiftPage({ searchParams }: PageProps<"/gift">) {
  const sp = await searchParams;
  const max = BUDGETS.find((b) => String(b) === sp.max) ?? null;
  const forWho = FOR.find((f) => f.key === sp.for)?.key ?? null;
  const shown = Math.min(Math.max(Number(sp.show) || PAGE, PAGE), 600);

  const [all, festival, trending] = await Promise.all([getProducts(), currentFestival(), getTrending()]);
  const live = all.filter((p) => p.status === "live" && inStock(p));
  const cheapFirst = [...live].sort((a, b) => priceOf(a) - priceOf(b));

  const underTwo = cheapFirst.filter((p) => priceOf(p) <= 2000);
  const noSize = live.filter(oneSize);
  const liveSlugs = new Set(live.map((p) => p.slug));
  const popular = trending.items.map((i) => i.product).filter((p) => liveSlugs.has(p.slug));
  const popularTitle = trending.mode === "trending" ? "What people are buying." : trending.label === "Staff picks" ? "Staff picks." : "From the latest drop.";
  const fresh = live.filter((p) => p.isNew);

  const every = cheapFirst.filter((p) => (max ? priceOf(p) <= max : true) && (forWho ? p.gender === forWho || p.gender === "unisex" : true));
  const q = (next: { max?: number | null; for?: string | null; show?: number }) => {
    const u = new URLSearchParams();
    const m = next.max === undefined ? max : next.max;
    const f = next.for === undefined ? forWho : next.for;
    if (m) u.set("max", String(m));
    if (f) u.set("for", f);
    if (next.show) u.set("show", String(next.show));
    const s = u.toString();
    return `/gift${s ? `?${s}` : ""}#pieces`;
  };

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="container-ep pb-10 pt-14 md:pb-14 md:pt-24">
        <p className="index text-steel-dark">{festival ? `${festival.name} gifts` : "Gifts"}</p>
        <h1 className="display display-h1 mt-3">
          Gift it.
          <br />
          They pick the size.
        </h1>
        <p lang="ne" className="mt-4 text-lg text-steel-dark">
          उपहार पठाउनुहोस्, साइज उहाँ आफैं छान्नुहुन्छ।
        </p>
        <p className="mt-2 max-w-[46ch] text-lg md:text-xl">A piece or a gift card, sent in a minute. Pay with eSewa.</p>

        {festival && (
          <div className="mt-8 max-w-2xl bg-volt px-5 py-4 text-ink">
            {festival.open ? (
              <p className="text-[15px]">
                <span className="font-semibold">Order by {bothDates(festival.orderBy)}</span> for delivery before {festival.name} ({bothDates(festival.date)}).
              </p>
            ) : (
              <p className="text-[15px]">
                <span className="font-semibold">Too late for delivery before {festival.name}?</span> A gift card arrives in minutes, and store pickup still works.{" "}
                <Link href="/gift-cards#buy" className="font-semibold underline underline-offset-2">
                  Send a gift card
                </Link>
              </p>
            )}
          </div>
        )}
      </section>

      <div className="container-ep space-y-20">
        {/* Piece or card? */}
        <section aria-labelledby="choose-h">
          <h2 id="choose-h" className="sr-only">
            Piece or gift card?
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <a href="#pieces" className="group flex min-h-[200px] flex-col justify-between bg-photo p-6 md:p-8">
              <span>
                <span className="display block text-[32px] leading-none md:text-[40px]">Send a piece</span>
                <span className="mt-3 block max-w-[40ch] text-steel-dark">You know their style. They choose the size, or swap it within 14 days.</span>
              </span>
              <span className="mt-6 inline-flex items-center gap-2 font-semibold">
                Choose a piece <ArrowIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </a>
            <Link href="/gift-cards#buy" className="on-dark group relative flex min-h-[200px] flex-col justify-between overflow-hidden bg-ink p-6 text-paper md:p-8">
              <span className="relative z-10">
                <span className="display block text-[32px] leading-none md:text-[40px]">Send a gift card</span>
                <span className="mt-3 block max-w-[30ch] text-paper/80">
                  Not sure what they&apos;d like? From {formatPrice(GIFT_CARD_MIN)}. Arrives by email and SMS in minutes.
                </span>
              </span>
              <span className="relative z-10 mt-6 inline-flex items-center gap-2 font-semibold">
                Choose an amount <ArrowIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
              <span className="pointer-events-none absolute -bottom-6 -right-8 w-[46%] max-w-[240px] rotate-[-8deg] opacity-95 transition-transform duration-300 group-hover:rotate-[-4deg]" aria-hidden>
                <GiftCardArt design="lime" amount={null} />
              </span>
            </Link>
          </div>
          <p className="mt-4 text-[15px] text-steel-dark">
            <span className="font-semibold text-ink">Know what they like?</span> Send a piece. <span className="font-semibold text-ink">Last minute or not sure?</span> Send a card.
          </p>
        </section>

        <Rail id="under-h" title="Under Rs 2,000." note="Small price, still a proper gift." products={underTwo} more={{ href: q({ max: 2000, for: null }), label: "See all" }} />
        <Rail id="nosize-h" title="No size to guess." note="One size. Nothing to swap." products={noSize} />
        <Rail id="popular-h" title={popularTitle} note={trending.mode === "picks" ? trending.why : undefined} products={popular} />
        <Rail id="fresh-h" title="Just in." note="From the latest drops." products={fresh} more={{ href: "/new", label: "All new" }} />

        {/* Every piece, with budget and who-for filters (plain links, no script needed) */}
        <section id="pieces" aria-labelledby="pieces-h" className="scroll-mt-20">
          <h2 id="pieces-h" className="display display-h2">
            Every piece.
          </h2>
          <nav aria-label="Filter gifts" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip href={q({ max: null })} on={!max}>
              Any price
            </Chip>
            {BUDGETS.map((b) => (
              <Chip key={b} href={q({ max: b })} on={max === b}>
                Under {formatPrice(b)}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 bg-mist" aria-hidden />
            <Chip href={q({ for: null })} on={!forWho}>
              For anyone
            </Chip>
            {FOR.map((f) => (
              <Chip key={f.key} href={q({ for: f.key })} on={forWho === f.key}>
                {f.label}
              </Chip>
            ))}
          </nav>
          <p className="mt-4 text-[14px] text-steel-dark" aria-live="polite">
            {every.length} {every.length === 1 ? "piece" : "pieces"}, cheapest first
          </p>
          {every.length > 0 ? (
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {every.slice(0, shown).map((p) => (
                <li key={p.id}>
                  <GiftTile p={p} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6">
              Nothing in stock for this filter. <Link href={q({ max: null, for: null })} className="underline underline-offset-2">Show every piece</Link>, or{" "}
              <Link href="/gift-cards#buy" className="underline underline-offset-2">send a gift card</Link>.
            </p>
          )}
          {every.length > shown && (
            <div className="mt-10 text-center">
              <Link href={q({ show: shown + PAGE })} scroll={false} className="btn btn-outline">
                Show more
              </Link>
            </div>
          )}
        </section>

        {/* How it works */}
        <section aria-labelledby="how-h" className="border-t border-mist pt-16">
          <h2 id="how-h" className="display display-h2">
            How it works.
          </h2>
          <ol className="mt-8 grid gap-10 md:grid-cols-3">
            {[
              ["01", "You choose.", "Pick a piece, add a message and the wrap. Pay with eSewa.", "तपाईं छान्नुहोस्।"],
              [
                "02",
                "They pick the size.",
                "We email them a private link. They choose online, or try it on in our store. You decide whether they see the price.",
                "साइज उहाँ आफैं छान्नुहुन्छ।",
              ],
              ["03", "It arrives, wrapped.", "With your card, on the day you choose. Wrong size? They swap it within 14 days.", "र्‍यापिङसहित घरमै।"],
            ].map(([n, t, d, ne]) => (
              <li key={n}>
                <p className="font-mono text-[13px] text-steel-dark">{n}</p>
                <p className="display mt-2 text-[28px] leading-none">{t}</p>
                <p className="mt-3 text-steel-dark">{d}</p>
                <p lang="ne" className="mt-1 text-[14px] text-steel-dark">
                  {ne}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Reassurance */}
        <section aria-labelledby="sure-h" className="bg-photo p-6 md:p-10">
          <h2 id="sure-h" className="text-xl font-semibold">
            Every gift comes with
          </h2>
          <ul className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Size swaps for 14 days", "If it doesn't fit, they swap it in store or by delivery."],
              ["Delivery on the day you pick", "Birthday, Tika, anniversary. Up to 60 days ahead."],
              ["The price, or not", "Shown by default. Tick one box to hide it."],
              ["Send it anonymously", "Or sign it. Your call."],
              [`${formatPrice(site.gifting.welcomeCredit)} off for them`, "Off their own first order, when they pick their size."],
              [`Premium box, ${formatPrice(site.gifting.premiumWrapFee)}`, "Or our bag with tissue and a printed card, free."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 bg-volt ring-1 ring-ink" aria-hidden />
                <span>
                  <span className="block font-semibold">{t}</span>
                  <span className="block text-[15px] text-steel-dark">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-h" className="max-w-3xl">
          <h2 id="faq-h" className="display display-h2">
            Questions.
          </h2>
          <div className="mt-6 divide-y divide-mist border-y border-mist">
            {[
              ["What if it doesn't fit?", "They swap the size within 14 days, in store or by delivery. If their size sells out, they can turn the gift into a gift card for the full amount."],
              ["When do they choose the size?", "As soon as they open the link. We hold one piece for them in the meantime, so it can't sell out under them."],
              ["Can I choose the size myself?", "Yes. Pick “I know their size” and add a date. We send them the link that morning, so the surprise holds."],
              ["How do I pay?", "With eSewa online. The whole thing takes about a minute."],
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
          <p className="mt-6 text-[15px] text-steel-dark">
            Got a gift card?{" "}
            <Link href="/gift-cards#balance" className="font-semibold text-ink underline underline-offset-2">
              Check its balance
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
