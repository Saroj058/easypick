"use client";

import { useActionState, useState } from "react";

import { buyGiftCard, type GiftState } from "@/app/gift-actions";
import { formatPrice, normaliseNepaliMobile } from "@/lib/format";
import { kathmanduToday } from "@/lib/kathmandu-date";
import { GiftCardPicture, PRINTED_CARDS } from "./gift-card-art";
import { useMe, usePrefilled } from "./session";
import { PayWith } from "./pay-with";

const VALUES = PRINTED_CARDS;
const MIN = 1000;
const MAX = 100000;
const STEP = 100;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const input = "mt-2 h-14 w-full rounded-[2px] border border-steel-dark bg-paper px-4 text-base aria-[invalid=true]:border-error-light";
const label = "block text-sm font-semibold";
const chip = (on: boolean) => `h-14 rounded-[2px] border font-semibold ${on ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`;

/** Checked when the field loses focus, so a slip shows up before Pay, not after. */
function useFieldCheck(test: (v: string) => string | null) {
  const [error, setError] = useState<string | null>(null);
  return {
    error,
    props: {
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => setError(test(e.target.value.trim())),
      onInput: () => setError(null),
      "aria-invalid": error ? true : undefined,
    },
  };
}
const emailCheck = (v: string) => (v && !EMAIL.test(v) ? "Check the email, like name@example.com." : null);
const phoneCheck = (v: string) => (v && !normaliseNepaliMobile(v) ? "10 digits, starting 97 or 98." : null);

