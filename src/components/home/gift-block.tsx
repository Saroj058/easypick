import Link from "next/link";

import { GiftBox } from "@/components/gift/gift-box";
import { GiftCardPicture } from "@/components/gift-card-art";
import { ArrowIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import { GIFT_CARD_MAX, GIFT_CARD_MIN } from "@/lib/gift-cards";

/**
 * Buying for someone (owner, 18 Oct 2026: "better design", above Our store): two panels side by
 * side. A dark one for sending a piece, with the box whose lid lifts when pointed at and the three
 * steps; a light one for gift cards, the cards fanning out. The Gift page does the explaining.
 */
export function GiftBlock() {
  const door = "inline-flex h-12 items-center gap-2 rounded-full px-6 text-[13px] font-semibold uppercase tracking-[0.08em] transition-[background-color,color,scale] duration-200 active:scale-[0.97]";
  const steps = ["Pick a piece and add a message", "We wrap it, box or bag", "They pick their own size"];
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">Gifts</p>
          <h2 id="gift-title" className="display mt-2 text-[clamp(2.6rem,1.8rem+3vw,4.6rem)] leading-[0.86]">
            Buying for someone?
          </h2>
        </div>
        <p className="max-w-[34ch] text-[16px] leading-snug text-steel-dark">You know them. We handle the size, the wrap and the delivery.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Send a piece */}
        <div className="gift-tile on-dark group relative overflow-hidden rounded-[26px] bg-ink p-6 text-paper md:p-9">
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_100%,rgba(255,255,255,0.12),transparent_70%)]" />
          <div className="relative grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper/60">Send a gift</p>
              <p className="display mt-2 text-[clamp(1.9rem,1.4rem+1.6vw,2.8rem)] leading-[0.92]">
                You pick the piece.
                <br />
                <span className="text-paper/60">They pick the size.</span>
              </p>
              <ol className="mt-6 space-y-2.5">
                {steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-[14px] text-paper/85">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-paper/25 font-mono text-[11px]">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[13px] text-paper/60">Wrong size? They swap it within 14 days, in store or by delivery.</p>
              <Link href="/gift" className={`${door} mt-7 bg-paper text-ink hover:bg-volt`}>
                Send a gift <ArrowIcon className="h-4 w-4" />
              </Link>
            </div>
            <span aria-hidden className="mx-auto block w-[180px] transition-transform duration-500 group-hover:-translate-y-1 sm:w-[210px]">
              <GiftBox className="w-full" />
            </span>
          </div>
        </div>

        {/* Gift cards */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-[26px] bg-[#f2f2f0] p-6 md:p-9">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">Gift cards</p>
            <p className="display mt-2 text-[clamp(1.9rem,1.4rem+1.6vw,2.8rem)] leading-[0.92]">
              Not sure what?
              <br />
              <span className="text-steel-dark">Let them choose.</span>
            </p>
            <p className="mt-3 text-[14px] text-steel-dark">
              From {formatPrice(GIFT_CARD_MIN)} to {formatPrice(GIFT_CARD_MAX)}. Spend it online or in store.
            </p>
          </div>
          {/* Three cards, held like a hand: they spread when the panel is pointed at */}
          <span className="relative mx-auto my-8 block h-[120px] w-[190px]" aria-hidden>
            <span className="absolute inset-x-0 top-2 block origin-bottom-left rotate-[-12deg] transition-transform duration-500 group-hover:rotate-[-22deg]">
              <GiftCardPicture amount={20000} className="shadow-[0_12px_24px_-10px_rgba(0,0,0,0.5)]" />
            </span>
            <span className="absolute inset-x-0 top-2 block origin-bottom-left rotate-[-3deg] transition-transform duration-500 group-hover:rotate-[-7deg]">
              <GiftCardPicture amount={5000} className="shadow-[0_12px_24px_-10px_rgba(0,0,0,0.5)]" />
            </span>
            <span className="absolute inset-x-0 top-2 block origin-bottom-left rotate-[6deg] transition-transform duration-500 group-hover:rotate-[12deg]">
              <GiftCardPicture amount={2000} className="shadow-[0_12px_24px_-10px_rgba(0,0,0,0.5)]" />
            </span>
          </span>
          <Link href="/gift#buy" className={`${door} self-start border border-ink hover:bg-ink hover:text-paper`}>
            Gift cards <ArrowIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
