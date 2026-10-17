"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

import { signUpForAlerts, type AlertState } from "@/app/actions";
import { useMe } from "./session";

/**
 * Drop alerts: one message on drop day, on WhatsApp or by email. One field takes either (an @
 * means email); signed in, their number is already there. Kept to one line on purpose (owner,
 * 17 Oct 2026: "no stress, easy and premium").
 */
export function AlertSignup({ dark = false, source = "site", note = "One message on drop day. Stop anytime.", done }: { dark?: boolean; source?: string; note?: string; /** What it says once they're in; "{to}" is their number or email, masked. */ done?: string }) {
  const [state, action, pending] = useActionState<AlertState, FormData>(signUpForAlerts, { status: "idle" });
  // Signed in: their number or email is already there.
  const me = useMe();
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "done") doneRef.current?.focus();
  }, [state.status]);

  if (state.status === "done") {
    return (
      <p ref={doneRef} tabIndex={-1} role="status" className="text-lg font-semibold outline-none">
        {done ? done.replace("{to}", state.to) : <>You&apos;re in. One {state.channel === "email" ? "email" : "WhatsApp message"} to {state.to} on drop day, before it opens.</>}
      </p>
    );
  }

  const id = `alert-${source}`;
  const muted = dark ? "text-paper/60" : "text-steel-dark";

  return (
    <form
      // Submitted by hand so a mistake keeps what was typed (a form action resets the fields).
      onSubmit={(e) => {
        e.preventDefault();
        const typed = String(new FormData(e.currentTarget).get("contact") ?? "").trim();
        const email = typed.includes("@");
        const data = new FormData();
        data.set("channel", email ? "email" : "whatsapp");
        data.set(email ? "email" : "phone", typed);
        data.set("source", source);
        // Pressing Notify me is the agreement; the line under the field says what it's for.
        data.set("consent", "on");
        startTransition(() => action(data));
      }}
      className="w-full max-w-md"
      noValidate
    >
      <label htmlFor={`${id}-contact`} className="sr-only">
        WhatsApp number or email
      </label>
      <div
        className={`flex items-center gap-1 rounded-full border p-1.5 transition-[border-color,box-shadow] duration-200 ${dark ? "border-paper/30 bg-black/30 backdrop-blur-md focus-within:border-paper/70" : "border-ink/25 bg-paper focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"}`}
      >
        <input
          key={`contact-${me?.phone ?? me?.email ?? ""}`}
          defaultValue={me?.phone ?? me?.email ?? ""}
          id={`${id}-contact`}
          name="contact"
          autoComplete="off"
          placeholder="WhatsApp number or email"
          required
          aria-invalid={state.status === "error"}
          aria-describedby={`${id}-msg`}
          className={`h-11 w-full min-w-0 flex-1 scroll-mb-32 bg-transparent px-3.5 text-base outline-none ${dark ? "text-paper placeholder:text-paper/50" : "placeholder:text-steel-dark"}`}
        />
        <button
          type="submit"
          className={`flex h-11 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full px-5 text-[13px] font-semibold transition-[background-color,scale] duration-200 active:scale-[0.97] disabled:opacity-50 ${dark ? "bg-paper text-ink hover:bg-paper/90" : "bg-ink text-paper hover:bg-ink/85"}`}
          aria-busy={pending}
          disabled={pending}
        >
          Notify me
          {pending && <span className="sr-only"> (sending)</span>}
        </button>
      </div>
      <p id={`${id}-msg`} role={state.status === "error" ? "alert" : undefined} className={`mt-2.5 px-1 text-[12.5px] ${state.status === "error" ? (dark ? "text-error-dark" : "text-error-light") : muted}`}>
        {state.status === "error" ? state.message : note}
      </p>
    </form>
  );
}
