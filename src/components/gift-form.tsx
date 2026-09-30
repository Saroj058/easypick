"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { placeGiftOrder, type GiftState } from "@/app/gift-actions";
import { formatPrice, normaliseNepaliMobile } from "@/lib/format";
import { kathmanduToday } from "@/lib/kathmandu-date";
import { formatBS } from "@/lib/nepali-date";
import { site } from "@/lib/site";
import type { Product, Size } from "@/lib/types";
import { useMe, usePrefilled } from "./session";
import { PayWith } from "./pay-with";

const input = "mt-2 h-14 w-full rounded-[2px] border border-steel-dark bg-paper px-4 text-base";
const label = "block text-sm font-semibold";
const STEPS = ["The piece", "Your note", "Send and pay"] as const;
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
      <span className="flex min-h-[64px] flex-col justify-center rounded-[2px] border border-mist px-4 py-3 peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
        <span className="font-semibold">{title}</span>
        {note && <span className="text-[13px] text-steel-dark">{note}</span>}
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
    <figure aria-label="Preview of the gift card" className={`p-5 ${wrap === "premium" ? "bg-ink" : "bg-photo"}`}>
      <div className="mx-auto max-w-sm bg-paper px-6 py-7 text-center text-ink shadow-[0_1px_0_rgba(0,0,0,0.08)]">
        <p className="text-[13px] text-steel-dark">For {to.trim() || "them"}</p>
        <p className="mt-3 min-h-[3.5rem] text-lg leading-relaxed">{message.trim() ? `“${message.trim()}”` : <span className="text-steel">Your message appears here.</span>}</p>
        <p className="mt-3 text-[13px] text-steel-dark">{from ? `From ${from}` : "From someone who thinks of you"}</p>
      </div>
      <figcaption className={`mt-3 text-center text-[12px] ${wrap === "premium" ? "text-paper/70" : "text-steel-dark"}`}>
        {wrap === "premium" ? "In the premium black box" : "In an Easypick bag with tissue"} · {price ? `gift receipt shows ${price}` : "no price inside"}
      </figcaption>
    </figure>
  );
}

