"use client";

import { useActionState, useState } from "react";

import { buyGiftCard, type GiftState } from "@/app/gift-actions";
import { formatPrice } from "@/lib/format";
import { GIFT_CARD_DESIGNS, type GiftCardDesign } from "@/lib/gift-card-designs";
import { kathmanduToday } from "@/lib/kathmandu-date";
import { GiftCardArt } from "./gift-card-art";
import { useMe, usePrefilled } from "./session";
import { PayWith } from "./pay-with";

const VALUES = [1000, 2000, 3000, 5000];
const MIN = 1000;
const MAX = 20000;
const STEP = 100;
const input = "mt-2 h-14 w-full rounded-[2px] border border-steel-dark bg-paper px-4 text-base";
const label = "block text-sm font-semibold";
const chip = (on: boolean) => `h-14 rounded-[2px] border font-semibold ${on ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`;

/** Buy a gift card: design, amount, who it's for, message and date, with a live preview. */
export function GiftCardForm() {
  const me = useMe();
  const senderField = usePrefilled(me?.name);
  const phoneField = usePrefilled(me?.phone);
  const [state, action, pending] = useActionState<GiftState, FormData>(buyGiftCard, { status: "idle" });
  const [design, setDesign] = useState<GiftCardDesign>("pick");
  const [value, setValue] = useState<number | "custom">(2000);
  const [custom, setCustom] = useState("");
  const [forMe, setForMe] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const customN = Number(custom) || 0;
  const customOk = customN >= MIN && customN <= MAX && customN % STEP === 0;
  const amount = value === "custom" ? (customOk ? customN : 0) : value;
  const from = anonymous ? null : senderField.value;
  const today = kathmanduToday(); // the shop's calendar day, wherever the buyer is

  return (
    <form action={action} className="grid gap-12 lg:grid-cols-[1fr_minmax(0,420px)]" noValidate>
      <div className="space-y-12">
        <section className="space-y-3" aria-labelledby="gc-design-h">
          <h2 id="gc-design-h" className="text-xl font-semibold">
            1. Choose a design
          </h2>
          <input type="hidden" name="design" value={design} />
          <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-labelledby="gc-design-h">
            {GIFT_CARD_DESIGNS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={design === d.id}
                onClick={() => setDesign(d.id)}
                className={`rounded-[16px] p-1.5 text-left ${design === d.id ? "ring-2 ring-ink" : "ring-1 ring-mist hover:ring-ink"}`}
              >
                <GiftCardArt design={d.id} amount={null} className="pointer-events-none shadow-none" />
                <span className="mt-2 block px-1 text-[14px] font-semibold">{d.name}</span>
                <span className="block px-1 pb-1 text-[12px] text-steel-dark">{d.note}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="gc-amount-h">
          <h2 id="gc-amount-h" className="text-xl font-semibold">
            2. Choose an amount
          </h2>
          <input type="hidden" name="value" value={value === "custom" ? "" : value} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-labelledby="gc-amount-h">
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
                Amount in rupees <span className="font-normal text-steel-dark">(1,000 to 20,000, in hundreds)</span>
              </label>
              <input
                id="gc-custom"
                name="custom"
                inputMode="numeric"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 5))}
                aria-invalid={custom !== "" && !customOk}
                aria-describedby="gc-custom-hint"
                className={`${input} font-mono`}
              />
              <p id="gc-custom-hint" className={`mt-1 text-[13px] ${custom !== "" && !customOk ? "text-[#d70015]" : "text-steel-dark"}`}>
                {custom !== "" && !customOk ? "Use a whole number of hundreds, from Rs 1,000 to Rs 20,000." : "For example 2,500 or 7,000."}
              </p>
            </div>
          )}
        </section>

        <section className="space-y-4" aria-labelledby="gc-to-h">
          <h2 id="gc-to-h" className="text-xl font-semibold">
            3. Send to
          </h2>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="gc-to-h">
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
            <input id="gc-remail" name="receiverEmail" type="email" inputMode="email" autoComplete={forMe ? "email" : "off"} placeholder="name@example.com" className={input} />
            <p className="mt-1 text-[13px] text-steel-dark">The card and its code arrive by email.</p>
          </div>
          <div>
            <label htmlFor="gc-rphone" className={label}>
              {forMe ? "Your mobile number" : "Their mobile number"} <span className="font-normal text-steel-dark">(optional)</span>
            </label>
            <input id="gc-rphone" name="receiverPhone" type="tel" inputMode="numeric" placeholder="98XXXXXXXX" className={`${input} font-mono`} />
            <p className="mt-1 text-[13px] text-steel-dark">We text the code too.</p>
          </div>
        </section>

        {!forMe && (
          <section className="space-y-4" aria-labelledby="gc-msg-h">
            <h2 id="gc-msg-h" className="text-xl font-semibold">
              4. Message and date
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
            {forMe ? "4" : "5"}. Pay
          </h2>
          <div>
            <label htmlFor="gc-bphone" className={label}>
              Your mobile number <span className="font-normal text-steel-dark">(for the receipt)</span>
            </label>
            <input id="gc-bphone" name="buyerPhone" type="tel" inputMode="numeric" placeholder="98XXXXXXXX" {...phoneField} className={`${input} font-mono`} />
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

      {/* Live preview: what arrives in their inbox */}
      <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Preview">
        <p className="index text-steel-dark">Preview</p>
        <div className="mt-3">
          <GiftCardArt design={design} amount={amount || null} />
        </div>
        <div className="mt-5 bg-photo p-5 text-[15px]">
          <p className="font-semibold">{forMe ? `For you${name ? `, ${name.split(" ")[0]}` : ""}` : name ? `For ${name}` : "For them"}</p>
          {!forMe && message && <p className="mt-2 whitespace-pre-line">&ldquo;{message}&rdquo;</p>}
          {!forMe && <p className="mt-2 text-[13px] text-steel-dark">From {from || "someone who thinks of you"}</p>}
          <p className="mt-3 font-mono text-[13px] text-steel-dark">EP-XXXX-XXXX · used online and in store</p>
        </div>
      </aside>
    </form>
  );
}
