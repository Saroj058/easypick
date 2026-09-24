"use client";

import { useActionState, useState } from "react";

import {
  chooseGift,
  giftToCard,
  openGift,
  sendThanks,
  tryGiftInStore,
  type ChooseState,
  type ThanksState,
} from "@/app/gift-actions";
import { formatHour, formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { matchSize } from "@/lib/fit-profile";
import type {
  Category,
  Colour,
  Measurements,
  ProductImage as Img,
  Size,
} from "@/lib/types";
import { useFitProfile } from "./fit-finder";
import { ProductImage } from "./product-image";

export interface RevealData {
  token: string;
  mode: "pick" | "set";
  status: "sent" | "opened" | "chosen" | "converted" | "delivered";
  from: string | null;
  to: string;
  message: string;
  deliverOn: string | null;
  wrap: "standard" | "premium";
  colourChoice: boolean;
  chosen: {
    method: "pickup" | "delivery";
    slot: string | null;
    area: string | null;
    tryInStore: boolean;
  } | null;
  storeCode: string | null;
  cardCode: string | null;
  welcomeCode: string | null;
  thanked: boolean;
  /** Null unless the buyer chose to show the price. */
  price: number | null;
  line: { size: Size; colour: string; sku: string };
  product: {
    name: string;
    category: Category;
    image: Img;
    colours: Colour[];
    measurements: Measurements;
    variants: { sku: string; size: Size; colour: string; available: boolean }[];
  } | null;
}

const input =
  "mt-2 h-14 w-full rounded-[2px] border border-steel-dark bg-paper px-4 text-base";
const ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

function niceDate(d: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(`${d}T12:00:00+05:45`));
}

/** Say thanks to the sender, then show the receiver's own welcome credit. */
function AfterGift({
  token,
  from,
  welcomeCode,
  thanked,
}: {
  token: string;
  from: string | null;
  welcomeCode: string | null;
  thanked: boolean;
}) {
  const [state, action, pending] = useActionState<ThanksState, FormData>(
    sendThanks,
    { status: thanked ? "sent" : "idle" },
  );
  return (
    <div className="mt-12 space-y-10 text-left">
      <section aria-labelledby="thanks-title" className="bg-photo p-6">
        {state.status === "sent" ? (
          <p
            id="thanks-title"
            role="status"
            className="text-center text-lg font-semibold"
          >
            Thank-you sent{from ? ` to ${from}` : ""}.
          </p>
        ) : (
          <form action={action}>
            <input type="hidden" name="token" value={token} />
            <label
              id="thanks-title"
              htmlFor="thanks"
              className="block text-lg font-semibold"
            >
              Say thank you{from ? ` to ${from}` : ""}
            </label>
            <textarea
              id="thanks"
              name="thanks"
              rows={2}
              maxLength={200}
              placeholder="Love it. Thank you!"
              className="mt-3 w-full rounded-[2px] border border-steel-dark bg-paper p-4 text-base"
            />
            <p role="alert" className="min-h-5 text-[13px] text-error-light">
              {state.status === "error" ? state.message : ""}
            </p>
            <button
              type="submit"
              className="btn btn-ink mt-1 w-full"
              disabled={pending}
              aria-busy={pending}
            >
              Send thank-you
            </button>
          </form>
        )}
      </section>
      {welcomeCode && (
        <section aria-labelledby="welcome-title" className="text-center">
          <h2 id="welcome-title" className="text-xl font-semibold">
            {formatPrice(site.gifting.welcomeCredit)} off your first order.
          </h2>
          <p className="mt-1 text-steel-dark">
            A little welcome from Easypick. Valid for{" "}
            {site.gifting.welcomeCreditDays} days, online or in store.
          </p>
          <p className="mt-4 inline-block bg-ink px-5 py-3 font-mono text-xl font-semibold tracking-[0.1em] text-paper">
            {welcomeCode}
          </p>
        </section>
      )}
    </div>
  );
}

/** What to do at the store: the code to show and when we're open. */
function StorePanel({ code }: { code: string }) {
  const { store } = site;
  return (
    <section aria-labelledby="store-title" className="mt-12 text-center">
      <h2 id="store-title" className="text-2xl font-semibold">
        It&apos;s waiting for you in the store.
      </h2>
      <p className="mx-auto mt-2 max-w-[36ch] text-steel-dark">
        Show this code at the counter. The helper brings it in your sizes to try
        on. Take the one that fits.
      </p>
      <p className="mt-6 inline-block bg-ink px-6 py-4 font-mono text-2xl font-semibold tracking-[0.1em] text-paper">
        {code}
      </p>
      <p className="mt-6 font-semibold">
        {store.address ?? `${site.name}, ${store.area}`}
      </p>
      <p className="text-[15px] text-steel-dark">
        Open every day, {formatHour(store.hours.open)} to{" "}
        {formatHour(store.hours.close)}. We hold it for 14 days.
      </p>
      <a
        href="/visit"
        className="mt-3 inline-flex min-h-11 items-center text-[15px] font-semibold underline underline-offset-4"
      >
        Directions
      </a>
    </section>
  );
}

