"use client";

import { useActionState, useState } from "react";

import { signInAdmin, type LoginState } from "@/app/admin/actions";

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInAdmin, { status: "idle" });
  const [show, setShow] = useState(false);
  const err = state.status === "error" ? state : null;

  return (
    <form action={action} className="mt-10 space-y-5">
      <div>
        <label htmlFor="username" className="block text-sm font-semibold">
          Username
        </label>
        <input
          key={err?.username ?? ""}
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={err?.username}
          aria-invalid={Boolean(err)}
          className={input}
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="block text-sm font-semibold">
            Password
          </label>
          <button type="button" onClick={() => setShow((s) => !s)} className="min-h-11 text-[13px] underline underline-offset-2" aria-controls="password">
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          required
          aria-invalid={Boolean(err)}
          className={`${input} mt-0`}
        />
      </div>
      <p role="alert" className="min-h-5 text-[14px] text-[#d70015]">
        {err?.message ?? ""}
      </p>
      <button type="submit" disabled={pending} className="btn btn-volt w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
