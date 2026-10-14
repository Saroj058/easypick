"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
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
import { ProductImage } from "./product-image";

// scroll-mb: a focused field clears the pay bar that sticks to the bottom on phones.
const input =
  "mt-1.5 h-11 w-full scroll-mb-36 rounded-xl border border-ink/20 bg-paper px-4 text-base outline-none transition-[border-color,box-shadow] placeholder:text-steel focus:border-ink focus:shadow-[0_0_0_3px_rgba(10,10,10,0.08)] aria-[invalid=true]:border-2 aria-[invalid=true]:border-error-light";
const label = "block text-sm font-semibold";
const help = "mt-1.5 text-[13px] text-steel-dark";
const STEPS = ["The piece", "Your note", "Send and pay"] as const;
/** One line under each step's title: what it is for. */
const LEAD = ["How should their size work?", "Who it's for, and what the card says.", "Where the link goes, and paying."] as const;
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

function Choice({
  name,
  value,
  checked,
  onChange,
  title,
  note,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  note?: string;
}) {
  // Rows sit one under another and share their borders; the chosen one is outlined in ink.
  return (
    <label className="relative -mt-px block cursor-pointer first-of-type:mt-0 [&:first-of-type>span]:rounded-t-xl [&:last-of-type>span]:rounded-b-xl">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="flex items-start gap-3 border border-ink/15 px-4 py-3 transition-colors hover:bg-mist/30 peer-checked:relative peer-checked:z-10 peer-checked:border-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
        <span aria-hidden className={`mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-colors ${checked ? "border-ink" : "border-ink/35"}`}>
          <span className={`h-2.5 w-2.5 rounded-full bg-ink transition-transform duration-150 ${checked ? "scale-100" : "scale-0"}`} />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-medium leading-snug">{title}</span>
          {note && <span className="mt-0.5 block text-[13px] leading-snug text-steel-dark">{note}</span>}
        </span>
      </span>
    </label>
  );
}

