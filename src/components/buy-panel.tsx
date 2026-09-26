"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { describeMatch, hasFit, matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { stockFromVariants } from "@/lib/live-stock";
import type { Colour, LiveStock, Product, Size } from "@/lib/types";
import { AskWhatsApp } from "./ask-whatsapp";
import { useAddToBag } from "./bag-gate";
import { RestockForm } from "./restock-form";
import { SaveButton } from "./saved";
import { GiftIcon } from "./icons";
import { FitFinder, useFitProfile } from "./fit-finder";

const POLL_MS = 45_000;
const RETRY_MS = 5_000;

type Props = Pick<
  Product,
  "slug" | "name" | "price" | "salePrice" | "colours" | "variants" | "status" | "fit" | "modelNote" | "category" | "measurements"
> & {
  dropLabel?: string;
};

/** Colour + size pickers with live stock, Add to bag and Try in store. */
export function BuyPanel(props: Props) {
  const { slug, name, colours, variants, status } = props;
  const price = props.salePrice ?? props.price;
  const addToBagOrLogin = useAddToBag();

  const sizes = Array.from(new Set(variants.map((v) => v.size)));
  const oneSize = sizes.length === 1 && sizes[0] === "ONE";

  const [colour, setColour] = useState<Colour>(colours[0]);
  const [picked, setSize] = useState<Size | null>(oneSize ? "ONE" : null);
  // Start from the stock the page was rendered with so sizes can be picked straight away;
  // the live check replaces it within a moment.
  const [stock, setStock] = useState<LiveStock>(() => stockFromVariants(slug, variants));
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState(false);
  const [fitOpen, setFitOpen] = useState(false);
  const profile = useFitProfile();
  const match = matchSize(props.category, props.measurements, profile);

  /** One live check; true when it worked. */
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock/${slug}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setStock(await res.json());
      setError(false);
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setChecked(true);
    }
  }, [slug]);

  useEffect(() => {
    if (status !== "live") return;
    // Check now, then every 45 s while the tab is visible; after a failure, try again in 5 s.
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;
    const tick = async () => {
      const ok = first || document.visibilityState === "visible" ? await load() : true;
      first = false;
      if (!stopped) timer = setTimeout(tick, ok ? POLL_MS : RETRY_MS);
    };
    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [load, status]);

  const stockFor = (s: Size) => stock.sizes.find((x) => x.size === s && x.colour === colour.name);
  const sellableOf = (s: Size) => {
    const st = stockFor(s);
    return st ? st.stock - (st.inStoreOnly ? 1 : 0) : 0;
  };
  // Their saved fit is picked for them when it's in stock; tapping another size overrides it.
  const autoSize = !picked && match && sellableOf(match.size) > 0 ? match.size : null;
  const size = picked ?? autoSize;
  const selected = size ? stockFor(size) : undefined;
  const sellable = selected ? selected.stock - (selected.inStoreOnly ? 1 : 0) : 0;
  const variant = size ? variants.find((v) => v.size === size && v.colour === colour.name) : undefined;

  function addToBag() {
    if (!variant || sellable <= 0) return;
    if (!addToBagOrLogin([{ slug, sku: variant.sku, name, size: variant.size, colour: colour.name, price }])) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-2xl">
          {props.salePrice ? (
            <>
              {formatPrice(props.salePrice)} <s className="text-lg text-steel-dark">{formatPrice(props.price)}</s>
            </>
          ) : (
            formatPrice(props.price)
          )}
        </p>
        <SaveButton slug={slug} name={name} />
      </div>
      <p className="mt-1 text-[13px] text-steel-dark">Price shown. No DM needed. VAT included.</p>
      <p className="mt-1 text-[13px] text-steel-dark">
        Free pickup at the store · Valley delivery {formatPrice(site.delivery.flatFee)}, free over {formatPrice(site.delivery.freeAbove)}
      </p>

      {colours.length > 1 && (
        <fieldset className="mt-8">
          <legend className="text-sm font-semibold">
            Colour <span className="font-normal text-steel-dark">· {colour.name}</span>
          </legend>
          <div className="mt-3 flex gap-3">
            {colours.map((c) => (
              <label key={c.name} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="colour"
                  value={c.name}
                  checked={colour.name === c.name}
                  onChange={() => {
                    setColour(c);
                    setSize(oneSize ? "ONE" : null);
                  }}
                  className="peer sr-only"
                />
                <span
                  className="block h-11 w-11 rounded-full border border-black/10 ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink"
                  style={{ background: c.hex }}
                />
                <span className="sr-only">{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {status === "live" && !oneSize && (
        <fieldset className="mt-8">
          <div className="flex items-baseline justify-between">
            <legend className="text-sm font-semibold">Size</legend>
            <button
              type="button"
              onClick={() => setFitOpen((o) => !o)}
              aria-expanded={fitOpen}
              aria-controls={`fit-${slug}`}
              className="min-h-11 text-[13px] underline underline-offset-2"
            >
              {hasFit(profile) ? "Edit my fit" : "Match my size in cm"}
            </button>
          </div>
          {match && (
            <p className="mb-1 flex items-center gap-2 text-[13px]">
              <span className="h-2 w-2 shrink-0 bg-volt ring-1 ring-ink" aria-hidden />
              <span>
                <span className="font-semibold">Your fit: {match.size}</span>
                <span className="text-steel-dark"> · {describeMatch(match)}</span>
              </span>
            </p>
          )}
          {autoSize && (
            <p className="mb-1 text-[13px] text-steel-dark">We picked your size. Tap another to change it.</p>
          )}
          {fitOpen && (
            <div id={`fit-${slug}`} className="my-4 border border-mist bg-photo p-4">
              <FitFinder compact onSaved={() => setFitOpen(false)} />
            </div>
          )}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {sizes.map((s) => {
              const st = stockFor(s);
              const n = st ? st.stock - (st.inStoreOnly ? 1 : 0) : null;
              const out = n !== null && n <= 0;
              const label = n === null ? "" : out ? (st?.inStoreOnly ? "In store only" : "Sold out") : n <= 3 ? `${n} left` : "";
              return (
                <label key={s} className={`relative ${out || n === null ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  <input
                    type="radio"
                    name="size"
                    value={s}
                    checked={size === s}
                    disabled={out || n === null}
                    onChange={() => setSize(s)}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex h-[60px] flex-col items-center justify-center rounded-[2px] border text-center transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
                      out ? "border-mist bg-photo text-steel line-through" : "border-mist hover:border-ink"
                    }`}
                  >
                    <span className="font-mono text-base font-semibold">
                      {s}
                      {match?.size === s && (
                        <>
                          <span className="ml-1 inline-block h-1.5 w-1.5 -translate-y-0.5 bg-volt ring-1 ring-ink" aria-hidden />
                          <span className="sr-only"> (your fit)</span>
                        </>
                      )}
                    </span>
                    <span className="text-[11px] leading-tight no-underline">{label}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 min-h-5 text-[12px] text-steel-dark" aria-live="polite">
            {error ? "Couldn't check stock. Retrying…" : checked ? "" : "Checking stock…"}
          </p>
          <RestockForm
            key={colour.name}
            slug={slug}
            options={variants.filter((v) => v.colour === colour.name && sellableOf(v.size) <= 0 && !stockFor(v.size)?.inStoreOnly).map((v) => ({ sku: v.sku, size: v.size }))}
          />
        </fieldset>
      )}

      {props.modelNote && <p className="mt-2 text-[13px] text-steel-dark">{props.modelNote}</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {status === "live" ? (
          <>
            {variant && sellable > 0 ? (
              <Link href={`/buy/${slug}?sku=${encodeURIComponent(variant.sku)}`} className="btn btn-volt flex-1">
                Buy now
              </Link>
            ) : (
              <button type="button" disabled className="btn btn-volt flex-1">
                Pick a size
              </button>
            )}
            <button type="button" onClick={addToBag} disabled={!variant || sellable <= 0} className="btn btn-ink flex-1">
              {added ? "Added" : "Add to bag"}
            </button>
          </>
        ) : (
          <>
            <Link href="/alerts" className="btn btn-volt flex-1">
              Notify me
            </Link>
            <Link href="/drops" className="btn btn-outline flex-1">
              {status === "scheduled" ? props.dropLabel ?? "See the drop" : "See the drop"}
            </Link>
          </>
        )}
      </div>
      {status === "sold_out" && (
        <RestockForm key={colour.name} slug={slug} options={variants.filter((v) => v.colour === colour.name).map((v) => ({ sku: v.sku, size: v.size }))} />
      )}
      {status === "live" && (
        <>
          <p className="mt-2 text-[13px] text-steel-dark">Buy now needs no account. The bag needs you to log in.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Link href={`/gift/${slug}`} className="btn btn-outline flex-1">
              <GiftIcon className="h-5 w-5" />
              Send as gift
            </Link>
            <Link href={`/visit?try=${slug}`} className="btn btn-outline flex-1">
              Try in store
            </Link>
          </div>
          <AskWhatsApp className="mt-3" text={`Hi Easypick, a question about ${name} (${colour.name}${size ? `, ${size}` : ""}): `} />
        </>
      )}
      <p className="sr-only" role="status">
        {added ? `${name}, ${colour.name}, size ${size} added to bag` : ""}
      </p>
      {added && (
        <Link href="/bag" className="mt-3 inline-block text-sm font-semibold underline underline-offset-2">
          View bag
        </Link>
      )}
    </div>
  );
}
