"use client";

import { useActionState } from "react";

import { resetStaffPasswordAction, type ResetState } from "@/app/admin/staff-actions";

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 font-mono text-base outline-none focus:border-ink";

/** Owner sets a new password for someone who forgot theirs (or whose password leaked). */
export function ResetPasswordForm({ id, username, min }: { id: string; username: string; min: number }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetStaffPasswordAction, { status: "idle" });
  return (
    <details className="mt-3">
      <summary className="min-h-11 cursor-pointer content-center text-[14px] underline underline-offset-2">Reset {username}&apos;s password</summary>
      <form action={action} key={state.status === "saved" ? state.message : "form"} className="mt-2 max-w-sm space-y-3">
        <input type="hidden" name="id" value={id} />
        <div>
          <label htmlFor={`reset-${id}`} className="block text-sm font-semibold">
            New password
          </label>
          <input id={`reset-${id}`} name="password" type="text" required minLength={min} autoComplete="new-password" spellCheck={false} className={input} />
          <p className="mt-1 text-[13px] text-steel-dark">At least {min} characters. This signs them out on every device.</p>
        </div>
        <p role={state.status === "error" ? "alert" : "status"} className={`min-h-5 text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-steel-dark"}`}>
          {state.status === "idle" ? "" : state.message}
        </p>
        <button type="submit" disabled={pending} className="btn btn-outline">
          {pending ? "Saving…" : "Set new password"}
        </button>
      </form>
    </details>
  );
}