/** A yes/no as a switch: the box is still a real checkbox, so it's sent with the form and works with keys. */
function Toggle({
  name,
  checked,
  onChange,
  note,
  className = "",
  children,
}: {
  name?: string;
  checked?: boolean;
  onChange?: (on: boolean) => void;
  note?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 py-2 text-[15px] ${className}`}>
      <input type="checkbox" name={name} checked={checked} onChange={onChange && ((e) => onChange(e.target.checked))} className="peer sr-only" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{children}</span>
        {note && <span className="block text-[13px] text-steel-dark">{note}</span>}
      </span>
      <span
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full bg-ink/15 transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-paper after:shadow-[0_1px_3px_rgba(0,0,0,0.3)] after:transition-transform after:duration-200 peer-checked:bg-ink peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
      />
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
    <figure aria-label="Preview of the gift card" className={`rounded-xl p-4 transition-colors duration-200 ${wrap === "premium" ? "bg-ink [--hole:var(--color-ink)]" : "bg-mist/50 [--hole:var(--color-mist)]"}`}>
      <GiftNote key={wrap} to={to} from={from} message={message} placeholder="Your note appears here." />
      <figcaption className={`mt-3 text-center text-[12px] ${wrap === "premium" ? "text-paper/70" : "text-steel-dark"}`}>
        {wrap === "premium" ? "In the premium black box" : "In an Easypick bag with tissue"} · {price ? `gift receipt shows ${price}` : "no price inside"}
      </figcaption>
    </figure>
  );
}

/** Send one piece as a gift in three short steps. "Let them pick the size" is the default. */
export function GiftForm({
  product,
  festival = null,
  initial,
  sheet = false,
}: {
  product: Product;
  festival?: GiftFestival;
  initial?: { colour?: string; size?: string };
  /** In a pop-up: the piece and the steps stay at the top, the total and the button at the foot. */
  sheet?: boolean;
}) {
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
    if (moved.current) headingRef.current?.focus({ preventScroll: sheet });
    moved.current = true;
  }, [step, sheet]);

  function next() {
    setHint("");
    setHintField(null);
    if (step === 0 && mode === "set" && !size) return fail("Pick their size, or let them pick.");
    if (step === 1 && !receiverName.trim()) return fail("Add their name, so the card is for them.", "g-rname");
    goTo(Math.min(step + 1, STEPS.length - 1));
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

  // The sheet scrolls itself: a new step starts at its top, under the sticky header.
  const formRef = useRef<HTMLFormElement>(null);
  const goTo = (s: number) => {
    setHint("");
    setHintField(null);
    setStep(s);
    if (sheet) formRef.current?.parentElement?.scrollTo({ top: 0 });
  };
  const chosenHex = product.colours.find((c) => c.name === colour)?.hex ?? "#888888";

  return (
    <form ref={formRef} action={action} onSubmit={check} noValidate className={sheet ? "flex min-h-full flex-col" : ""}>
      {/* Every field stays in the form; only the current step is shown. */}
      <input type="hidden" name="slug" value={product.slug} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="wrap" value={wrap} />
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="colour" value={colour} />
      <input type="hidden" name="size" value={size ?? ""} />
      <input type="hidden" name="showPrice" value={showPrice ? "on" : ""} />

      {/* The piece and where they are in it. In the pop-up it stays at the top while the step scrolls. */}
      <div className={sheet ? "sticky top-0 z-20 border-b border-ink/10 bg-paper px-5 pb-3 pt-5" : "mb-6"}>
        {sheet && (
          <div className="mb-3.5 flex items-center gap-3 pr-10">
            <span className="relative block h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-[#efefef]">
              <ProductImage image={product.images[0] ?? { src: null, alt: product.name, kind: "front" }} category={product.category} colourHex={chosenHex} decorative sizes="40px" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-tight">{product.name}</span>
              <span className="block text-[13px] text-steel-dark">
                {colour} · <span className="font-mono tabular-nums">{formatPrice(price)}</span>
              </span>
            </span>
          </div>
        )}
        <p className="text-[12.5px] text-steel-dark" aria-hidden>
          Step {step + 1} of {STEPS.length}
        </p>
        {/* Finished steps can be opened again by their segment; later ones can't be skipped to. */}
        <ol className="mt-1.5 grid grid-cols-3 gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                disabled={i >= step}
                onClick={() => goTo(i)}
                aria-current={i === step ? "step" : undefined}
                aria-label={`${i + 1}. ${s}`}
                className="block w-full py-1 disabled:cursor-default"
              >
                <span className={`block h-[3px] rounded-full transition-colors duration-300 ${i <= step ? "bg-ink" : "bg-ink/12"}`} />
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className={sheet ? "flex-1 px-5 pb-6 pt-5" : ""}>
        <h2 ref={headingRef} tabIndex={-1} className="text-[20px] font-semibold leading-tight outline-none">
          {STEPS[step]}
        </h2>
        <p className="mt-1 text-[14px] text-steel-dark">{LEAD[step]}</p>

        {/* 1. The piece */}
        <section hidden={step !== 0} className="mt-5 space-y-6">
          {oneSize && product.colours.length < 2 && <p className="text-[15px]">One size, one colour. Nothing to choose here.</p>}
          {!oneSize && (
            <fieldset className="flex flex-col">
              <legend className="sr-only">Who picks the size</legend>
              <Choice name="modeUi" value="pick" checked={mode === "pick"} onChange={() => setMode("pick")} title="Let them pick the size" note="They choose from a link, or try it on in our store." />
              <Choice name="modeUi" value="set" checked={mode === "set"} onChange={() => setMode("set")} title="I know their size" note="We wrap it and deliver it to them, or you collect it." />
            </fieldset>
          )}
          {product.colours.length > 1 && (
            <fieldset>
              <legend className={label}>
                Colour <span className="font-normal text-steel-dark">· {colour}</span>
              </legend>
              <div className="mt-3 flex gap-3">
                {product.colours.map((c) => (
                  <label key={c.name} className="relative cursor-pointer">
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
                    <span className="block h-9 w-9 rounded-full border border-ink/20 ring-offset-2 transition-shadow peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink" style={{ background: c.hex }} />
                    <span className="sr-only">{c.name}</span>
                  </label>
                ))}
              </div>
              {mode === "pick" && (
                <Toggle name="colourChoice" className="mt-3">
                  Let them change the colour too
                </Toggle>
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
                    <label key={v.sku} className={`relative ${out ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <input type="radio" name="sizeUi" checked={size === v.size} disabled={out} onChange={() => setSize(v.size)} className="peer sr-only" />
                      <span
                        className={`flex h-14 items-center justify-center rounded-xl border font-mono font-semibold transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ink ${
                          out ? "border-mist text-steel-dark line-through" : "border-ink/20 hover:border-ink"
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
            <p className="text-[13.5px] leading-relaxed text-steel-dark" aria-label="How they choose">
              We email them a private link. They pick their size online or in our store, and we hold one for them until they do.
            </p>
          )}
        </section>

        {/* 2. Your note */}
        <section hidden={step !== 1} className="mt-5 space-y-5">
          <div className={`grid gap-4 ${anonymous ? "" : "sm:grid-cols-2"}`}>
            <div>
              <label htmlFor="g-rname" className={label}>
                Their name
              </label>
              <input id="g-rname" {...invalid("g-rname")} aria-required name="receiverName" autoComplete="off" autoCapitalize="words" enterKeyHint="next" maxLength={60} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Sita" className={input} />
            </div>
            {!anonymous && (
              <div>
                <label htmlFor="g-sender" className={label}>
                  From
                </label>
                <input id="g-sender" name="senderName" autoComplete="given-name" autoCapitalize="words" enterKeyHint="next" maxLength={40} value={sender ?? me?.name ?? ""} onChange={(e) => setSender(e.target.value)} placeholder="Your name" className={input} />
              </div>
            )}
          </div>
          <div>
            <label htmlFor="g-message" className={label}>
              Note <span className="font-normal text-steel-dark">(optional)</span>
            </label>
            {/* Stuck for words: one tap writes a line to start from. */}
            <div className="-mx-5 mt-2 flex scroll-px-5 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Note ideas">
              {NOTES.map(([name, words]) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={message === words}
                  onClick={() => setMessage(words)}
                  className={`inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full border px-3.5 text-[13px] font-semibold transition-[border-color,background-color,color,scale] duration-150 active:scale-[0.97] ${message === words ? "border-ink bg-ink text-paper" : "border-ink/20 hover:border-ink"}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <textarea
              id="g-message"
              name="message"
              rows={3}
              maxLength={site.gifting.messageMax}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Saw this and thought of you."
              aria-describedby="g-message-count"
              className="mt-2 w-full rounded-xl border border-ink/20 bg-paper p-4 text-base outline-none transition-[border-color,box-shadow] focus:border-ink focus:shadow-[0_0_0_3px_rgba(10,10,10,0.08)]"
            />
            <p id="g-message-count" className={`mt-1 text-right text-[12px] ${near ? "font-semibold text-[#7a3e00]" : "text-steel-dark"}`} aria-live={near ? "polite" : "off"}>
              {near ? `${site.gifting.messageMax - message.length} characters left` : `${message.length}/${site.gifting.messageMax}`}
            </p>
          </div>
          <MessageCard to={receiverName} from={senderName} message={message} wrap={wrap} price={showPrice ? formatPrice(price) : null} />
          <fieldset className="flex flex-col">
            <legend className={`${label} mb-2`}>Wrapping</legend>
            <Choice name="wrapUi" value="standard" checked={wrap === "standard"} onChange={() => setWrap("standard")} title="Easypick bag" note="Tissue and a printed card. Free." />
            <Choice name="wrapUi" value="premium" checked={wrap === "premium"} onChange={() => setWrap("premium")} title="Black box" note={`Sealed, with the card. ${formatPrice(site.gifting.premiumWrapFee)}.`} />
          </fieldset>
          <div className="divide-y divide-ink/10 rounded-xl border border-ink/15 px-4">
            <Toggle name="anonymous" checked={anonymous} onChange={setAnonymous}>
              Send it anonymously
            </Toggle>
            {/* Price visibility: shown by default; on = they never see what it cost. */}
            <Toggle checked={!showPrice} onChange={(on) => setShowPrice(!on)} note="Their card and receipt won't show what it cost.">
              Hide the price from them
            </Toggle>
          </div>
        </section>

        {/* 3. Send and pay */}
        <section hidden={step !== 2} className="mt-5 space-y-6">
          <Group title="Where the link goes">
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
                <p className="mt-1.5 text-[14px]">
                  Did you mean{" "}
                  <button type="button" onClick={() => setReceiverEmail(typo)} className="font-semibold underline underline-offset-2">
                    {typo}
                  </button>
                  ?
                </p>
              ) : (
                <p className={help}>{mode === "pick" ? "We email them a private link to open the gift and pick their size." : "We email them a link to see their gift."}</p>
              )}
            </div>
            <div>
              <label htmlFor="g-rphone" className={label}>
                Their mobile <span className="font-normal text-steel-dark">{mode === "set" && method === "delivery" ? "(for the rider)" : "(optional)"}</span>
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
              <p className={help}>Add it and we text them the link too.</p>
            </div>
          </Group>

          {mode === "set" && (
            <Group title="Getting it to them">
              <fieldset className="flex flex-col">
                <legend className="sr-only">Delivery or pickup</legend>
                <Choice name="methodUi" value="delivery" checked={method === "delivery"} onChange={() => setMethod("delivery")} title="Deliver to them" note="Kathmandu Valley" />
                <Choice name="methodUi" value="pickup" checked={method === "pickup"} onChange={() => setMethod("pickup")} title="I'll pick it up" note="Free, from the store" />
              </fieldset>
              {method === "delivery" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="g-area" className={label}>
                        Their area
                      </label>
                      <input id="g-area" {...invalid("g-area")} aria-required autoComplete="off" name="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Baneshwor, Kathmandu" className={input} />
                    </div>
                    <div>
                      <label htmlFor="g-landmark" className={label}>
                        Nearby landmark
                      </label>
                      <input id="g-landmark" {...invalid("g-landmark")} aria-required autoComplete="off" name="landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Near the temple gate" className={input} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="g-details" className={label}>
                      House or floor <span className="font-normal text-steel-dark">(optional)</span>
                    </label>
                    <input id="g-details" name="details" autoComplete="off" className={input} />
                  </div>
                </>
              )}
            </Group>
          )}

          <Group title="When">
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
              <p id="g-date-hint" className={help}>
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
          </Group>

          <Group title="You">
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
              <p className={help}>We text you when they open it and pick their size.</p>
            </div>
            <div>
              <p className={label}>Pay with</p>
              <PayWith className="mt-2" />
            </div>
          </Group>

          {/* What they're paying for, before they pay */}
          <div className="border-t border-ink/10 pt-4">
            <p className="font-semibold">
              {product.name} <span className="font-normal text-steel-dark">· {colour} · {mode === "pick" ? "they pick the size" : size === "ONE" ? "one size" : `size ${size}`}</span>
            </p>
            <p className="mt-0.5 text-[14px] text-steel-dark">
              For {receiverName.trim() || "them"}
              {senderName ? `, from ${senderName}` : ", anonymously"} · {showPrice ? "price shown" : "price hidden"}
            </p>
            <dl className="mt-3 space-y-1.5 text-[15px]">
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
                  <dt>Black box</dt>
                  <dd className="font-mono">{formatPrice(wrapFee)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-1.5 text-lg font-semibold">
                <dt>Total</dt>
                <dd className="font-mono">{formatPrice(total)}</dd>
              </div>
            </dl>
            {mode === "pick" && deliveryFee > 0 && <p className="mt-2 text-[13px] text-steel-dark">If they choose store pickup, we refund the delivery fee.</p>}
          </div>
        </section>
      </div>

      {/* The total and the next step, always one tap away: pinned to the foot of the pop-up, and of the screen on phones. */}
      <div
        className={
          sheet
            ? "sticky bottom-0 z-20 border-t border-ink/10 bg-paper/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
            : "sticky bottom-0 z-20 -mx-4 mt-6 border-t border-mist bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0"
        }
      >
        <p id="g-hint" role="alert" className="text-[14px] text-error-light empty:hidden [&:not(:empty)]:pb-2">
          {hint || (state.status === "error" ? state.message : "")}
        </p>
        <div className="flex items-center gap-3">
          <p className="mr-auto leading-tight">
            <span className="block text-[12px] text-steel-dark">Total</span>
            <span className="font-mono text-[17px] font-semibold tabular-nums">{formatPrice(total)}</span>
            {/* Why the total is more than the piece, so payment holds no surprise */}
            {total > price && (
              <span className="block text-[11.5px] text-steel-dark">
                incl. {[deliveryFee ? `${formatPrice(deliveryFee)} delivery` : "", wrapFee ? `${formatPrice(wrapFee)} box` : ""].filter(Boolean).join(" + ")}
              </span>
            )}
          </p>
          {step > 0 && (
            <button type="button" onClick={() => goTo(step - 1)} className="inline-flex h-12 cursor-pointer items-center gap-1.5 rounded-full border border-ink/25 px-4 text-[14px] font-semibold transition-[border-color] hover:border-ink">
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            // Separate keys: reusing one button for both would let the Continue click also submit the form.
            <button key="next" type="button" onClick={next} className="group inline-flex h-12 cursor-pointer items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-paper transition-[scale] duration-150 active:scale-[0.97]">
              Continue
              <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          ) : (
            <button key="pay" type="submit" className="relative inline-flex h-12 cursor-pointer items-center gap-2 overflow-hidden rounded-full bg-volt px-6 text-[14px] font-semibold text-ink transition-[background-color,scale] duration-150 hover:bg-[#b5f020] active:scale-[0.97] disabled:cursor-wait" disabled={pending} aria-busy={pending}>
              {pending && <span className="visit-load absolute inset-x-0 bottom-0 h-0.5 bg-ink" aria-hidden />}
              {pending ? "One moment…" : `Pay ${formatPrice(total)}`}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

/** A small titled group on the last step. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="index text-steel-dark">{title}</p>
      {children}
    </div>
  );
}
