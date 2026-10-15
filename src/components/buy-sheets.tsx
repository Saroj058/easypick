"use client";

import { useEffect, useState } from "react";

import { CheckoutForm } from "@/app/checkout/checkout-form";
import type { BagLine } from "@/lib/types";
import { SendSheet } from "./gift/gift-pieces";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

// Buying never leaves the page (owner, 16 Oct 2026): Buy now, Checkout and Send as gift open in a
// pop-up over wherever they are. Anything can open one with openBuyNow / openCheckout /
// openSendGift; <BuySheets /> is mounted once in the layout. (The wallet's own payment page,
// eSewa or Khalti, still opens when they pay: that part is the wallet's.)

const BUY = "ep:buy-now";
const CHECKOUT = "ep:checkout";
const GIFT = "ep:send-gift";

type GiftPiece = { slug: string; name: string; price: number };

/** One piece (or a few), straight to payment: no bag, no account needed. */
export function openBuyNow(lines: BagLine[], title = "Buy now") {
  window.dispatchEvent(new CustomEvent(BUY, { detail: { lines, title } }));
}
/** The bag, to payment. */
export function openCheckout() {
  window.dispatchEvent(new Event(CHECKOUT));
}
/** A piece, sent as a gift. */
export function openSendGift(piece: GiftPiece, initial?: { colour?: string; size?: string }) {
  window.dispatchEvent(new CustomEvent(GIFT, { detail: { piece, initial } }));
}

export function BuySheets() {
  const [buy, setBuy] = useState<{ lines: BagLine[]; title: string } | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [gift, setGift] = useState<{ piece: GiftPiece; initial?: { colour?: string; size?: string } } | null>(null);

  useEffect(() => {
    const onBuy = (e: Event) => setBuy((e as CustomEvent<{ lines: BagLine[]; title: string }>).detail);
    const onCheckout = () => setCheckout(true);
    const onGift = (e: Event) => setGift((e as CustomEvent<{ piece: GiftPiece; initial?: { colour?: string; size?: string } }>).detail);
    window.addEventListener(BUY, onBuy);
    window.addEventListener(CHECKOUT, onCheckout);
    window.addEventListener(GIFT, onGift);
    return () => {
      window.removeEventListener(BUY, onBuy);
      window.removeEventListener(CHECKOUT, onCheckout);
      window.removeEventListener(GIFT, onGift);
    };
  }, []);

  return (
    <>
      <Sheet open={buy !== null} onOpenChange={(o) => !o && setBuy(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto border-mist bg-paper p-5 pt-6 sm:max-w-md">
          <SheetTitle className="display text-[34px] leading-none">{buy?.title ?? "Buy now"}</SheetTitle>
          {buy && (
            <>
              <SheetDescription className="mt-2 text-[14px] text-steel-dark">
                {buy.lines.map((l) => `${l.name} · ${l.colour}${l.size === "ONE" ? "" : ` · ${l.size}`}`).join(", ")}
              </SheetDescription>
              <CheckoutForm buyNow={buy.lines} />
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={checkout} onOpenChange={setCheckout}>
        <SheetContent side="right" className="w-full overflow-y-auto border-mist bg-paper p-5 pt-6 sm:max-w-md">
          <SheetTitle className="display text-[34px] leading-none">Checkout</SheetTitle>
          <SheetDescription className="sr-only">Your bag, to payment.</SheetDescription>
          {checkout && <CheckoutForm />}
        </SheetContent>
      </Sheet>

      <SendSheet piece={gift?.piece ?? null} initial={gift?.initial} onClose={() => setGift(null)} />
    </>
  );
}
