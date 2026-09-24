"use client";

import { useActionState } from "react";

import { completeProfile, saveProfile, type ProfileState } from "@/app/auth-actions";

const input = "mt-2 h-14 w-full rounded-[2px] border border-steel-dark bg-paper px-4 text-base";

export function ProfileForm({
  mode,
  next = "/account",
  user,
}: {
  mode: "welcome" | "edit";
  next?: string;
  user: { name: string | null; email: string | null; alerts: boolean; phone: string | null; contactPhone: string | null };
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(mode === "welcome" ? completeProfile : saveProfile, { status: "idle" });

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="pf-name" className="block text-sm font-semibold">
          Your name
        </label>
        <input id="pf-name" name="name" autoComplete="name" required defaultValue={user.name ?? ""} className={input} />
      </div>
      <div>
        <label htmlFor="pf-email" className="block text-sm font-semibold">
          Email <span className="font-normal text-steel-dark">(optional, for receipts)</span>
        </label>
        <input id="pf-email" name="email" type="email" autoComplete="email" defaultValue={user.email ?? ""} className={input} />
      </div>
      {user.phone ? (
        <div>
          <p className="text-sm font-semibold">Mobile number</p>
          <p className="mt-1 font-mono">
            {user.phone} <span className="ml-2 font-sans text-[13px] text-steel-dark">Verified</span>
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="pf-phone" className="block text-sm font-semibold">
            Mobile number <span className="font-normal text-steel-dark">(optional, for order updates)</span>
          </label>
          <input
            id="pf-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98XXXXXXXX"
            defaultValue={user.contactPhone ?? ""}
            className={`${input} font-mono`}
          />
          <p className="mt-1 text-[13px] text-steel-dark">Saved without a code. It fills in checkout and gets pickup SMS.</p>
        </div>
      )}
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" name="alerts" defaultChecked={mode === "welcome" ? true : user.alerts} className="h-5 w-5 shrink-0 accent-[#c6ff3d]" />
        Message me the day before each drop. Reply STOP any time.
      </label>
      <p role="status" className="min-h-5 text-[13px]">
        {state.status === "error" ? <span className="text-error-light">{state.message}</span> : state.status === "saved" ? "Saved." : ""}
      </p>
      <button type="submit" className="btn btn-ink w-full sm:w-auto" disabled={pending} aria-busy={pending}>
        {mode === "welcome" ? "Continue" : "Save changes"}
      </button>
    </form>
  );
}
