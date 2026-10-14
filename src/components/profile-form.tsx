"use client";

import { useActionState, useState } from "react";

import { completeProfile, saveProfile, type ProfileState } from "@/app/auth-actions";
import type { SavedCheckout } from "@/lib/types";

const input =
  "mt-1.5 h-11 w-full rounded-xl border border-ink/20 bg-paper px-4 text-base outline-none transition-[border-color,box-shadow] placeholder:text-steel focus:border-ink focus:shadow-[0_0_0_3px_rgba(10,10,10,0.06)]";

export function ProfileForm({
  mode,
  next = "/account",
  user,
}: {
  mode: "welcome" | "edit";
  next?: string;
  user: { name: string | null; email: string | null; alerts: boolean; phone: string | null; contactPhone: string | null; checkout?: SavedCheckout | null };
}) {
  // Held here (not left to the browser) so what was saved stays on screen after Save.
  const [method, setMethod] = useState(user.checkout?.method ?? "pickup");
  const [f, setF] = useState({
    name: user.name ?? "",
    email: user.email ?? "",
    phone: user.contactPhone ?? "",
    area: user.checkout?.address?.area ?? "",
    landmark: user.checkout?.address?.landmark ?? "",
    details: user.checkout?.address?.details ?? "",
    alerts: mode === "welcome" ? true : user.alerts,
  });
  const bind = (k: "name" | "email" | "phone" | "area" | "landmark" | "details") => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value })) });
  const [state, action, pending] = useActionState<ProfileState, FormData>(mode === "welcome" ? completeProfile : saveProfile, { status: "idle" });

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="pf-name" className="block text-sm font-semibold">
          Your name
        </label>
        <input id="pf-name" name="name" autoComplete="name" required {...bind("name")} className={input} />
      </div>
      <div>
        <label htmlFor="pf-email" className="block text-sm font-semibold">
          Email <span className="font-normal text-steel-dark">(optional, for receipts)</span>
        </label>
        <input id="pf-email" name="email" type="email" autoComplete="email" {...bind("email")} className={input} />
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
            {...bind("phone")}
            className={`${input} font-mono`}
          />
          <p className="mt-1 text-[13px] text-steel-dark">Saved without a code. It fills in checkout and gets pickup SMS.</p>
        </div>
      )}
      {mode === "edit" && (
        <fieldset>
          <legend className="text-sm font-semibold">Orders reach me by</legend>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-mist p-1">
            {(["pickup", "delivery"] as const).map((m) => (
              <label key={m} className="relative cursor-pointer">
                <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="peer sr-only" />
                <span className="flex h-9 items-center justify-center rounded-full text-[13.5px] font-semibold text-ink/60 transition-colors peer-checked:bg-paper peer-checked:text-ink peer-checked:shadow-[0_1px_4px_rgba(0,0,0,0.12)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ink">
                  {m === "pickup" ? "Store pickup" : "Delivery"}
                </span>
              </label>
            ))}
          </div>
          {/* Kept even when pickup is chosen, so switching back needs nothing typed. */}
          <div className={method === "delivery" ? "mt-4 space-y-4" : "hidden"}>
            <div>
              <label htmlFor="pf-area" className="block text-sm font-semibold">
                Area
              </label>
              <input id="pf-area" name="area" autoComplete="address-level3" placeholder="Baneshwor, Kathmandu" {...bind("area")} className={input} />
            </div>
            <div>
              <label htmlFor="pf-landmark" className="block text-sm font-semibold">
                Nearby landmark
              </label>
              <input id="pf-landmark" name="landmark" placeholder="Opposite Big Mart" {...bind("landmark")} className={input} />
            </div>
            <div>
              <label htmlFor="pf-details" className="block text-sm font-semibold">
                House or floor <span className="font-normal text-steel-dark">(optional)</span>
              </label>
              <input id="pf-details" name="details" autoComplete="address-line2" {...bind("details")} className={input} />
            </div>
          </div>
          <p className="mt-2 text-[13px] text-steel-dark">Checkout and gifts use these, so there&apos;s nothing to type.</p>
        </fieldset>
      )}
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" name="alerts" checked={f.alerts} onChange={(e) => setF((v) => ({ ...v, alerts: e.target.checked }))} className="h-5 w-5 shrink-0 accent-[#c6ff3d]" />
        Message me on drop days (email, or WhatsApp if there is no email). Every message has a link to stop.
      </label>
      <p role="status" className="min-h-5 text-[13px]">
        {state.status === "error" ? <span className="text-error-light">{state.message}</span> : state.status === "saved" ? "Saved." : ""}
      </p>
      <button type="submit" className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-full bg-ink px-6 text-[14px] font-semibold text-paper transition-[background-color,scale] hover:bg-[#222] active:scale-[0.98] disabled:opacity-60 sm:w-auto" disabled={pending} aria-busy={pending}>
        {mode === "welcome" ? "Continue" : "Save changes"}
      </button>
    </form>
  );
}
