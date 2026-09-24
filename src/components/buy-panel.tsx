"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { describeMatch, hasFit, matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import type { Colour, LiveStock, Product, Size } from "@/lib/types";
import { useBag } from "./bag-provider";
import { GiftIcon } from "./icons";
import { FitFinder, useFitProfile } from "./fit-finder";

const POLL_MS = 30_000;

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
  const { add } = useBag();

  const sizes = Array.from(new Set(variants.map((v) => v.size)));
  const oneSize = sizes.length === 1 && sizes[0] === "ONE";

  const [colour, setColour] = useState<Colour>(colours[0]);
  const [size, setSize] = useState<Size | null>(oneSize ? "ONE" : null);
  const [stock, setStock] = useState<LiveStock | null>(null);
  const [error, setError] = useState(false);
  const [added, setAdded] = useState(false);
  const [fitOpen, setFitOpen] = useState(false);
  const profile = useFitProfile();
  const match = matchSize(props.category, props.measurements, profile);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/stock/${slug}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setStock(await res.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, [slug]);

  useEffect(() => {
    if (status !== "live") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first fetch, then poll
    load();
    const id = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(id);
  }, [load, status]);

  const stockFor = (s: Size) => stock?.sizes.find((x) => x.size === s && x.colour === colour.name);
  const selected = size ? stockFor(size) : undefined;
  const sellable = selected ? selected.stock - (selected.inStoreOnly ? 1 : 0) : 0;
  const variant = size ? variants.find((v) => v.size === size && v.colour === colour.name) : undefined;

  function addToBag() {
    if (!variant || sellable <= 0) return;
    add({ slug, sku: variant.sku, name, size: variant.size, colour: colour.name, price });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div>
      <p className="font-mono text-2xl">
        {props.salePrice ? (
          <>
            {formatPrice(props.salePrice)} <s className="text-lg text-steel-dark">{formatPrice(props.price)}</s>
          </>
        ) : (
          formatPrice(props.price)
        )}
      </p>
      <p className="mt-1 text-[13px] text-steel-dark">Price shown. No DM needed. VAT included.</p>

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
            {error ? "Couldn't check stock. Retrying…" : ""}
          </p>
        </fieldset>
      )}

      {props.modelNote && <p className="mt-2 text-[13px] text-steel-dark">{props.modelNote}</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {status === "live" ? (
          <>
            <button type="button" onClick={addToBag} disabled={!variant || sellable <= 0} className="btn btn-volt flex-1">
              {added ? "Added" : size ? "Add to bag" : "Pick a size"}
            </button>
            <Link href={`/visit?try=${slug}`} className="btn btn-outline flex-1">
              Try in store
            </Link>
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
      {status === "live" && (
        <Link href={`/gift/${slug}`} className="btn btn-outline mt-3 w-full">
          <GiftIcon className="h-5 w-5" />
          Send as gift
        </Link>
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
