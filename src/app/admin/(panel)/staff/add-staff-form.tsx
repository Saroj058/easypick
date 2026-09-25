"use client";

import { useActionState } from "react";

import { addStaffAction, type SaveState } from "@/app/admin/actions";

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink";
const label = "block text-sm font-semibold";

export function AddStaffForm({ min }: { min: number }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(addStaffAction, { status: "idle" });
  return (
    <form action={action} key={state.status === "saved" ? state.message : "form"} className="space-y-5" aria-labelledby="add-h">
      <h3 id="add-h" className="text-lg font-semibold">
        Add someone
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="s-user" className={label}>
            Username
          </label>
          <input id="s-user" name="username" required autoComplete="off" autoCapitalize="none" spellCheck={false} className={input} />
        </div>
        <div>
          <label htmlFor="s-pass" className={label}>
            Starting password
          </label>
          <input id="s-pass" name="password" type="text" required minLength={min} autoComplete="new-password" spellCheck={false} className={`${input} font-mono`} />
          <p className="mt-1 text-[13px] text-steel-dark">At least {min} characters. They can change it in Account.</p>
        </div>
      </div>
      <fieldset>
        <legend className={label}>What they can do</legend>
        <label className="mt-2 flex min-h-11 items-start gap-3 text-[15px]">
          <input type="radio" name="role" value="helper" defaultChecked className="mt-1 h-5 w-5 accent-ink" />
          <span>
            <span className="font-semibold">Helper</span>
            <span className="block text-[14px] text-steel-dark">Uses the helper portal (/helper): packs and hands over orders, swaps sizes, updates stock. No prices, refunds or reports.</span>
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-3 text-[15px]">
          <input type="radio" name="role" value="owner" className="mt-1 h-5 w-5 accent-ink" />
          <span>
            <span className="font-semibold">Owner</span>
            <span className="block text-[14px] text-steel-dark">Everything, including prices, refunds, drops, gift cards and staff.</span>
          </span>
        </label>
      </fieldset>
      <p role={state.status === "error" ? "alert" : "status"} className={`min-h-5 text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-steel-dark"}`}>
        {state.status === "idle" ? "" : state.message}
      </p>
      <button type="submit" disabled={pending} className="btn btn-ink">
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
