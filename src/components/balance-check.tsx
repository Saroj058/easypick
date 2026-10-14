"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { checkBalance, type BalanceState } from "@/app/wallet-actions";
import { formatPrice } from "@/lib/format";
import { GiftCardPicture } from "./gift-card-art";
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
    <form action={action}>
      {/* The code and Check in one slim pill */}
      <div className="flex h-12 items-center gap-2 rounded-full border border-ink/20 bg-paper/90 p-1.5 pl-5 transition-[border-color,box-shadow] focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(10,10,10,0.06)]">
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
          className="h-full min-w-0 flex-1 bg-transparent font-mono text-base uppercase tracking-[0.04em] outline-none placeholder:text-steel md:text-[15px]"
        />
        <button type="submit" disabled={pending} className="inline-flex h-full shrink-0 cursor-pointer items-center rounded-full bg-ink px-5 text-[13px] font-semibold text-paper transition-[background-color,scale] hover:bg-[#222] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60">
          {pending ? "Checking" : "Check"}
        </button>
      </div>
      <div id="bal-result" role={state.status === "error" ? "alert" : "status"} className="mt-2 empty:mt-0">
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
