"use client";

import { useActionState } from "react";

import { addCardToAccount, type WalletState } from "@/app/wallet-actions";

/** "Add a gift card": type the code once, and it's used at checkout from then on. */
export function WalletForm() {
  const [state, action, pending] = useActionState<WalletState, FormData>(addCardToAccount, { status: "idle" });
  return (
    <form action={action} key={state.status === "saved" ? state.message : "form"} className="mt-6">
      <label htmlFor="w-code" className="block text-sm font-semibold">
        Add a gift card
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="w-code"
          name="code"
          required
          placeholder="EP-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="w-msg"
          className="h-[52px] min-w-0 flex-1 rounded-[2px] border border-steel-dark bg-paper px-4 font-mono uppercase"
        />
        <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-ink shrink-0">
          {pending ? "Checking…" : "Add"}
        </button>
      </div>
      <p id="w-msg" role={state.status === "error" ? "alert" : "status"} className={`mt-2 min-h-5 text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-steel-dark"}`}>
        {state.status === "idle" ? "" : state.message}
      </p>
    </form>
  );
}
