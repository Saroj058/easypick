"use client";

import { useState } from "react";

import { GiftCardPicture, PRINTED_CARDS } from "@/components/gift-card-art";
import { GiftCardForm } from "@/components/gift-card-form";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatPrice } from "@/lib/format";

// Gift cards are bought on the Gift page itself: every card is laid out to choose from, and choosing
// one opens the form in a sheet over the page (up from the bottom on phones, a panel in the middle on
// larger screens). There is no separate gift cards page to go to.

export function GiftCardPicker() {
  /** The card the form was opened on; null while the sheet is closed. */
  const [picked, setPicked] = useState<number | "custom" | null>(null);

  return (
    <>
      <ul className="mt-8 grid grid-cols-2 items-center gap-x-3 gap-y-5 sm:grid-cols-3 md:gap-x-6 md:gap-y-8">
        {PRINTED_CARDS.map((amount, i) => (
          <li key={amount}>
            <button
              type="button"
              onClick={() => setPicked(amount)}
              aria-label={`Gift card, ${formatPrice(amount)}`}
              aria-haspopup="dialog"
              className={`block w-full cursor-pointer rounded-[10px] transition-transform duration-300 hover:-translate-y-1 hover:rotate-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper ${i % 2 ? "rotate-[1.5deg]" : "-rotate-[1.5deg]"}`}
            >
              <GiftCardPicture amount={amount} className="shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)]" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] text-paper/75">
        Another amount in mind?
        <button type="button" onClick={() => setPicked("custom")} aria-haspopup="dialog" className="inline-flex h-11 items-center rounded-full border border-paper/45 px-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-paper transition-colors hover:border-paper">
          Choose your own
        </button>
      </p>

      <Sheet open={picked !== null} onOpenChange={(open) => !open && setPicked(null)}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[94dvh] w-full max-w-[1040px] overflow-y-auto rounded-t-[18px] border-mist bg-paper px-4 pb-0 pt-5 text-ink md:bottom-auto md:top-1/2 md:max-h-[90dvh] md:-translate-y-1/2 md:rounded-[18px] md:px-8 md:pb-8 md:pt-7"
        >
          <SheetTitle className="display pr-10 text-[32px] leading-none">Send a gift card</SheetTitle>
          <SheetDescription className="mt-1 text-[14px] text-steel-dark">It arrives by email, and they spend it online or in the store.</SheetDescription>
          <div className="mt-6">{picked !== null && <GiftCardForm key={picked} initialValue={picked} inSheet />}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