/** Closed box → slow unwrap → message → the piece → pick size and delivery. */
export function GiftReveal({ data }: { data: RevealData }) {
  const [opened, setOpened] = useState(data.status !== "sent");
  const [unwrapping, setUnwrapping] = useState(false);
  const [state, action, pending] = useActionState<ChooseState, FormData>(
    chooseGift,
    { status: "idle" },
  );
  const [card, setCard] = useState<string | null>(data.cardCode);
  const [converting, setConverting] = useState(false);

  const profile = useFitProfile();
  const p = data.product;
  const [colour, setColour] = useState(data.line.colour);
  const [size, setSize] = useState<Size | null>(null);
  const [method, setMethod] = useState<"delivery" | "pickup">("delivery");
  const [path, setPath] = useState<"online" | "store">("online");
  const [storeCode, setStoreCode] = useState<string | null>(data.storeCode);
  const [holding, setHolding] = useState(false);

  async function holdInStore() {
    setHolding(true);
    const res = await tryGiftInStore(data.token);
    setHolding(false);
    if (res.ok && res.code) setStoreCode(res.code);
  }

  const first = data.to.split(" ")[0];
  const done =
    state.status === "done" ||
    data.status === "chosen" ||
    data.status === "delivered";

  function open() {
    setUnwrapping(true);
    void openGift(data.token);
    setTimeout(() => setOpened(true), 900);
  }

  async function toCard() {
    setConverting(true);
    const res = await giftToCard(data.token);
    setConverting(false);
    if (res.ok && res.code) setCard(res.code);
  }

  // ---------- Closed box ----------
  if (!opened) {
    return (
      <section className="on-dark flex min-h-[calc(100svh-56px)] flex-col items-center justify-center bg-ink px-6 py-16 text-center text-paper">
        <p className="text-lg text-paper/80">Namaste {first},</p>
        <h1 className="display display-h1 mt-2">
          {data.from ? `${data.from} sent you a gift.` : "You've got a gift."}
        </h1>

        <div className="relative mt-14 h-44 w-44" aria-hidden>
          {/* box */}
          <div
            className={`absolute inset-x-0 bottom-0 h-32 bg-graphite transition-all duration-700 ${unwrapping ? "translate-y-6 opacity-0" : ""}`}
          >
            <div className="absolute inset-y-0 left-1/2 w-5 -translate-x-1/2 bg-volt" />
          </div>
          {/* lid */}
          <div
            className={`absolute inset-x-[-8px] top-4 h-10 bg-[#2a2a2c] transition-all duration-700 ${unwrapping ? "-translate-y-24 rotate-[-12deg] opacity-0" : ""}`}
          >
            <div className="absolute inset-y-0 left-1/2 w-5 -translate-x-1/2 bg-volt" />
          </div>
        </div>

        <button
          type="button"
          onClick={open}
          disabled={unwrapping}
          className="btn btn-volt mt-14 min-w-56"
        >
          Open it
        </button>
      </section>
    );
  }

  // ---------- Opened ----------
  const sizes = p
    ? ORDER.filter((s) =>
        p.variants.some((v) => v.size === s && v.colour === colour),
      )
    : [];
  const oneSize = sizes.length === 1 && sizes[0] === "ONE";
  const match = p ? matchSize(p.category, p.measurements, profile) : null;
  const anyAvailable =
    p?.variants.some((v) => v.colour === colour && v.available) ?? false;

  return (
    <div className="container-ep max-w-2xl animate-fade-up pb-24 pt-10 md:pt-16">
      {data.message && (
        <figure className="bg-photo px-6 py-8 text-center md:px-10">
          <blockquote className="text-xl leading-relaxed md:text-2xl">
            &ldquo;{data.message}&rdquo;
          </blockquote>
          <figcaption className="mt-4 text-steel-dark">
            {data.from ? `From ${data.from}` : "From someone who thinks of you"}
          </figcaption>
        </figure>
      )}

      {p && (
        <div className="mt-10 grid grid-cols-[120px_1fr] items-center gap-6 sm:grid-cols-[160px_1fr]">
          <ProductImage
            image={p.image}
            category={p.category}
            colourHex={
              p.colours.find((c) => c.name === colour)?.hex ?? p.colours[0].hex
            }
            decorative
            sizes="160px"
          />
          <div>
            <h1 className="text-2xl font-semibold">{p.name}</h1>
            <p className="mt-1 text-steel-dark">
              {colour}
              {data.wrap === "premium" ? " · in the black gift box" : ""}
            </p>
            {data.price !== null && <p className="mt-1 font-mono text-[15px]">{formatPrice(data.price)}</p>}
          </div>
        </div>
      )}

      {/* Turned into a gift card */}
      {card ? (
        <section className="mt-12 text-center">
          <h2 className="text-2xl font-semibold">It&apos;s a gift card now.</h2>
          <p className="mt-2 text-steel-dark">
            Use it online or in store, on anything you like. Valid for 12
            months.
          </p>
          <p className="mt-6 inline-block bg-ink px-6 py-4 font-mono text-2xl font-semibold tracking-[0.1em] text-paper">
            {card}
          </p>
          <p className="mt-3 text-[13px] text-steel-dark">
            We&apos;ve also sent it to you by SMS.
          </p>
        </section>
      ) : storeCode ? (
        <>
          <StorePanel code={storeCode} />
          <AfterGift
            token={data.token}
            from={data.from}
            welcomeCode={data.welcomeCode}
            thanked={data.thanked}
          />
        </>
      ) : done ? (
        <section className="mt-12 text-center">
          <h2 className="text-2xl font-semibold">It&apos;s on its way.</h2>
          <p className="mt-2 text-steel-dark">
            {data.chosen?.method === "pickup" ||
            (data.mode === "set" && !data.chosen)
              ? "We'll text you when it's ready."
              : data.deliverOn
                ? `Arriving ${niceDate(data.deliverOn)}${data.chosen?.slot ? `, ${data.chosen.slot}` : ""}.`
                : "We'll text you when the rider is on the way."}
          </p>
          <p className="mt-6 text-[13px] text-steel-dark">
            Not quite right? Swap the size or colour within 14 days. The gift
            receipt in the box has the link.
          </p>
          <AfterGift
            token={data.token}
            from={data.from}
            welcomeCode={
              state.status === "done"
                ? (state.welcomeCode ?? data.welcomeCode)
                : data.welcomeCode
            }
            thanked={data.thanked}
          />
        </section>
      ) : data.mode === "set" ? (
        <section className="mt-12 text-center">
          <h2 className="text-2xl font-semibold">It&apos;s on its way.</h2>
          <p className="mt-2 text-steel-dark">
            {data.deliverOn
              ? `Arriving ${niceDate(data.deliverOn)}.`
              : "We'll text you when it's on the way."}
          </p>
          <p className="mt-6 text-[13px] text-steel-dark">
            Wrong size? Swap it within 14 days with the gift receipt.
          </p>
          <AfterGift
            token={data.token}
            from={data.from}
            welcomeCode={null}
            thanked={data.thanked}
          />
        </section>
      ) : (
        <>
          <fieldset className="mt-12">
            <legend className="text-2xl font-semibold">
              How would you like to choose your size?
            </legend>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  [
                    "online",
                    "Choose online",
                    "Pick your size here now. We deliver it or keep it for pickup.",
                  ],
                  [
                    "store",
                    "Try it on in the store",
                    "Come in, try the sizes on, and take the one that fits.",
                  ],
                ] as const
              ).map(([v, t, n]) => (
                <label key={v} className="relative">
                  <input
                    type="radio"
                    name="path"
                    checked={path === v}
                    onChange={() => setPath(v)}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-[88px] flex-col justify-center rounded-[2px] border border-mist px-4 py-3 peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                    <span className="font-semibold">{t}</span>
                    <span className="text-[13px] text-steel-dark">{n}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {path === "store" ? (
            <div className="mt-8 space-y-4">
              <p className="text-steel-dark">
                We&apos;ll keep it at the counter for 14 days under your gift
                code
                {data.colourChoice
                  ? ", in every colour you can choose from"
                  : ""}
                . No need to decide now.
              </p>
              <button
                type="button"
                onClick={holdInStore}
                disabled={holding}
                aria-busy={holding}
                className="btn btn-volt w-full"
              >
                Hold it for me in the store
              </button>
            </div>
          ) : (
            // Pick size and delivery
            <form action={action} className="mt-10 space-y-10" noValidate>
              <input type="hidden" name="token" value={data.token} />
              <input type="hidden" name="method" value={method} />
              <div>
                <h2 className="text-xl font-semibold">Pick your size.</h2>
                <p className="mt-1 text-steel-dark">
                  We&apos;ll pack it once you choose.
                </p>
              </div>

              {data.colourChoice && p && p.colours.length > 1 && (
                <fieldset>
                  <legend className="text-sm font-semibold">
                    Colour · {colour}
                  </legend>
                  <div className="mt-3 flex gap-3">
                    {p.colours.map((c) => (
                      <label key={c.name} className="relative">
                        <input
                          type="radio"
                          name="colour"
                          value={c.name}
                          checked={colour === c.name}
                          onChange={() => {
                            setColour(c.name);
                            setSize(null);
                          }}
                          className="peer sr-only"
                        />
                        <span
                          className="block h-11 w-11 rounded-full border border-black/10 ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink"
                          style={{ background: c.hex }}
                        />
                        <span className="sr-only">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {oneSize ? (
                <input type="hidden" name="size" value="ONE" />
              ) : (
                <fieldset>
                  <legend className="text-sm font-semibold">Size</legend>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {sizes.map((s) => {
                      const v = p!.variants.find(
                        (x) => x.size === s && x.colour === colour,
                      );
                      const out = !v?.available;
                      return (
                        <label key={s} className="relative">
                          <input
                            type="radio"
                            name="size"
                            value={s}
                            checked={size === s}
                            disabled={out}
                            onChange={() => setSize(s)}
                            className="peer sr-only"
                          />
                          <span
                            className={`flex h-14 items-center justify-center rounded-[2px] border font-mono font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ink ${
                              out
                                ? "border-mist text-steel line-through"
                                : "border-mist"
                            }`}
                          >
                            {s}
                            {match?.size === s && (
                              <span
                                className="ml-1 inline-block h-1.5 w-1.5 bg-volt ring-1 ring-ink"
                                aria-hidden
                              />
                            )}
                          </span>
                          {out && <span className="sr-only"> sold out</span>}
                        </label>
                      );
                    })}
                  </div>
                  {match && (
                    <p className="mt-2 text-[13px] text-steel-dark">
                      The dot marks the size closest to your saved measurements.
                    </p>
                  )}
                </fieldset>
              )}

              <fieldset>
                <legend className="text-sm font-semibold">
                  How would you like it?
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["delivery", "Deliver to me", "Kathmandu Valley"],
                      ["pickup", "I'll pick it up", "From the store"],
                    ] as const
                  ).map(([v, t, n]) => (
                    <label key={v} className="relative">
                      <input
                        type="radio"
                        name="methodUi"
                        checked={method === v}
                        onChange={() => setMethod(v)}
                        className="peer sr-only"
                      />
                      <span className="flex min-h-[64px] flex-col justify-center rounded-[2px] border border-mist px-4 py-3 peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink">
                        <span className="font-semibold">{t}</span>
                        <span className="text-[13px] text-steel-dark">{n}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {method === "delivery" && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="r-area"
                      className="block text-sm font-semibold"
                    >
                      Area
                    </label>
                    <input
                      id="r-area"
                      name="area"
                      autoComplete="address-level3"
                      placeholder="e.g. Jhamsikhel, Lalitpur"
                      className={input}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="r-landmark"
                      className="block text-sm font-semibold"
                    >
                      Nearby landmark
                    </label>
                    <input id="r-landmark" name="landmark" className={input} />
                  </div>
                  <div>
                    <label
                      htmlFor="r-details"
                      className="block text-sm font-semibold"
                    >
                      House or floor{" "}
                      <span className="font-normal text-steel-dark">
                        (optional)
                      </span>
                    </label>
                    <input id="r-details" name="details" className={input} />
                  </div>
                  <fieldset>
                    <legend className="text-sm font-semibold">Best time</legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {["morning", "afternoon", "evening"].map((s, i) => (
                        <label key={s} className="relative">
                          <input
                            type="radio"
                            name="slot"
                            value={s}
                            defaultChecked={i === 1}
                            className="peer sr-only"
                          />
                          <span className="flex h-12 items-center justify-center rounded-[2px] border border-mist text-[15px] font-semibold capitalize peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink">
                            {s}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              <div>
                <p
                  role="alert"
                  className="min-h-5 text-[14px] text-error-light"
                >
                  {state.status === "error" ? state.message : ""}
                </p>
                <button
                  type="submit"
                  className="btn btn-volt mt-2 w-full"
                  disabled={pending || (!oneSize && !size) || !anyAvailable}
                  aria-busy={pending}
                >
                  {oneSize || size ? "Send it to me" : "Pick a size"}
                </button>
                <p className="mt-6 text-center text-[14px] text-steel-dark">
                  {anyAvailable
                    ? "Rather choose something else later? "
                    : "Your size is sold out. "}
                  <button
                    type="button"
                    onClick={toCard}
                    disabled={converting}
                    className="min-h-11 font-semibold text-ink underline underline-offset-2"
                  >
                    Turn it into a gift card
                  </button>
                </p>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
