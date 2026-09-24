"use client";

import { useActionState, useEffect, useRef } from "react";

import { signUpForAlerts, type AlertState } from "@/app/actions";

/** One-field phone sign-up for drop alerts (WhatsApp first, SMS backup). */
export function AlertSignup({ dark = false, source = "site" }: { dark?: boolean; source?: string }) {
  const [state, action, pending] = useActionState<AlertState, FormData>(signUpForAlerts, { status: "idle" });
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "done") doneRef.current?.focus();
  }, [state.status]);

  if (state.status === "done") {
    return (
      <p ref={doneRef} tabIndex={-1} role="status" className="text-lg font-semibold outline-none">
        You&apos;re in. We&apos;ll ping {state.phone} the day before the next drop.
      </p>
    );
  }

  const id = `alert-${source}`;
  const muted = dark ? "text-paper/70" : "text-steel-dark";

  return (
    <form action={action} className="w-full max-w-md" noValidate>
      <input type="hidden" name="source" value={source} />
      <label htmlFor={`${id}-phone`} className="block text-sm font-semibold">
        Mobile number
      </label>
      <p id={`${id}-hint`} className={`mt-1 text-[13px] ${muted}`}>
        10 digits, starts with 97 or 98
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id={`${id}-phone`}
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98XXXXXXXX"
          required
          aria-invalid={state.status === "error"}
          aria-describedby={`${id}-hint ${id}-msg`}
          className={`h-14 w-full min-w-0 scroll-mb-32 sm:flex-1 rounded-[2px] border px-4 font-mono text-base ${
            dark ? "border-paper/50 bg-graphite text-paper placeholder:text-paper/60" : "border-steel-dark bg-paper placeholder:text-steel-dark"
          }`}
        />
        <button type="submit" className="btn btn-volt w-full shrink-0 sm:w-auto" aria-busy={pending} disabled={pending}>
          Ping me
          {pending && <span className="sr-only"> (sending)</span>}
        </button>
      </div>
      <label className={`mt-2 flex min-h-11 items-center gap-3 py-2 text-[13px] ${muted}`}>
        <input type="checkbox" name="consent" required className="h-5 w-5 shrink-0 accent-[#c6ff3d]" />
        <span>Message me on WhatsApp or SMS before each drop. Reply STOP any time.</span>
      </label>
      <p id={`${id}-msg`} role="alert" className={`min-h-5 text-[13px] ${dark ? "text-error-dark" : "text-error-light"}`}>
        {state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
