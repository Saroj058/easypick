"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { checkBalance, type BalanceState } from "@/app/wallet-actions";
import { formatPrice } from "@/lib/format";
import { GiftCardPicture } from "./gift-card-art";
import { FlowButton } from "./ui/flow-button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "long", year: "numeric" });

/**
 * Check a card's balance and expiry. The code goes in a rounded field in the middle; the Check
 * button stands apart at the end, the same button as the Rail's Shop all. When the card is found,
 * a sheet opens with what is left on it and the two places to spend it: the shop and the drops.
 * Limited to a few tries, like checkout.
 */
export function BalanceCheck() {
  const [state, action, pending] = useActionState<BalanceState, FormData>(checkBalance, { status: "idle" });
  /** The answer whose sheet was closed: a new check brings a new answer, and a new sheet. */
  const [closed, setClosed] = useState<BalanceState | null>(null);
  const found = state.status === "ok" ? state : null;

  return (
    <form action={action} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 md:gap-x-6">
      <div className="mx-auto w-full max-w-[380px]">
        <label htmlFor="bal-code" className="sr-only">
          Gift card code
        </label>
        <input
          id="bal-code"
          name="code"
          required
          placeholder="EP-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="bal-result"
          className="h-12 w-full rounded-full border border-steel-dark bg-paper px-5 text-center font-mono text-base uppercase outline-none transition-colors placeholder:text-steel-dark focus:border-ink focus:ring-1 focus:ring-ink"
        />
      </div>
      <FlowButton type="submit" text={pending ? "Checking" : "Check"} disabled={pending} solid />
      <div id="bal-result" role={state.status === "error" ? "alert" : "status"} className="col-span-2 text-center">
        {found && (
          <p className="text-[14px]">
            <span className="font-mono text-lg font-semibold">{formatPrice(found.balance)}</span> left · valid until {day.format(new Date(found.expiresAt))}
          </p>
        )}
        {state.status === "error" && <p className="text-[14px] text-error-light">{state.message}</p>}
      </div>

      <Sheet open={Boolean(found) && closed !== state} onOpenChange={(open) => !open && setClosed(state)}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-[460px] rounded-t-[18px] border-mist bg-paper px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-6 text-center text-ink md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-[18px] md:p-8"
        >
          {found && (
            <>
              <div className="mx-auto w-[78%] max-w-[300px] -rotate-2">
                <GiftCardPicture amount={found.balance} />
              </div>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">On your card</p>
              <SheetTitle className="mt-1 font-mono text-[44px] font-semibold leading-none">{formatPrice(found.balance)}</SheetTitle>
              <SheetDescription className="mt-2 text-[15px] text-steel-dark">
                {found.balance > 0 ? `Ready to spend until ${day.format(new Date(found.expiresAt))}.` : "This card has been used up."}
              </SheetDescription>
              {found.balance > 0 && <p className="mt-1 text-[13px] text-steel-dark">Type the code at checkout and it comes off the total.</p>}
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <Link href="/shop" className="btn btn-ink w-full">
                  Shop now
                </Link>
                <Link href="/drops" className="btn btn-outline w-full">
                  See the drops
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </form>
  );
}
