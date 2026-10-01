"use client";

import { startTransition, useActionState } from "react";

import { signUpForAlerts, type AlertState } from "@/app/actions";

/** The footer's one-line drop alert sign-up: a WhatsApp number or an email, then Notify me. */
export function FooterAlerts() {
  const [state, action, pending] = useActionState<AlertState, FormData>(signUpForAlerts, { status: "idle" });

  if (state.status === "done") {
    return (
      <p role="status" className="text-[15px] font-semibold">
        You&apos;re in. One {state.channel === "email" ? "email" : "WhatsApp message"} to {state.to} on drop day.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const typed = String(new FormData(e.currentTarget).get("contact") ?? "").trim();
        const data = new FormData();
        const email = typed.includes("@");
        data.set("channel", email ? "email" : "whatsapp");
        data.set(email ? "email" : "phone", typed);
        data.set("source", "footer");
        // Pressing the button is the agreement; the line under the field says what it is for.
        data.set("consent", "on");
        startTransition(() => action(data));
      }}
      noValidate
    >
      <label htmlFor="footer-alert" className="block text-[14px] font-semibold">
        Drop alerts
      </label>
      <div className="mt-2 flex max-w-sm gap-2">
        <input
          id="footer-alert"
          name="contact"
          autoComplete="off"
          placeholder="WhatsApp number or email"
          required
          aria-invalid={state.status === "error"}
          aria-describedby="footer-alert-note"
          className="h-12 min-w-0 flex-1 scroll-mb-32 rounded-[2px] border border-[#48484a] bg-graphite px-3 text-[15px] text-paper placeholder:text-paper/50"
        />
        <button type="submit" disabled={pending} aria-busy={pending} className="h-12 shrink-0 rounded-[2px] bg-volt px-4 text-[14px] font-bold text-ink disabled:opacity-60">
          Notify me
        </button>
      </div>
      <p id="footer-alert-note" role={state.status === "error" ? "alert" : undefined} className={`mt-2 text-[12px] ${state.status === "error" ? "text-error-dark" : "text-paper/60"}`}>
        {state.status === "error" ? state.message : "One message on each drop day. Every message has a link to stop."}
      </p>
    </form>
  );
}
