import type { Metadata } from "next";
import Image from "next/image";

import { BalanceCheck } from "@/components/balance-check";
import { AskWhatsApp } from "@/components/ask-whatsapp";
import { GiftBox } from "@/components/gift/gift-box";
import { GiftCardPicker } from "@/components/gift/gift-card-picker";
import { GiftHow } from "@/components/gift/gift-how";
import { GiftPieces } from "@/components/gift/gift-pieces";
import { toRailPiece } from "@/components/home/rail";
import { GiftCardPicture } from "@/components/gift-card-art";
import { ArrowIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import { sellable } from "@/lib/inventory";
import { site } from "@/lib/site";
import { getProducts } from "@/lib/store";
import type { Product } from "@/lib/types";

// Find a gift ("I am buying for someone"). The page opens on the two things to do (send a piece,
// send a gift card), then goes straight to the pieces: one strip of cards, as on the drops page,
// narrowed in the page by budget, kind and search (components/gift/gift-pieces.tsx). Pieces are not tagged by who they suit or by occasion, so the page
// doesn't ask.

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Gifts",
  description: "Send an Easypick piece or gift card in a minute. They pick their own size, with wrapping and a personal message.",
  alternates: { canonical: "/gift" },
};

const priceOf = (p: Product) => p.salePrice ?? p.price;
const inStock = (p: Product) => p.variants.some((v) => sellable(v) > 0);

export default async function GiftPage() {
  const live = (await getProducts()).filter((p) => p.status === "live" && inStock(p));

  return (
    <div className="overflow-x-clip pb-24">
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
        {/* First time? The four steps, on asking */}
        <GiftHow />

        <section id="pieces" aria-labelledby="pieces-h" className="scroll-mt-20">
          <GiftPieces pieces={live.sort((a, b) => priceOf(a) - priceOf(b)).map(toRailPiece)} />
        </section>

        {/* Gift cards: this section is where they are chosen and bought (the form opens over the page) */}
        <section id="buy" aria-labelledby="cards-h" className="scroll-mt-24 rounded-2xl border border-ink p-4 md:p-8">
          <GiftCardPicker />
        </section>

        {/* Questions: the title and the way to ask on the left; the answers, one card each, on the right */}
        <section aria-labelledby="faq-h" className="grid gap-8 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-12">
          <div className="md:sticky md:top-28 md:self-start">
            <h2 id="faq-h" className="display display-h2">
              Questions.
            </h2>
            <p className="mt-3 max-w-[30ch] text-steel-dark">The ones people ask before they send. Anything else, we answer on WhatsApp.</p>
            <AskWhatsApp text="Hi Easypick, I need help sending a gift." label="Ask us on WhatsApp" className="mt-4" />
          </div>
          <div className="space-y-3">
            {[
              ["What if it doesn't fit?", "They swap the size within 14 days, in store or by delivery. If their size sells out, they can turn the gift into a gift card for the full amount."],
              ["When do they choose the size?", "As soon as they open the link. We hold one piece for them in the meantime, so it can't sell out under them."],
              ["Can I choose the size myself?", "Yes. Pick “I know their size” and add a date. We send them the link that morning, so the surprise holds."],
              ["Do they see the price?", "Yes, unless you tick “Hide the price”. You can also send it without your name."],
              ["How is it wrapped?", `In our bag with tissue and a printed note, free. Or a premium black box for ${formatPrice(site.gifting.premiumWrapFee)}.`],
              ["Do they need an account?", "No. The link opens on any phone or laptop. No app, no sign-up."],
            ].map(([qq, a], i) => (
              <details key={qq} className="group rounded-xl border border-ink/15 bg-paper px-4 transition-[border-color,background-color] duration-200 open:border-ink open:bg-mist/40 hover:border-ink md:px-5">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 py-3 font-semibold">
                  <span className="font-mono text-[12px] font-normal tabular-nums text-steel-dark">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">{qq}</span>
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/20 text-lg leading-none transition-transform duration-300 group-open:rotate-45 group-open:border-ink group-open:bg-ink group-open:text-paper">
                    +
                  </span>
                </summary>
                <p className="pb-4 pl-9 text-[15px] leading-relaxed text-steel-dark">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