/** Buy a gift card: amount (each has its own printed card), who it's for, message and date, with a live preview. */
export function GiftCardForm({ initialValue = 2000, initialForMe = false, inSheet = false }: { /** Opens on "Myself". */ initialForMe?: boolean; /** The card it opens on. */ initialValue?: number | "custom"; /** Shown in the sheet over the Gift page, not on a page of its own. */ inSheet?: boolean }) {
  const me = useMe();
  const senderField = usePrefilled(me?.name);
  const phoneField = usePrefilled(me?.phone);
  const [state, action, pending] = useActionState<GiftState, FormData>(buyGiftCard, { status: "idle" });
  const [value, setValue] = useState<number | "custom">(initialValue);
  const [flipped, setFlipped] = useState(false);
  const [custom, setCustom] = useState("");
  const [forMe, setForMe] = useState(initialForMe);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  // In the sheet the card and who it's for were chosen before it opened, so the form doesn't ask again.
  const fixedAmount = inSheet && initialValue !== "custom";
  const step = (n: number) => n - (fixedAmount ? 1 : 0);
  const customN = Number(custom) || 0;
  const customOk = customN >= MIN && customN <= MAX && customN % STEP === 0;
  const amount = value === "custom" ? (customOk ? customN : 0) : value;
  const from = anonymous ? null : senderField.value;
  const today = kathmanduToday(); // the shop's calendar day, wherever the buyer is
  const email = useFieldCheck(emailCheck);
  const rphone = useFieldCheck(phoneCheck);
  const bphone = useFieldCheck(phoneCheck);

  return (
    <form action={action} className={`grid gap-10 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-12 lg:pb-0 ${inSheet ? "pb-0" : "pb-24"}`} noValidate>
      <div className="space-y-12">
        <input type="hidden" name="design" value="pick" />
        {fixedAmount && <input type="hidden" name="value" value={value === "custom" ? "" : value} />}
        <section hidden={fixedAmount} className="space-y-3" aria-labelledby="gc-amount-h">
          <h2 id="gc-amount-h" className="text-xl font-semibold">
            1. {inSheet ? "Your amount" : "Choose an amount"}
          </h2>
          {!fixedAmount && <input type="hidden" name="value" value={value === "custom" ? "" : value} />}
          <p className="font-mono text-[40px] font-semibold leading-none md:text-[48px]" aria-live="polite">
            {amount ? formatPrice(amount) : <span className="text-steel">Rs –</span>}
          </p>
          <div hidden={inSheet} className={inSheet ? undefined : "grid grid-cols-3 gap-2"} role="radiogroup" aria-labelledby="gc-amount-h">
            {VALUES.map((v) => (
              <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => setValue(v)} className={`${chip(value === v)} font-mono`}>
                {formatPrice(v)}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={value === "custom"} onClick={() => setValue("custom")} className={chip(value === "custom")}>
              Custom
            </button>
          </div>
          {value === "custom" && (
            <div>
              <label htmlFor="gc-custom" className={label}>
                Amount in rupees <span className="font-normal text-steel-dark">(1,000 to 1,00,000, in hundreds)</span>
              </label>
              <input
                id="gc-custom"
                name="custom"
                inputMode="numeric"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 6))}
                aria-invalid={custom !== "" && !customOk}
                aria-describedby="gc-custom-hint"
                className={`${input} font-mono`}
              />
              <p id="gc-custom-hint" className={`mt-1 text-[13px] ${custom !== "" && !customOk ? "text-error-light" : "text-steel-dark"}`}>
                {custom !== "" && !customOk ? "Use a whole number of hundreds, from Rs 1,000 to Rs 1,00,000." : "For example 2,500 or 7,000."}
              </p>
            </div>
          )}
        </section>

        <section className="space-y-4" aria-labelledby="gc-to-h">
          <h2 id="gc-to-h" className="text-xl font-semibold">
            {step(2)}. {inSheet ? (forMe ? "Your details" : "Who it's for") : "Send to"}
          </h2>
          <div hidden={inSheet} className={inSheet ? undefined : "grid grid-cols-2 gap-2"} role="radiogroup" aria-labelledby="gc-to-h">
            <button type="button" role="radio" aria-checked={!forMe} onClick={() => setForMe(false)} className={chip(!forMe)}>
              Someone else
            </button>
            <button type="button" role="radio" aria-checked={forMe} onClick={() => setForMe(true)} className={chip(forMe)}>
              Myself
            </button>
          </div>
          <div>
            <label htmlFor="gc-rname" className={label}>
              {forMe ? "Your name" : "Their name"}
            </label>
            <input id="gc-rname" name="receiverName" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={input} />
          </div>
          <div>
            <label htmlFor="gc-remail" className={label}>
              {forMe ? "Your email" : "Their email"}
            </label>
            <input id="gc-remail" name="receiverEmail" type="email" inputMode="email" autoComplete={forMe ? "email" : "off"} placeholder="name@example.com" aria-describedby="gc-remail-hint" {...email.props} className={input} />
            <p id="gc-remail-hint" className={`mt-1 text-[13px] ${email.error ? "text-error-light" : "text-steel-dark"}`}>
              {email.error ?? "The card and its code arrive by email."}
            </p>
          </div>
          <div>
            <label htmlFor="gc-rphone" className={label}>
              {forMe ? "Your mobile number" : "Their mobile number"} <span className="font-normal text-steel-dark">(optional)</span>
            </label>
            <input id="gc-rphone" name="receiverPhone" type="tel" inputMode="numeric" placeholder="98XXXXXXXX" aria-describedby="gc-rphone-hint" {...rphone.props} className={`${input} font-mono`} />
            <p id="gc-rphone-hint" className={`mt-1 text-[13px] ${rphone.error ? "text-error-light" : "text-steel-dark"}`}>
              {rphone.error ?? "We text the code too."}
            </p>
          </div>
        </section>

        {!forMe && (
          <section className="space-y-4" aria-labelledby="gc-msg-h">
            <h2 id="gc-msg-h" className="text-xl font-semibold">
              {step(3)}. Message and date
            </h2>
            <div>
              <label htmlFor="gc-message" className={label}>
                Message <span className="font-normal text-steel-dark">(optional, up to 200 characters)</span>
              </label>
              <textarea
                id="gc-message"
                name="message"
                rows={3}
                maxLength={200}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-2 w-full rounded-[2px] border border-steel-dark bg-paper p-4 text-base"
              />
            </div>
            {!anonymous && (
              <div>
                <label htmlFor="gc-sender" className={label}>
                  From
                </label>
                <input id="gc-sender" name="senderName" {...senderField} maxLength={40} className={input} />
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
        )}

        <section className="space-y-4" aria-labelledby="gc-pay-h">
          <h2 id="gc-pay-h" className="text-xl font-semibold">
            {step(forMe ? 3 : 4)}. Pay
          </h2>
          <div>
            <label htmlFor="gc-bphone" className={label}>
              Your mobile number <span className="font-normal text-steel-dark">(for the receipt)</span>
            </label>
            <input id="gc-bphone" name="buyerPhone" type="tel" inputMode="numeric" placeholder="98XXXXXXXX" {...phoneField} {...bphone.props} aria-describedby="gc-bphone-hint" className={`${input} font-mono`} />
            {bphone.error && (
              <p id="gc-bphone-hint" className="mt-1 text-[13px] text-error-light">
                {bphone.error}
              </p>
            )}
          </div>
          <fieldset>
            <legend className={label}>Pay with</legend>
            <PayWith className="mt-2" />
          </fieldset>
          <p role="alert" className="min-h-5 text-[14px] text-error-light">
            {state.status === "error" ? state.message : ""}
          </p>
          <button type="submit" className="btn btn-volt w-full" disabled={pending || !amount} aria-busy={pending}>
            {pending ? "One moment…" : `Buy gift card${amount ? ` · ${formatPrice(amount)}` : ""}`}
          </button>
          <p className="text-center text-[13px] text-steel-dark">Valid 12 months. Any unused balance stays on the card.</p>
        </section>
      </div>

      {/* Live preview: what arrives in their inbox. First on phones, so the card is built in view. */}
      <aside className={`order-first lg:sticky lg:order-none lg:self-start ${inSheet ? "lg:top-0" : "lg:top-28"}`} aria-label="Preview">
        <p className="index text-steel-dark">Preview</p>
        <div className="mx-auto mt-3 max-w-[340px] lg:max-w-none">
          {/* Both faces, back to back: "See the back" turns the card over. */}
          <div className="[perspective:1400px]">
            <div className={`relative transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`} data-flipped={flipped}>
              <div className="[backface-visibility:hidden]" aria-hidden={flipped}>
                <GiftCardPicture amount={amount || null} priority />
              </div>
              <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]" aria-hidden={!flipped}>
                <GiftCardPicture amount={null} side="back" fill />
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 flex flex-wrap items-center justify-between gap-x-4 text-[13px] text-steel-dark">
          <span>Picture for illustration. Your card is valid for 12 months from purchase.</span>
          <button type="button" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped} className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-2">
            {flipped ? "See the front" : "See the back"}
          </button>
        </p>
        <div className="mt-5 hidden bg-photo p-5 text-[15px] lg:block">
          <p className="font-semibold">{forMe ? `For you${name ? `, ${name.split(" ")[0]}` : ""}` : name ? `For ${name}` : "For them"}</p>
          {!forMe && message && <p className="mt-2 whitespace-pre-line">&ldquo;{message}&rdquo;</p>}
          {!forMe && <p className="mt-2 text-[13px] text-steel-dark">From {from || "someone who thinks of you"}</p>}
          <p className="mt-3 font-mono text-[13px] text-steel-dark">EP-XXXX-XXXX · used online and in store</p>
        </div>
      </aside>

      {/* Phones: the card and the Pay button stay in view while the form scrolls. */}
      <div className={`z-30 border-t border-mist bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden ${inSheet ? "sticky bottom-0 -mx-4" : "fixed inset-x-0 bottom-0"}`}>
        {state.status === "error" && (
          <p className="mb-2 text-[13px] text-error-light" aria-hidden>
            {state.message}
          </p>
        )}
        <div className="flex items-center gap-3">
          <div className="w-14 shrink-0" aria-hidden>
            <GiftCardPicture amount={amount || null} className="shadow-none" />
          </div>
          <button type="submit" className="btn btn-volt flex-1" disabled={pending || !amount} aria-busy={pending}>
            {pending ? "One moment…" : amount ? `Pay ${formatPrice(amount)}` : "Choose an amount"}
          </button>
        </div>
      </div>
    </form>
  );
}
