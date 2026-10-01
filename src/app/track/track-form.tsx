"use client";

import { useActionState } from "react";

import { trackOrder, type TrackState } from "@/app/actions";

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink";

/**
 * Order number + phone → the order page. No account needed.
 * `compact`: fields and button in one row on wide screens (the home page). `id` keeps field ids unique per page.
 */
export function TrackForm({ compact = false, id = "track" }: { compact?: boolean; id?: string }) {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, { status: "idle" });
  // The form resets after each try; keep what they typed.
  const typed = state.status === "error" ? state : { number: "", phone: "" };
  // The home page strip is small: shorter fields, a quiet button, and no empty line kept for errors.
  const field = compact ? "mt-1.5 h-11 w-full rounded-[2px] border border-mist bg-paper px-3 text-[15px] outline-none focus:border-ink" : input;
  return (
    <form action={action} className={compact ? "grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end" : "mt-10 space-y-6"}>
      <div>
        <label htmlFor={`${id}-number`} className={`block font-semibold ${compact ? "text-[13px]" : "text-sm"}`}>
          Order number
        </label>
        <input
          key={`n-${typed.number}`}
          id={`${id}-number`}
          name="number"
          defaultValue={typed.number}
          placeholder="EP-123456"
          autoCapitalize="characters"
          required
          aria-describedby={`${id}-error`}
          className={`${field} font-mono uppercase`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-phone`} className={`block font-semibold ${compact ? "text-[13px]" : "text-sm"}`}>
          Mobile number
        </label>
        <input
          key={`p-${typed.phone}`}
          id={`${id}-phone`}
          name="phone"
          defaultValue={typed.phone}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98XXXXXXXX"
          required
          aria-describedby={`${id}-error`}
          className={`${field} font-mono`}
        />
      </div>
      <button type="submit" disabled={pending} className={compact ? "h-11 w-full rounded-[2px] border border-ink bg-paper px-5 text-[14px] font-semibold hover:bg-ink hover:text-paper disabled:opacity-60 md:w-auto" : "btn btn-volt w-full"}>
        {pending ? "Checking…" : compact ? "Track order" : "Check status"}
      </button>
      <p id={`${id}-error`} role="alert" className={`text-[14px] text-error-light ${compact ? "md:col-span-3" : "min-h-5"}`}>
        {state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
