"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { placeGiftOrder, type GiftState } from "@/app/gift-actions";
import { formatPrice, normaliseNepaliMobile } from "@/lib/format";
import { kathmanduToday } from "@/lib/kathmandu-date";
import { formatBS } from "@/lib/nepali-date";
import { site } from "@/lib/site";
import type { Product, Size } from "@/lib/types";
import { GiftNote } from "./gift/gift-box";
import { useMe, usePrefilled } from "./session";
import { PayWith } from "./pay-with";

// scroll-mb: a focused field clears the pay bar that sticks to the bottom on phones.
const input = "mt-2 h-14 w-full scroll-mb-36 rounded-[2px] border border-steel-dark bg-paper px-4 text-base aria-[invalid=true]:border-2 aria-[invalid=true]:border-error-light";
const label = "block text-sm font-semibold";
const STEPS = ["The piece", "Your note", "Send and pay"] as const;
/** One tap fills the note; every line can be edited after. */
const NOTES = [
  ["Birthday", "Happy birthday. Saw this and thought of you."],
  ["Dashain", "दशैंको शुभकामना। Something new for Tika day."],
  ["Bhai Tika", "भाइटीकाको शुभकामना। Wear it well."],
  ["Just because", "No occasion. It just looked like you."],
  ["Congratulations", "Congratulations. You earned this one."],
  ["Thank you", "Thank you for everything. This one is on me."],
] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Common slips after the @, for a "Did you mean …?" hint. */
const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "outlok.com": "outlook.com",
};
function emailTypo(v: string): string | null {
  const [user, domain] = v.trim().toLowerCase().split("@");
  return user && domain && TYPOS[domain] ? `${user}@${TYPOS[domain]}` : null;
}

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
/** "Sat 11 Oct (Asoj 25)" */
const niceDay = (ymd: string) => `${dayFmt.format(new Date(`${ymd}T12:00:00Z`))} (${formatBS(new Date(`${ymd}T12:00:00+05:45`))})`;

/** The festival coming up, worked out on the server (lib/festival.ts). */
export type GiftFestival = { name: string; open: boolean; dateText: string; orderByText: string } | null;

function Choice({ name, value, checked, onChange, title, note }: { name: string; value: string; checked: boolean; onChange: () => void; title: string; note?: string }) {
  return (
    <label className="relative block">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="flex min-h-[64px] flex-col justify-center rounded-[2px] border border-steel px-4 py-3 pr-10 transition-transform duration-150 active:scale-[0.98] peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
        <span className="font-semibold">{title}</span>
        {note && <span className="text-[13px] text-steel-dark">{note}</span>}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 grid h-5 w-5 scale-50 place-items-center rounded-full bg-ink text-paper opacity-0 transition-[opacity,scale] duration-200 peer-checked:scale-100 peer-checked:opacity-100" aria-hidden>
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2.5 6.2l2.3 2.3 4.7-5" />
        </svg>
      </span>
    </label>
  );
}

/** The printed card that goes in the box, as they'll see it. */
function MessageCard({
  to,
  from,
  message,
  wrap,
  price,
}: {
  to: string;
  from: string | null;
  message: string;
  wrap: "standard" | "premium";
  /** Shown on the gift receipt only when the buyer chose to show it. */
  price: string | null;
}) {
  return (
    <figure aria-label="Preview of the gift card" className={`p-5 transition-colors duration-200 ${wrap === "premium" ? "bg-ink [--hole:var(--color-ink)]" : "bg-photo [--hole:var(--color-photo)]"}`}>
      <GiftNote key={wrap} to={to} from={from} message={message} placeholder="Your note appears here." />
      <figcaption className={`mt-3 text-center text-[12px] ${wrap === "premium" ? "text-paper/70" : "text-steel-dark"}`}>
        {wrap === "premium" ? "In the premium black box" : "In an Easypick bag with tissue"} · {price ? `gift receipt shows ${price}` : "no price inside"}
      </figcaption>
    </figure>
  );
}

