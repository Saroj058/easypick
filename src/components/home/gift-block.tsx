import Link from "next/link";

import { GiftBox } from "@/components/gift/gift-box";
import { GiftCardPicture } from "@/components/gift-card-art";
import { ArrowIcon } from "@/components/icons";

/**
 * The home page's way into gifting: one slim strip, not a section. The Gift page does the
 * explaining; this only says it exists and offers its two doors. The box's lid lifts and the
 * cards fan out when the strip is pointed at, so the strip itself shows what's inside.
 */
export function GiftBlock() {
  const door = "inline-flex h-11 items-center gap-2 rounded-full px-5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-[background-color,color,scale] duration-200 active:scale-[0.97]";
  return (
    <div className="gift-tile group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-ink p-4 md:flex-row md:items-center md:gap-6 md:py-3 md:pl-3 md:pr-4">
      <div className="flex items-center gap-4">
        {/* The box, on its own black tab like the Rail's name */}
        <span className="on-dark grid h-[72px] w-[84px] shrink-0 place-items-end overflow-hidden rounded-xl bg-ink" aria-hidden>
          <GiftBox className="-mb-3 w-[84px]" />
        </span>
        <div>
          <h2 id="gift-title" className="display text-[26px] leading-none md:text-[30px]">
            Buying for someone?
          </h2>
          <p className="mt-1.5 text-[14px] text-steel-dark">You know them. We handle the size, the wrap and the delivery.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        <Link href="/gift" className={`${door} bg-ink text-paper hover:bg-volt hover:text-ink`}>
          Send a gift <ArrowIcon className="h-4 w-4" />
        </Link>
        <Link href="/gift#buy" className={`${door} border border-ink hover:bg-ink hover:text-paper`}>
          Gift cards
        </Link>
        {/* Three cards, held like a hand: they spread when the strip is pointed at */}
        <span className="relative ml-3 hidden h-[60px] w-[96px] shrink-0 lg:block" aria-hidden>
          <span className="absolute inset-x-0 top-1 block origin-bottom-left rotate-[-12deg] transition-transform duration-300 group-hover:rotate-[-22deg]">
            <GiftCardPicture amount={20000} className="shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)]" />
          </span>
          <span className="absolute inset-x-0 top-1 block origin-bottom-left rotate-[-3deg] transition-transform duration-300 group-hover:rotate-[-7deg]">
            <GiftCardPicture amount={5000} className="shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)]" />
          </span>
          <span className="absolute inset-x-0 top-1 block origin-bottom-left rotate-[6deg] transition-transform duration-300 group-hover:rotate-[10deg]">
            <GiftCardPicture amount={2000} className="shadow-[0_8px_18px_-8px_rgba(0,0,0,0.6)]" />
          </span>
        </span>
      </div>
    </div>
  );
}