/** Send one piece as a gift in three short steps. "Let them pick the size" is the default. */
export function GiftForm({ product, festival = null }: { product: Product; festival?: GiftFestival }) {
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
  const [mode, setMode] = useState<"pick" | "set">(oneSize ? "set" : "pick");
  const [colour, setColour] = useState(product.colours[0].name);
  const [size, setSize] = useState<Size | null>(oneSize ? "ONE" : null);
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
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={`block min-h-11 w-full border-t-4 pt-2 text-left text-[13px] font-semibold disabled:cursor-default ${i <= step ? "border-ink" : "border-mist text-steel-dark"} ${i < step ? "hover:underline" : ""}`}
              >
                <span className="font-mono">{i + 1}</span> {s}
              </button>
            </li>
          ))}
        </ol>
        <h2 ref={headingRef} tabIndex={-1} className="mt-5 text-2xl font-semibold outline-none">
          {STEPS[step]}
        </h2>
      </div>

      {/* 1. The piece */}
      <section hidden={step !== 0} className="space-y-8">
        {!oneSize && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice name="modeUi" value="pick" checked={mode === "pick"} onChange={() => setMode("pick")} title="Let them pick the size" note="Recommended. They choose before we send it." />
            <Choice name="modeUi" value="set" checked={mode === "set"} onChange={() => setMode("set")} title="I know their size" note="We pack it and send it." />
          </div>
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
                  <span className="block h-11 w-11 rounded-full border border-black/10 ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink" style={{ background: c.hex }} />
                  <span className="sr-only">{c.name}</span>
                </label>
              ))}
            </div>
            {mode === "pick" && (
              <label className="mt-4 flex min-h-11 items-center gap-3 text-[15px]">
                <input type="checkbox" name="colourChoice" className="h-5 w-5 accent-[#c6ff3d]" />
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
                        out ? "border-mist text-steel line-through" : "border-mist"
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
          <div className="bg-photo p-5">
            <p className="font-semibold">How they choose</p>
            <ol className="mt-3 space-y-3 text-[15px]">
              <li>
                <span className="font-semibold">1. We email them a private link.</span>{" "}
                <span className="text-steel-dark">It opens on their phone or laptop. No app, no account. We text it too if you add their number.</span>
              </li>
              <li>
                <span className="font-semibold">2. They pick online, or try it on in the store.</span>{" "}
                <span className="text-steel-dark">
                  Online: they tap their size{product.colours.length > 1 ? " (and colour, if you allow it)" : ""}, then delivery or pickup. In store: they show
                  their gift code at the counter and try the sizes on.
                </span>
              </li>
              <li>
                <span className="font-semibold">3. We hold one for them meanwhile.</span>{" "}
                <span className="text-steel-dark">So it can&apos;t sell out before they choose.</span>
              </li>
            </ol>
          </div>
        )}
      </section>

      {/* 2. Your note */}
      <section hidden={step !== 1} className="space-y-6">
        <div>
          <label htmlFor="g-rname" className={label}>
            Their name
          </label>
          <input id="g-rname" {...invalid("g-rname")} name="receiverName" autoComplete="off" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className={input} />
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
            placeholder="Happy Dashain! Thought this was very you."
            aria-describedby="g-message-count"
            className="mt-2 w-full rounded-[2px] border border-steel-dark bg-paper p-4 text-base"
          />
          <p id="g-message-count" className={`mt-1 text-right text-[13px] ${near ? "font-semibold text-[#7a3e00]" : "text-steel-dark"}`} aria-live={near ? "polite" : "off"}>
            {near ? `${site.gifting.messageMax - message.length} characters left` : `${message.length}/${site.gifting.messageMax}`}
          </p>
        </div>
        {!anonymous && (
          <div>
            <label htmlFor="g-sender" className={label}>
              From
            </label>
            <input id="g-sender" name="senderName" autoComplete="given-name" value={sender ?? me?.name ?? ""} onChange={(e) => setSender(e.target.value)} className={input} />
          </div>
        )}
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="anonymous" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-5 w-5 accent-[#c6ff3d]" />
          Send it anonymously
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice name="wrapUi" value="standard" checked={wrap === "standard"} onChange={() => setWrap("standard")} title="Easypick bag" note="Tissue and a printed card. Free." />
          <Choice name="wrapUi" value="premium" checked={wrap === "premium"} onChange={() => setWrap("premium")} title="Premium black box" note={`Sealed box and card. ${formatPrice(site.gifting.premiumWrapFee)}.`} />
        </div>
        {/* Price visibility: shown by default; ticked = they never see what it cost. */}
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px]">
          <input type="checkbox" checked={!showPrice} onChange={(e) => setShowPrice(!e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#0a0a0a]" />
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
            name="receiverEmail"
            type="email"
            inputMode="email"
            autoComplete="off"
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
            placeholder="98XXXXXXXX"
            value={receiverPhone}
            onChange={(e) => setReceiverPhone(e.target.value)}
            className={`${input} font-mono`}
          />
          <p className="mt-1 text-[13px] text-steel-dark">We also text them the link. Never shown to anyone else.</p>
        </div>
        {mode === "set" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice name="methodUi" value="delivery" checked={method === "delivery"} onChange={() => setMethod("delivery")} title="Deliver to them" note="Kathmandu Valley" />
              <Choice name="methodUi" value="pickup" checked={method === "pickup"} onChange={() => setMethod("pickup")} title="I'll pick it up" note="Free, from the store" />
            </div>
            {method === "delivery" && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="g-area" className={label}>
                    Their area
                  </label>
                  <input id="g-area" {...invalid("g-area")} name="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Baneshwor, Kathmandu" className={input} />
                </div>
                <div>
                  <label htmlFor="g-landmark" className={label}>
                    Nearby landmark
                  </label>
                  <input id="g-landmark" {...invalid("g-landmark")} name="landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} className={input} />
                </div>
                <div>
                  <label htmlFor="g-details" className={label}>
                    House or floor <span className="font-normal text-steel-dark">(optional)</span>
                  </label>
                  <input id="g-details" name="details" className={input} />
                </div>
              </div>
            )}
          </>
        )}
        <div>
          <label htmlFor="g-date" className={label}>
            {mode === "set" ? "Deliver on" : "Arrive by"} <span className="font-normal text-steel-dark">(optional, e.g. their birthday or Tika day)</span>
          </label>
          <input
            id="g-date"
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
            name="buyerPhone"
            type="tel"
            inputMode="numeric"
            placeholder="98XXXXXXXX"
            {...phoneField}
            className={`${input} font-mono`}
          />
          <p className="mt-1 text-[13px] text-steel-dark">We&apos;ll tell you when they open it and when it arrives. Never their address.</p>
        </div>
        <fieldset>
          <legend className={label}>Pay with</legend>
          <PayWith className="mt-2" />
        </fieldset>

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

      <p id="g-hint" role="alert" className="mt-6 min-h-5 text-[14px] text-error-light">
        {hint || (state.status === "error" ? state.message : "")}
      </p>
      {/* Stays on screen on phones, with the total, so the next step is always one tap away. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-mist bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <p className="mb-2 flex items-baseline justify-between text-[14px] sm:hidden">
          <span className="text-steel-dark">Total</span>
          <span className="font-mono font-semibold">{formatPrice(total)}</span>
        </p>
        <div className="flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="btn btn-outline flex-1">
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="btn btn-ink flex-[2]">
              Continue
            </button>
          ) : (
            <button type="submit" className="btn btn-volt flex-[2]" disabled={pending} aria-busy={pending}>
              {pending ? "One moment…" : `Pay ${formatPrice(total)}`}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
