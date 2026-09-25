"use client";

import { useActionState, useState } from "react";

import { changePassword, changeUsername, type AccountState } from "@/app/admin/actions";

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink aria-[invalid=true]:border-[#d70015]";
const label = "block text-sm font-semibold";

function Status({ state }: { state: AccountState }) {
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={`min-h-5 text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-steel-dark"}`}>
      {state.status === "idle" ? "" : state.message}
    </p>
  );
}

function CurrentPassword({ id, invalid }: { id: string; invalid: boolean }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        Current password
      </label>
      <input id={id} name="current" type="password" autoComplete="current-password" required aria-invalid={invalid} className={input} />
    </div>
  );
}

export function UsernameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(changeUsername, { status: "idle" });
  const err = state.status === "error" ? state.field : null;
  return (
    <form action={action} className="space-y-5 border-t border-mist pt-8" aria-labelledby="u-h">
      <h3 id="u-h" className="text-lg font-semibold">
        Username
      </h3>
      <div>
        <label htmlFor="a-username" className={label}>
          New username
        </label>
        <input
          id="a-username"
          name="username"
          defaultValue={current}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={err === "username"}
          aria-describedby="a-username-hint"
          className={input}
        />
        <p id="a-username-hint" className="mt-1 text-[13px] text-steel-dark">
          3 to 32 letters or numbers. Upper and lower case don&apos;t matter when signing in.
        </p>
      </div>
      <CurrentPassword id="a-current-u" invalid={err === "current"} />
      <Status state={state} />
      <button type="submit" disabled={pending} className="btn btn-ink">
        {pending ? "Saving…" : "Change username"}
      </button>
    </form>
  );
}

export function PasswordForm({ min }: { min: number }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(changePassword, { status: "idle" });
  const [show, setShow] = useState(false);
  const err = state.status === "error" ? state.field : null;
  return (
    <form action={action} className="space-y-5 border-t border-mist pt-8" aria-labelledby="p-h">
      <div className="flex items-baseline justify-between">
        <h3 id="p-h" className="text-lg font-semibold">
          Password
        </h3>
        <button type="button" onClick={() => setShow((s) => !s)} className="min-h-11 text-[13px] underline underline-offset-2">
          {show ? "Hide passwords" : "Show passwords"}
        </button>
      </div>
      <CurrentPassword id="a-current-p" invalid={err === "current"} />
      <div>
        <label htmlFor="a-new" className={label}>
          New password
        </label>
        <input
          id="a-new"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          minLength={min}
          required
          aria-invalid={err === "password"}
          aria-describedby="a-new-hint"
          className={input}
        />
        <p id="a-new-hint" className="mt-1 text-[13px] text-steel-dark">
          At least {min} characters. A few random words is easiest to remember.
        </p>
      </div>
      <div>
        <label htmlFor="a-confirm" className={label}>
          New password again
        </label>
        <input id="a-confirm" name="confirm" type={show ? "text" : "password"} autoComplete="new-password" required aria-invalid={err === "password"} className={input} />
      </div>
      <Status state={state} />
      <button type="submit" disabled={pending} className="btn btn-ink">
        {pending ? "Saving…" : "Change password"}
      </button>
      <p className="text-[13px] text-steel-dark">Changing it signs you out everywhere else.</p>
    </form>
  );
}
