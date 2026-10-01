"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { signUpForAlerts, type AlertState } from "@/app/actions";

/** Drop alerts: one message on drop day, on WhatsApp or by email. */
export function AlertSignup({ dark = false, source = "site" }: { dark?: boolean; source?: string }) {
  const [state, action, pending] = useActionState<AlertState, FormData>(signUpForAlerts, { status: "idle" });
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "done") doneRef.current?.focus();
  }, [state.status]);

  if (state.status === "done") {
    return (
      <p ref={doneRef} tabIndex={-1} role="status" className="text-lg font-semibold outline-none">
        You&apos;re in. One {state.channel === "email" ? "email" : "WhatsApp message"} to {state.to} on drop day, before it opens.
      </p>
    );
  }

  const id = `alert-${source}`;
  const muted = dark ? "text-paper/70" : "text-steel-dark";
  const field = `h-14 w-full min-w-0 scroll-mb-32 sm:flex-1 rounded-[2px] border px-4 text-base ${
    dark ? "border-paper/50 bg-graphite text-paper placeholder:text-paper/60" : "border-steel-dark bg-paper placeholder:text-steel-dark"
  }`;
  const tab = (on: boolean) =>
    `h-11 flex-1 border px-4 text-sm font-semibold ${
      on ? (dark ? "border-paper bg-paper text-ink" : "border-ink bg-ink text-paper") : dark ? "border-paper/40 text-paper" : "border-mist hover:border-ink"
    }`;

  return (
    <form
      // Submitted by hand so a mistake keeps what was typed (a form action resets the fields).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="w-full max-w-md"
      noValidate
    >
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="channel" value={channel} />
      <div role="radiogroup" aria-label="How to reach you" className="flex gap-2">
        <button type="button" role="radio" aria-checked={channel === "whatsapp"} onClick={() => setChannel("whatsapp")} className={tab(channel === "whatsapp")}>
          WhatsApp
        </button>
        <button type="button" role="radio" aria-checked={channel === "email"} onClick={() => setChannel("email")} className={tab(channel === "email")}>
          Email
        </button>
      </div>

      <label htmlFor={`${id}-contact`} className="mt-4 block text-sm font-semibold">
        {channel === "email" ? "Email address" : "WhatsApp number"}
      </label>
      <p id={`${id}-hint`} className={`mt-1 text-[13px] ${muted}`}>
        {channel === "email" ? "We only use it for drop alerts" : "10 digits, starts with 97 or 98"}
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        {channel === "email" ? (
          <input
            key="email"
            id={`${id}-contact`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
            aria-invalid={state.status === "error"}
            aria-describedby={`${id}-hint ${id}-msg`}
            className={field}
          />
        ) : (
          <input
            key="phone"
            id={`${id}-contact`}
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98XXXXXXXX"
            required
            aria-invalid={state.status === "error"}
            aria-describedby={`${id}-hint ${id}-msg`}
            className={`${field} font-mono`}
          />
        )}
        <button type="submit" className="btn btn-volt w-full shrink-0 sm:w-auto" aria-busy={pending} disabled={pending}>
          Notify me
          {pending && <span className="sr-only"> (sending)</span>}
        </button>
      </div>
      <label className={`mt-2 flex min-h-11 items-center gap-3 py-2 text-[13px] ${muted}`}>
        <input type="checkbox" name="consent" required className="h-5 w-5 shrink-0 accent-[#c6ff3d]" />
        <span>
          Send me one {channel === "email" ? "email" : "WhatsApp message"} on each drop day. Every message has a link to stop.
        </span>
      </label>
      <p id={`${id}-msg`} role="alert" className={`min-h-5 text-[13px] ${dark ? "text-error-dark" : "text-error-light"}`}>
        {state.status === "error" ? state.message : ""}
      </p>
    </form>
  );
}