/** Send one piece as a gift in three short steps. "Let them pick the size" is the default. */
export function GiftForm({ product, festival = null, initial }: { product: Product; festival?: GiftFestival; initial?: { colour?: string; size?: string } }) {
  const me = useMe();
  const phoneField = usePrefilled(me?.phone);
  const [state, action, pending] = useActionState<GiftState, FormData>(placeGiftOrder, { status: "idle" });
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState("");
  const [hintField, setHintField] = useState<string | null>(null);
  /** Show what's missing, and put the cursor in that field. */
  const fail = (text: string, field?: string) => {
    setHint(text);
    setHintField(field ?? null);
    if (field) requestAnimationFrame(() => document.getElementById(field)?.focus());
  };
  const invalid = (id: string) => (hintField === id ? { "aria-invalid": true, "aria-describedby": "g-hint" } : {});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buyerPhoneRef = useRef<HTMLInputElement>(null);

  const oneSize = product.variants.every((v) => v.size === "ONE");
  const startColour = product.colours.find((c) => c.name === initial?.colour)?.name ?? product.colours[0].name;
  const startSize = product.variants.find((v) => v.colour === startColour && v.size === initial?.size && v.size !== "ONE" && v.stock - (v.lastPieceOnFloor ? 1 : 0) > 0)?.size ?? null;
  const [mode, setMode] = useState<"pick" | "set">(oneSize || startSize ? "set" : "pick");
  const [colour, setColour] = useState(startColour);
  const [size, setSize] = useState<Size | null>(oneSize ? "ONE" : startSize);
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [wrap, setWrap] = useState<"standard" | "premium">("standard");
  // The price shows unless the gifter ticks "Hide the price".
  const [showPrice, setShowPrice] = useState(true);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [method, setMethod] = useState<"delivery" | "pickup">("delivery");
  const [area, setArea] = useState("");
  const [landmark, setLandmark] = useState("");
  const [deliverOn, setDeliverOn] = useState("");

  const senderName = anonymous ? null : (sender ?? me?.name ?? "").trim() || null;
  const price = product.salePrice ?? product.price;
  const sizes = product.variants.filter((v) => v.colour === colour && v.size !== "ONE");
  const deliveryFee = (mode === "set" && method === "pickup") || price >= site.delivery.freeAbove ? 0 : site.delivery.flatFee;
  const wrapFee = wrap === "premium" ? site.gifting.premiumWrapFee : 0;
  const total = price + deliveryFee + wrapFee;
  const today = kathmanduToday(); // the shop's calendar day, wherever the buyer is
  const typo = emailTypo(receiverEmail);
  const near = site.gifting.messageMax - message.length <= 20;

  // Move focus to the step heading so keyboard and screen-reader users land in the right place.
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
    moved.current = true;
  }, [step]);

  function next() {
    setHint("");
    setHintField(null);
    if (step === 0 && mode === "set" && !size) return fail("Pick their size, or let them pick.");
    if (step === 1 && !receiverName.trim()) return fail("Add their name, so the card is for them.", "g-rname");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  /** The last step is checked here, before eSewa, so nothing comes back from the server as a surprise. */
  function check(e: React.FormEvent<HTMLFormElement>) {
    if (step < STEPS.length - 1) {
      e.preventDefault(); // Enter in a field on an earlier step means "Continue"
      return next();
    }
    setHint("");
    setHintField(null);
    const stop = (text: string, field?: string) => {
      e.preventDefault();
      fail(text, field);
    };
    if (deliverOn && (deliverOn < today || deliverOn > addDays(today, 60))) return stop("Pick a date in the next 60 days, or leave it empty.", "g-date");
    if (!EMAIL.test(receiverEmail.trim())) return stop("Add their email address so we can send them the gift link.", "g-remail");
    if (receiverPhone.trim() && !normaliseNepaliMobile(receiverPhone)) return stop("Their mobile number should be 10 digits, like 98XXXXXXXX, or leave it empty.", "g-rphone");
    if (mode === "set" && method === "delivery" && !normaliseNepaliMobile(receiverPhone)) return stop("Add their mobile number so the rider can reach them.", "g-rphone");
    if (mode === "set" && method === "delivery" && (!area.trim() || !landmark.trim())) return stop("Add their area and a nearby landmark.", area.trim() ? "g-landmark" : "g-area");
    if (!normaliseNepaliMobile(buyerPhoneRef.current?.value ?? "")) return stop("Add your own mobile number (10 digits, like 98XXXXXXXX) for updates.", "g-bphone");
  }

  return (
    <form action={action} onSubmit={check} noValidate>
      {/* Every field stays in the form; only the current step is shown. */}
      <input type="hidden" name="slug" value={product.slug} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="wrap" value={wrap} />
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="colour" value={colour} />
      <input type="hidden" name="size" value={size ?? ""} />
      <input type="hidden" name="showPrice" value={showPrice ? "on" : ""} />

      <div className="mb-8">
        <ol className="grid grid-cols-3 gap-1" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s}>
              {/* Finished steps can be opened again; later ones can't be skipped to. */}
              <button
                type="button"
                disabled={i >= step}
                onClick={() => {
                  setHint("");
                  setHintField(null);
                  setStep(i);
                }}
                aria-current={i === step ? "step" : undefined}
                className={`block min-h-11 w-full border-t-4 pt-2 text-left text-[13px] font-semibold disabled:cursor-default ${i <= step ? "border-ink" : "border-mist text-steel-dark"} ${i < step ? "hover:underline" : ""}`}
              >
                <span className="font-mono">{i + 1}</span> {s}
              </button>
            </li>
          ))}
        </ol>
        <h2 ref={headingRef} tabIndex={-1} className="display mt-5 text-[32px] leading-none outline-none">
          {STEPS[step]}
        </h2>
      </div>

      {/* 1. The piece */}
      <section hidden={step !== 0} className="space-y-8">
        {oneSize && product.colours.length < 2 && <p className="text-[15px] text-steel-dark">One size, one colour. Nothing to choose here.</p>}
        {!oneSize && (
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Who picks the size</legend>
            <Choice name="modeUi" value="pick" checked={mode === "pick"} onChange={() => setMode("pick")} title="Let them pick the size" note="They choose from a link, or try it on in our store." />
            <Choice name="modeUi" value="set" checked={mode === "set"} onChange={() => setMode("set")} title="I know their size" note="We wrap it and deliver it, or you collect it." />
          </fieldset>
        )}
        {product.colours.length > 1 && (
          <fieldset>
            <legend className={label}>Colour · {colour}</legend>
            <div className="mt-3 flex gap-3">
              {product.colours.map((c) => (
                <label key={c.name} className="relative">
                  <input
                    type="radio"
                    name="colourUi"
                    checked={colour === c.name}
                    onChange={() => {
                      setColour(c.name);
                      if (!oneSize) setSize(null);
                    }}
                    className="peer sr-only"
                  />
                  <span className="block h-11 w-11 rounded-full border border-steel ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink" style={{ background: c.hex }} />
                  <span className="sr-only">{c.name}</span>
                </label>
              ))}
            </div>
            {mode === "pick" && (
              <label className="mt-4 flex min-h-11 items-center gap-3 text-[15px]">
                <input type="checkbox" name="colourChoice" className="h-5 w-5 accent-ink" />
                Let them change the colour too
              </label>
            )}
          </fieldset>
        )}
        {mode === "set" && !oneSize && (
          <fieldset>
            <legend className={label}>Their size</legend>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {sizes.map((v) => {
                const out = v.stock - (v.lastPieceOnFloor ? 1 : 0) <= 0;
                return (
                  <label key={v.sku} className="relative">
                    <input type="radio" name="sizeUi" checked={size === v.size} disabled={out} onChange={() => setSize(v.size)} className="peer sr-only" />
                    <span
                      className={`flex h-14 items-center justify-center rounded-[2px] border font-mono font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ink ${
                        out ? "border-mist text-steel-dark line-through" : "border-steel"
                      }`}
                    >
                      {v.size}
                      {out && <span className="sr-only"> (sold out)</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-3 text-[13px] text-steel-dark">
              Between sizes, or theirs is sold out?{" "}
              <button type="button" onClick={() => setMode("pick")} className="font-semibold text-ink underline underline-offset-2">
                Let them pick instead
              </button>
            </p>
          </fieldset>
        )}
        {mode === "pick" && (
          <ol className="space-y-2 border-y border-dashed border-ink/30 py-4 font-mono text-[13px]" aria-label="How they choose">
            {[
              ["01", "We email them a private link"],
              ["02", "They pick the size, online or in store"],
              ["03", "We hold one for them until they do"],
            ].map(([n, t]) => (
              <li key={n} className="flex gap-3">
                <span className="text-steel-dark">{n}</span>
                <span className="font-sans text-[15px]">{t}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 2. Your note */}
      <section hidden={step !== 1} className="space-y-6">
        <div>
          <label htmlFor="g-rname" className={label}>
            Their name
          </label>
          <input id="g-rname" {...invalid("g-rname")} aria-required name="receiverName" autoComplete="off" autoCapitalize="words" enterKeyHint="next" maxLength={60} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="g-message" className={label}>
            Message <span className="font-normal text-steel-dark">(optional)</span>
          </label>
          <textarea
            id="g-message"
            name="message"
            rows={3}
            maxLength={site.gifting.messageMax}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Saw this and thought of you."
            aria-describedby="g-message-count"
            className="mt-2 w-full rounded-[2px] border border-steel-dark bg-paper p-4 text-base"
          />
          <p id="g-message-count" className={`mt-1 text-right text-[13px] ${near ? "font-semibold text-[#7a3e00]" : "text-steel-dark"}`} aria-live={near ? "polite" : "off"}>
            {near ? `${site.gifting.messageMax - message.length} characters left` : `${message.length}/${site.gifting.messageMax}`}
          </p>
          {/* Stuck for words: one tap writes a line to start from. */}
          <div className="-mx-4 mt-1 flex scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Note ideas">
            {NOTES.map(([name, words]) => (
              <button key={name} type="button" onClick={() => setMessage(words)} className="inline-flex h-11 shrink-0 items-center rounded-full border border-steel px-4 text-[14px] font-semibold transition-[border-color,scale] duration-150 hover:border-ink active:scale-[0.97]">
                {name}
              </button>
            ))}
          </div>
        </div>
        {!anonymous && (
          <div>
            <label htmlFor="g-sender" className={label}>
              From
            </label>
            <input id="g-sender" name="senderName" autoComplete="given-name" autoCapitalize="words" enterKeyHint="next" maxLength={40} value={sender ?? me?.name ?? ""} onChange={(e) => setSender(e.target.value)} className={input} />
          </div>
        )}
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="anonymous" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-5 w-5 accent-ink" />
          Send it anonymously
        </label>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Wrapping</legend>
          <Choice name="wrapUi" value="standard" checked={wrap === "standard"} onChange={() => setWrap("standard")} title="Easypick bag" note="Tissue and a printed card. Free." />
          <Choice name="wrapUi" value="premium" checked={wrap === "premium"} onChange={() => setWrap("premium")} title="Premium black box" note={`Sealed box and card. ${formatPrice(site.gifting.premiumWrapFee)}.`} />
        </fieldset>
        {/* Price visibility: shown by default; ticked = they never see what it cost. */}
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px]">
          <input type="checkbox" checked={!showPrice} onChange={(e) => setShowPrice(!e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
          <span>
            Hide the price from them <span className="text-steel-dark">(their card and receipt won&apos;t show what it cost)</span>
          </span>
        </label>
        <MessageCard to={receiverName} from={senderName} message={message} wrap={wrap} price={showPrice ? formatPrice(price) : null} />
      </section>

      {/* 3. Send and pay */}
      <section hidden={step !== 2} className="space-y-6">
        <div>
          <label htmlFor="g-remail" className={label}>
            {receiverName.trim() ? `${receiverName.trim().split(" ")[0]}'s email` : "Their email"}
          </label>
          <input
            id="g-remail"
            {...invalid("g-remail")}
            aria-required
            name="receiverEmail"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@example.com"
            value={receiverEmail}
            onChange={(e) => setReceiverEmail(e.target.value)}
            className={input}
          />
          {typo ? (
            <p className="mt-1 text-[14px]">
              Did you mean{" "}
              <button type="button" onClick={() => setReceiverEmail(typo)} className="font-semibold underline underline-offset-2">
                {typo}
              </button>
              ?
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-steel-dark">
              {mode === "pick" ? "We email them a private link to open the gift and pick their size." : "We email them a link to see their gift."}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="g-rphone" className={label}>
            Their mobile number{" "}
            <span className="font-normal text-steel-dark">{mode === "set" && method === "delivery" ? "(for the rider)" : "(optional)"}</span>
          </label>
          <input
            id="g-rphone"
            {...invalid("g-rphone")}
            name="receiverPhone"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            placeholder="98XXXXXXXX"
            value={receiverPhone}
            onChange={(e) => setReceiverPhone(e.target.value)}
            className={`${input} font-mono`}
          />
          <p className="mt-1 text-[13px] text-steel-dark">Add it and we text them the link too.</p>
        </div>
        {mode === "set" && (
          <>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Delivery or pickup</legend>
              <Choice name="methodUi" value="delivery" checked={method === "delivery"} onChange={() => setMethod("delivery")} title="Deliver to them" note="Kathmandu Valley" />
              <Choice name="methodUi" value="pickup" checked={method === "pickup"} onChange={() => setMethod("pickup")} title="I'll pick it up" note="Free, from the store" />
            </fieldset>
            {method === "delivery" && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="g-area" className={label}>
                    Their area
                  </label>
                  <input id="g-area" {...invalid("g-area")} aria-required autoComplete="off" name="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Baneshwor, Kathmandu" className={input} />
                </div>
                <div>
                  <label htmlFor="g-landmark" className={label}>
                    Nearby landmark
                  </label>
                  <input id="g-landmark" {...invalid("g-landmark")} aria-required autoComplete="off" name="landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} className={input} />
                </div>
                <div>
                  <label htmlFor="g-details" className={label}>
                    House or floor <span className="font-normal text-steel-dark">(optional)</span>
                  </label>
                  <input id="g-details" name="details" autoComplete="off" className={input} />
                </div>
              </div>
            )}
          </>
        )}
        <div>
          <label htmlFor="g-date" className={label}>
            {mode === "set" ? "Deliver on" : "Arrive by"} <span className="font-normal text-steel-dark">(optional)</span>
          </label>
          <input
            id="g-date"
            {...(hintField === "g-date" ? { "aria-invalid": true } : {})}
            name="deliverOn"
            type="date"
            min={today}
            max={addDays(today, 60)}
            value={deliverOn}
            onChange={(e) => setDeliverOn(e.target.value)}
            aria-describedby="g-date-hint"
            className={input}
          />
          <p id="g-date-hint" className="mt-1 text-[13px] text-steel-dark">
            {/^\d{4}-\d{2}-\d{2}$/.test(deliverOn) ? (
              <>
                <span className="font-semibold text-ink">{niceDay(deliverOn)}.</span>{" "}
                {mode === "set" ? "We send them the link that morning, so it stays a surprise until then." : "We send them the link now, so they can pick their size in time."}
              </>
            ) : mode === "set" ? (
              "Leave it empty and we send it as soon as it's packed."
            ) : (
              "Leave it empty and we send it as soon as they've picked their size."
            )}
          </p>
          {festival && (
            <p className="mt-2 flex gap-2 text-[13px]">
              <span className="mt-1 h-2 w-2 shrink-0 bg-volt ring-1 ring-ink" aria-hidden />
              <span>
                {festival.open ? (
                  <>
                    For {festival.name} ({festival.dateText}), order by <span className="font-semibold">{festival.orderByText}</span>.
                  </>
                ) : (
                  <>Delivery before {festival.name} has closed. Store pickup still works.</>
                )}
              </span>
            </p>
          )}
        </div>
        <div>
          <label htmlFor="g-bphone" className={label}>
            Your mobile number
          </label>
          <input
            id="g-bphone"
            ref={buyerPhoneRef}
            {...invalid("g-bphone")}
            aria-required
            name="buyerPhone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={14}
            placeholder="98XXXXXXXX"
            {...phoneField}
            className={`${input} font-mono`}
          />
          <p className="mt-1 text-[13px] text-steel-dark">We text you when they open it and pick their size.</p>
        </div>
        <div>
          <p className={label}>Pay with</p>
          <PayWith className="mt-2" />
        </div>

        <div className="border-t border-mist pt-6">
          <p className="text-[15px]">
            {product.name} · {colour} · {mode === "pick" ? "they pick the size" : size === "ONE" ? "one size" : `size ${size}`}
          </p>
          <p className="text-[15px] text-steel-dark">
            For {receiverName.trim() || "them"}
            {senderName ? `, from ${senderName}` : ", anonymously"} · {showPrice ? "price shown" : "price hidden"}
          </p>
          <dl className="mt-4 space-y-2 text-[15px]">
            <div className="flex justify-between">
              <dt>Piece</dt>
              <dd className="font-mono">{formatPrice(price)}</dd>
            </div>
            <div className="flex justify-between text-steel-dark">
              <dt>{mode === "set" && method === "pickup" ? "Store pickup" : "Delivery"}</dt>
              <dd className="font-mono">{deliveryFee ? formatPrice(deliveryFee) : "Free"}</dd>
            </div>
            {wrapFee > 0 && (
              <div className="flex justify-between text-steel-dark">
                <dt>Premium box</dt>
                <dd className="font-mono">{formatPrice(wrapFee)}</dd>
              </div>
            )}
            <div className="flex justify-between pt-2 text-xl font-semibold">
              <dt>Total</dt>
              <dd className="font-mono">{formatPrice(total)}</dd>
            </div>
          </dl>
          {mode === "pick" && deliveryFee > 0 && <p className="mt-2 text-[13px] text-steel-dark">If they choose store pickup, we refund the delivery fee.</p>}
        </div>
      </section>

      {/* Stays on screen on phones, with the total, so the next step is always one tap away. */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-2 border-t border-mist bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <p id="g-hint" role="alert" className="min-h-5 pb-2 text-[14px] text-error-light sm:mt-6">
          {hint || (state.status === "error" ? state.message : "")}
        </p>
        <p className={`mb-2 flex items-baseline justify-between text-[14px] sm:hidden ${step === STEPS.length - 1 ? "hidden" : ""}`}>
          <span className="text-steel-dark">Total</span>
          <span className="font-mono font-semibold">{formatPrice(total)}</span>
        </p>
        <div className="flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => {
                setHint("");
                setHintField(null);
                setStep((s) => s - 1);
              }}
              className="btn btn-outline flex-1"
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="btn btn-ink flex-[2]">
              Continue
            </button>
          ) : (
            <button type="submit" className="btn btn-volt relative flex-[2] overflow-hidden aria-busy:opacity-100" disabled={pending} aria-busy={pending}>
              {pending && <span className="visit-load absolute inset-x-0 bottom-0 h-0.5 bg-ink" aria-hidden />}
              {pending ? "One moment…" : `Pay ${formatPrice(total)}`}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
