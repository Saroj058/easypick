"use client";

import { useActionState } from "react";

import { checkBalance, type BalanceState } from "@/app/wallet-actions";
import { formatPrice } from "@/lib/format";
import { FlowButton } from "./ui/flow-button";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "long", year: "numeric" });

/**
 * Check a card's balance and expiry. The code goes in a rounded field in the middle; the Check
 * button stands apart at the end, the same button as the Rail's Shop all. Limited to a few tries,
 * like checkout.
 */
export function BalanceCheck() {
  const [state, action, pending] = useActionState<BalanceState, FormData>(checkBalance, { status: "idle" });
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
        {state.status === "ok" && (
          <p className="text-[14px]">
            <span className="font-mono text-lg font-semibold">{formatPrice(state.balance)}</span> left · valid until {day.format(new Date(state.expiresAt))}
          </p>
        )}
        {state.status === "error" && <p className="text-[14px] text-error-light">{state.message}</p>}
      </div>
    </form>
  );
}
