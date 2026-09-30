"use client";

import { useActionState } from "react";

import { checkBalance, type BalanceState } from "@/app/wallet-actions";
import { formatPrice } from "@/lib/format";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "long", year: "numeric" });

/** Check a card's balance and expiry. Limited to a few tries, like checkout. */
export function BalanceCheck() {
  const [state, action, pending] = useActionState<BalanceState, FormData>(checkBalance, { status: "idle" });
  return (
    <form action={action} className="max-w-md">
      <label htmlFor="bal-code" className="block text-sm font-semibold">
        Gift card code
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="bal-code"
          name="code"
          required
          placeholder="EP-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="bal-result"
          className="h-14 min-w-0 flex-1 rounded-[2px] border border-steel-dark bg-paper px-4 font-mono uppercase"
        />
        <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-ink shrink-0">
          {pending ? "Checking…" : "Check"}
        </button>
      </div>
      <div id="bal-result" role={state.status === "error" ? "alert" : "status"} className="mt-3 min-h-6">
        {state.status === "ok" && (
          <p className="text-[15px]">
            <span className="font-mono text-2xl font-semibold">{formatPrice(state.balance)}</span> left · valid until {day.format(new Date(state.expiresAt))}
          </p>
        )}
        {state.status === "error" && <p className="text-[14px] text-error-light">{state.message}</p>}
      </div>
    </form>
  );
}
