"use client";

import { CalendarClock, Mail, Store } from "lucide-react";
import { useState } from "react";

import { GiftCardPicture, PRINTED_CARDS } from "@/components/gift-card-art";
import { GiftCardForm } from "@/components/gift-card-form";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatPrice } from "@/lib/format";

// Gift cards live here, on the Gift page: there is no separate page. The section says who the card
// is for (the choice at the top), shows every card, and opens the form in a sheet over the page when
// one is chosen (up from the bottom on phones, a panel in the middle on larger screens).

const FACTS = [
  [Mail, "By email in minutes"],
  [CalendarClock, "Valid for 12 months"],
  [Store, "Online and in the store"],
] as const;

export function GiftCardPicker() {
  /** The card the form was opened on; null while the sheet is closed. */
  const [picked, setPicked] = useState<number | "custom" | null>(null);
  const [forMe, setForMe] = useState(false);
  const seg = (on: boolean) => `h-11 flex-1 cursor-pointer whitespace-nowrap rounded-full px-5 text-[13px] font-semibold uppercase tracking-[0.06em] transition-colors duration-200 ${on ? "bg-ink text-paper" : "text-ink hover:bg-mist/60"}`;

  return (
    <>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="cards-h" className="display display-h2">
            Gift cards.
          </h2>
          <p className="mt-2 max-w-[44ch] text-steel-dark">Pick a card and fill it in right here.</p>
        </div>
        {/* Who it's for: the form opens already set this way */}
        <div role="radiogroup" aria-label="Who is the card for" className="flex rounded-full border border-ink p-1 md:w-auto">
          <button type="button" role="radio" aria-checked={!forMe} onClick={() => setForMe(false)} className={seg(!forMe)}>
            For someone
          </button>
          <button type="button" role="radio" aria-checked={forMe} onClick={() => setForMe(true)} className={seg(forMe)}>
            For myself
          </button>
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-y border-mist py-3 text-[13px] text-steel-dark">
        {FACTS.map(([Icon, text]) => (
          <li key={text} className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-ink" strokeWidth={1.75} aria-hidden />
            {text}
          </li>
        ))}
      </ul>

      <ul className="mt-6 grid grid-cols-2 items-end gap-x-3 gap-y-6 sm:grid-cols-3 md:gap-x-6 md:gap-y-8 lg:grid-cols-5">
        {PRINTED_CARDS.map((amount) => (
          <li key={amount}>
            <button
              type="button"
              onClick={() => setPicked(amount)}
              aria-label={`Gift card, ${formatPrice(amount)}`}
              aria-haspopup="dialog"
              className="group block w-full cursor-pointer rounded-[10px] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              <span className="block transition-transform duration-300 group-hover:-translate-y-1">
                <GiftCardPicture amount={amount} className="shadow-[0_14px_28px_-16px_rgba(0,0,0,0.55)]" />
              </span>
              <span className="mt-3 flex items-baseline justify-between gap-2">
                <span className="font-mono text-[15px] font-semibold">{formatPrice(amount)}</span>
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-steel-dark transition-colors group-hover:text-ink">Choose</span>
              </span>
            </button>
          </li>
        ))}
        {/* Any other amount: the tenth tile */}
        <li>
          <button
            type="button"
            onClick={() => setPicked("custom")}
            aria-haspopup="dialog"
            className="group block w-full cursor-pointer rounded-[10px] text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            <span className="grid aspect-[1.81/1] w-full place-items-center rounded-[10px] border border-dashed border-ink/60 text-center transition-colors duration-200 group-hover:border-ink group-hover:bg-photo">
              <span className="display text-[20px] leading-none md:text-[22px]">Your amount</span>
            </span>
            <span className="mt-3 flex items-baseline justify-between gap-2">
              <span className="font-mono text-[15px] font-semibold">Any amount</span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-steel-dark transition-colors group-hover:text-ink">Choose</span>
            </span>
          </button>
        </li>
      </ul>

      <Sheet open={picked !== null} onOpenChange={(open) => !open && setPicked(null)}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[94dvh] w-full max-w-[1040px] overflow-y-auto rounded-t-[18px] border-mist bg-paper px-4 pb-0 pt-5 text-ink md:bottom-auto md:top-1/2 md:max-h-[90dvh] md:-translate-y-1/2 md:rounded-[18px] md:px-8 md:pb-8 md:pt-7"
        >
          <SheetTitle className="display pr-10 text-[32px] leading-none">{forMe ? "A gift card for you" : "Send a gift card"}</SheetTitle>
          <SheetDescription className="mt-1 text-[14px] text-steel-dark">It arrives by email, and is spent online or in the store.</SheetDescription>
          <div className="mt-6">{picked !== null && <GiftCardForm key={`${picked}-${forMe}`} initialValue={picked} initialForMe={forMe} inSheet />}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
