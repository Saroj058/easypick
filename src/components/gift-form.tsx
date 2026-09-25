"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { placeGiftOrder, type GiftState } from "@/app/gift-actions";
import { formatPrice, normaliseNepaliMobile } from "@/lib/format";
import { site } from "@/lib/site";
import type { Product, Size } from "@/lib/types";
import { useMe, usePrefilled } from "./session";
import { PayWith } from "./pay-with";

const input = "mt-2 h-14 w-full rounded-[2px] border border-steel-dark bg-paper px-4 text-base";
const label = "block text-sm font-semibold";
const STEPS = ["The piece", "Your note", "Who and when", "Pay"] as const;

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

/** Send one piece as a gift, one short step at a time. "Let them pick the size" is the default. */
export function GiftForm({ product }: { product: Product }) {
  const me = useMe();
  const phoneField = usePrefilled(me?.phone);
  const [state, action, pending] = useActionState<GiftState, FormData>(placeGiftOrder, { status: "idle" });
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

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

  const senderName = anonymous ? null : (sender ?? me?.name ?? "").trim() || null;
  const price = product.salePrice ?? product.price;
  const sizes = product.variants.filter((v) => v.colour === colour && v.size !== "ONE");
  const deliveryFee = (mode === "set" && method === "pickup") || price >= site.delivery.freeAbove ? 0 : site.delivery.flatFee;
  const wrapFee = wrap === "premium" ? site.gifting.premiumWrapFee : 0;
  const total = price + deliveryFee + wrapFee;
  const today = new Date().toISOString().slice(0, 10);

  // Move focus to the step heading so keyboard and screen-reader users land in the right place.
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
    moved.current = true;
  }, [step]);

  function next() {
    setHint("");
    if (step === 0 && mode === "set" && !size) return setHint("Pick their size, or let them pick.");
    if (step === 2) {
      if (!receiverName.trim()) return setHint("Add their name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(receiverEmail.trim())) return setHint("Add their email address so we can send them the gift link.");
      if (receiverPhone.trim() && !normaliseNepaliMobile(receiverPhone)) return setHint("Their mobile number should be 10 digits, like 98XXXXXXXX, or leave it empty.");
      if (mode === "set" && method === "delivery" && !normaliseNepaliMobile(receiverPhone)) return setHint("Add their mobile number so the rider can reach them.");
      if (mode === "set" && method === "delivery" && (!area.trim() || !landmark.trim())) return setHint("Add their area and a nearby landmark.");
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  return (
    <form action={action} noValidate>
      {/* Every field stays in the form; only the current step is shown. */}
      <input type="hidden" name="slug" value={product.slug} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="wrap" value={wrap} />
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="colour" value={colour} />
      <input type="hidden" name="size" value={size ?? ""} />
      <input type="hidden" name="showPrice" value={showPrice ? "on" : ""} />

      <div className="mb-8">
        <p className="text-sm text-steel-dark">
          Step {step + 1} of {STEPS.length}
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1 ${i <= step ? "bg-ink" : "bg-mist"}`} />
          ))}
        </div>
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
                    </span>
                  </label>
                );
              })}
            </div>
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
                  Online: they tap their size{product.colours.length > 1 ? " (and colour, if you allow it below)" : ""}, then delivery or pickup. In store: they
                  show their gift code at the counter and try the sizes on.
                </span>
              </li>
              <li>
                <span className="font-semibold">3. We hold one for them meanwhile.</span>{" "}
                <span className="text-steel-dark">You choose whether they see the price (tick box below).</span>
              </li>
            </ol>
          </div>
        )}
      </section>

      {/* 2. Your note */}
      <section hidden={step !== 1} className="space-y-6">
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
            className="mt-2 w-full rounded-[2px] border border-steel-dark bg-paper p-4 text-base"
          />
          <p className="mt-1 text-right text-[13px] text-steel-dark">
            {message.length}/{site.gifting.messageMax}
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
        <MessageCard to={receiverName} from={senderName} message={message} wrap={wrap} price={showPrice ? formatPrice(price) : null} />
      </section>

      {/* 3. Who and when */}
      <section hidden={step !== 2} className="space-y-6">
        <div>
          <label htmlFor="g-rname" className={label}>
            Their name
          </label>
          <input id="g-rname" name="receiverName" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="g-remail" className={label}>
            Their email
          </label>
          <input
            id="g-remail"
            name="receiverEmail"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="name@example.com"
            value={receiverEmail}
            onChange={(e) => setReceiverEmail(e.target.value)}
            className={input}
          />
          <p className="mt-1 text-[13px] text-steel-dark">
            {mode === "pick" ? "We email them a private link to open the gift and pick their size." : "We email them a link to see their gift."}
          </p>
        </div>
        <div>
          <label htmlFor="g-rphone" className={label}>
            Their mobile number{" "}
            <span className="font-normal text-steel-dark">{mode === "set" && method === "delivery" ? "(for the rider)" : "(optional)"}</span>
          </label>
          <input
            id="g-rphone"
            name="receiverPhone"
            type="tel"
            inputMode="numeric"
            placeholder="98XXXXXXXX"
            value={receiverPhone}
            onChange={(e) => setReceiverPhone(e.target.value)}
            className={`${input} font-mono`}
          />
          <p className="mt-1 text-[13px] text-steel-dark">
            We also text them the link. Never shown to anyone else.
          </p>
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
                  <input id="g-area" name="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Baneshwor, Kathmandu" className={input} />
                </div>
                <div>
                  <label htmlFor="g-landmark" className={label}>
                    Nearby landmark
                  </label>
                  <input id="g-landmark" name="landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} className={input} />
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
            Deliver on <span className="font-normal text-steel-dark">(optional, e.g. their birthday or Tika day)</span>
          </label>
          <input id="g-date" name="deliverOn" type="date" min={today} className={input} />
        </div>
      </section>

      {/* 4. Pay */}
      <section hidden={step !== 3} className="space-y-6">
        <div>
          <label htmlFor="g-bphone" className={label}>
            Your mobile number
          </label>
          <input
            id="g-bphone"
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
            {senderName ? `, from ${senderName}` : ", anonymously"}
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

      <p role="alert" className="mt-6 min-h-5 text-[14px] text-error-light">
        {hint || (state.status === "error" ? state.message : "")}
      </p>
      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="btn btn-outline sm:flex-1">
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="btn btn-ink sm:flex-1">
            Continue
          </button>
        ) : (
          <button type="submit" className="btn btn-volt sm:flex-1" disabled={pending} aria-busy={pending}>
            Send gift · {formatPrice(total)}
          </button>
        )}
      </div>
      {/* Price visibility: shown by default; ticked = they never see what it cost. */}
      <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-[14px]">
        <input type="checkbox" checked={!showPrice} onChange={(e) => setShowPrice(!e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#0a0a0a]" />
        <span>
          Hide the price from them <span className="text-steel-dark">(they won&apos;t see what it cost)</span>
        </span>
      </label>
    </form>
  );
}
