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
  // The field has no box of its own: it sits inside one rounded bar with the button at its end.
  const field = `h-11 w-full min-w-0 flex-1 scroll-mb-32 bg-transparent px-3 text-base outline-none ${dark ? "text-paper placeholder:text-paper/55" : "placeholder:text-steel-dark"}`;
  // WhatsApp / Email: two halves of one small switch.
  const tab = (on: boolean) =>
    `h-9 cursor-pointer rounded-full px-4 text-[13px] font-semibold transition-colors duration-200 ${
      on ? (dark ? "bg-paper text-ink" : "bg-ink text-paper") : dark ? "text-paper/75 hover:text-paper" : "text-ink/65 hover:text-ink"
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
      <div role="radiogroup" aria-label="How to reach you" className={`inline-flex gap-1 rounded-full p-1 ${dark ? "bg-paper/10" : "bg-mist"}`}>
        <button type="button" role="radio" aria-checked={channel === "whatsapp"} onClick={() => setChannel("whatsapp")} className={tab(channel === "whatsapp")}>
          WhatsApp
        </button>
        <button type="button" role="radio" aria-checked={channel === "email"} onClick={() => setChannel("email")} className={tab(channel === "email")}>
          Email
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3">
        <label htmlFor={`${id}-contact`} className="text-sm font-semibold">
          {channel === "email" ? "Email address" : "WhatsApp number"}
        </label>
        <p id={`${id}-hint`} className={`text-[12px] ${muted}`}>
          {channel === "email" ? "We only use it for drop alerts" : "10 digits, starts with 97 or 98"}
        </p>
      </div>
      <div className={`mt-2 flex items-center gap-1 rounded-full border p-1.5 transition-[border-color,box-shadow] duration-200 ${dark ? "border-paper/40 focus-within:border-paper" : "border-ink/30 bg-paper focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"}`}>
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
        <button
          type="submit"
          className={`group flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-[background-color,scale] duration-200 active:scale-[0.97] disabled:opacity-50 ${dark ? "bg-volt text-ink hover:bg-[#b5f020]" : "bg-ink text-paper hover:bg-ink/85"}`}
          aria-busy={pending}
          disabled={pending}
        >
          Notify me
          {pending && <span className="sr-only"> (sending)</span>}
        </button>
      </div>
      <label className={`mt-2 flex min-h-11 cursor-pointer items-center gap-2.5 py-1.5 text-[12.5px] ${muted}`}>
        <input type="checkbox" name="consent" required className={`h-[18px] w-[18px] shrink-0 ${dark ? "accent-[#c6ff3d]" : "accent-ink"}`} />
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
