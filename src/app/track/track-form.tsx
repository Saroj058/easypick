"use client";

import { useActionState } from "react";

import { trackOrder, type TrackState } from "@/app/actions";

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink";

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, { status: "idle" });
  // The form resets after each try; keep what they typed.
  const typed = state.status === "error" ? state : { number: "", phone: "" };
  return (
    <form action={action} className="mt-10 space-y-6">
      <div>
        <label htmlFor="number" className="block text-sm font-semibold">
          Order number
        </label>
        <input key={`n-${typed.number}`} id="number" name="number" defaultValue={typed.number} placeholder="EP-123456" autoCapitalize="characters" required className={`${input} font-mono uppercase`} />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-semibold">
          Mobile number
        </label>
        <input key={`p-${typed.phone}`} id="phone" name="phone" defaultValue={typed.phone} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98XXXXXXXX" required className={`${input} font-mono`} />
      </div>
      <p role="alert" className="min-h-5 text-[14px] text-[#d70015]">
        {state.status === "error" ? state.message : ""}
      </p>
      <button type="submit" disabled={pending} className="btn btn-volt w-full">
        {pending ? "Checking…" : "Check status"}
      </button>
    </form>
  );
}
