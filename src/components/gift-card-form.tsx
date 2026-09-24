"use client";

import { useActionState, useState } from "react";

import { buyGiftCard, type GiftState } from "@/app/gift-actions";
import { formatPrice } from "@/lib/format";
import { useMe, usePrefilled } from "./session";

const VALUES = [1000, 2000, 3000, 5000];
const input = "mt-2 h-14 w-full rounded-[2px] border border-steel-dark bg-paper px-4 text-base";
const label = "block text-sm font-semibold";

export function GiftCardForm() {
  const me = useMe();
  const senderField = usePrefilled(me?.name);
  const phoneField = usePrefilled(me?.phone);
  const [state, action, pending] = useActionState<GiftState, FormData>(buyGiftCard, { status: "idle" });
  const [value, setValue] = useState<number | "custom">(2000);
  const [custom, setCustom] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const amount = value === "custom" ? Number(custom) || 0 : value;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-12" noValidate>
      {/* The card itself, as they'll see it */}
      <div className="on-dark relative aspect-[1.6/1] w-full max-w-md bg-ink p-6 text-paper">
        <p className="display text-3xl">Easypick</p>
        <p className="absolute bottom-6 left-6 font-mono text-3xl font-semibold">{amount ? formatPrice(amount) : "Rs —"}</p>
        <p className="absolute bottom-7 right-6 text-sm text-paper/70">Gift card</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Amount</h2>
        <input type="hidden" name="value" value={value === "custom" ? "" : value} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Amount">
          {VALUES.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              onClick={() => setValue(v)}
              className={`h-14 rounded-[2px] border font-mono font-semibold ${value === v ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
            >
              {formatPrice(v)}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={value === "custom"}
            onClick={() => setValue("custom")}
            className={`h-14 rounded-[2px] border font-semibold ${value === "custom" ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
          >
            Other
          </button>
        </div>
        {value === "custom" && (
          <div>
            <label htmlFor="gc-custom" className={label}>
              Amount in rupees <span className="font-normal text-steel-dark">(500 to 20,000)</span>
            </label>
            <input id="gc-custom" name="custom" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} className={`${input} font-mono`} />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Who is it for?</h2>
        <div>
          <label htmlFor="gc-rname" className={label}>
            Their name
          </label>
          <input id="gc-rname" name="receiverName" className={input} />
        </div>
        <div>
          <label htmlFor="gc-remail" className={label}>
            Their email
          </label>
          <input id="gc-remail" name="receiverEmail" type="email" inputMode="email" autoComplete="off" placeholder="name@example.com" className={input} />
          <p className="mt-1 text-[13px] text-steel-dark">We email them the card and its code.</p>
        </div>
        <div>
          <label htmlFor="gc-rphone" className={label}>
            Their mobile number <span className="font-normal text-steel-dark">(optional)</span>
          </label>
          <input id="gc-rphone" name="receiverPhone" type="tel" inputMode="numeric" placeholder="98XXXXXXXX" className={`${input} font-mono`} />
          <p className="mt-1 text-[13px] text-steel-dark">We text the code too.</p>
        </div>
        <div>
          <label htmlFor="gc-message" className={label}>
            Message <span className="font-normal text-steel-dark">(optional)</span>
          </label>
          <textarea id="gc-message" name="message" rows={3} maxLength={200} className="mt-2 w-full rounded-[2px] border border-steel-dark bg-paper p-4 text-base" />
        </div>
        {!anonymous && (
          <div>
            <label htmlFor="gc-sender" className={label}>
              From
            </label>
            <input id="gc-sender" name="senderName" {...senderField} className={input} />
          </div>
        )}
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="anonymous" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-5 w-5 accent-[#c6ff3d]" />
          Send it anonymously
        </label>
        <div>
          <label htmlFor="gc-date" className={label}>
            Send on <span className="font-normal text-steel-dark">(optional, leave empty to send now)</span>
          </label>
          <input id="gc-date" name="deliverOn" type="date" min={today} className={input} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">You</h2>
        <div>
          <label htmlFor="gc-bphone" className={label}>
            Your mobile number
          </label>
          <input
            id="gc-bphone"
            name="buyerPhone"
            type="tel"
            inputMode="numeric"
            placeholder="98XXXXXXXX"
            {...phoneField}
            className={`${input} font-mono`}
          />
        </div>
        <fieldset>
          <legend className={label}>Pay with</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              ["esewa", "eSewa"],
              ["khalti", "Khalti"],
              ["fonepay", "Fonepay"],
            ].map(([v, l], i) => (
              <label key={v} className="relative">
                <input type="radio" name="provider" value={v} defaultChecked={i === 0} className="peer sr-only" />
                <span className="flex h-12 items-center justify-center rounded-[2px] border border-mist font-semibold peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink">
                  {l}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="border-t border-mist pt-6">
        <p role="alert" className="min-h-5 text-[14px] text-error-light">
          {state.status === "error" ? state.message : ""}
        </p>
        <button type="submit" className="btn btn-volt mt-2 w-full" disabled={pending || !amount} aria-busy={pending}>
          Send gift card{amount ? ` · ${formatPrice(amount)}` : ""}
        </button>
        <p className="mt-3 text-center text-[13px] text-steel-dark">Valid 12 months. Any unused balance stays on the card.</p>
      </section>
    </form>
  );
}
