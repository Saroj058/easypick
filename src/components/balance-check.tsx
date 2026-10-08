"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";

import { checkBalance, type BalanceState } from "@/app/wallet-actions";
import { formatPrice } from "@/lib/format";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "long", year: "numeric" });

/** Check a card's balance and expiry: one slim field with its button inside. Limited to a few tries, like checkout. */
export function BalanceCheck() {
  const [state, action, pending] = useActionState<BalanceState, FormData>(checkBalance, { status: "idle" });
  return (
    <form action={action}>
      <label htmlFor="bal-code" className="sr-only">
        Gift card code
      </label>
      {/* The field and its button are one pill: the button sits inside the field's right end. */}
      <div className="flex h-12 items-center rounded-full border border-steel-dark bg-paper pl-5 pr-1 transition-colors focus-within:border-ink focus-within:ring-1 focus-within:ring-ink">
        <input
          id="bal-code"
          name="code"
          required
          placeholder="EP-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="bal-result"
          className="h-full min-w-0 flex-1 bg-transparent font-mono text-base uppercase outline-none placeholder:text-steel-dark"
        />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="group inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-paper transition-[background-color,scale] duration-150 hover:bg-volt hover:text-ink active:scale-[0.97] disabled:cursor-default disabled:opacity-60"
        >
          {pending ? "Checking" : "Check"}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        </button>
      </div>
      <div id="bal-result" role={state.status === "error" ? "alert" : "status"}>
        {state.status === "ok" && (
          <p className="mt-2 pl-5 text-[14px]">
            <span className="font-mono text-lg font-semibold">{formatPrice(state.balance)}</span> left · valid until {day.format(new Date(state.expiresAt))}
          </p>
        )}
        {state.status === "error" && <p className="mt-2 pl-5 text-[14px] text-error-light">{state.message}</p>}
      </div>
    </form>
  );
}
