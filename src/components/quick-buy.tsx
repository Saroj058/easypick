"use client";

import Link from "next/link";
import { useState } from "react";

import { describeMatch, hasFit, matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import { sellable } from "@/lib/inventory";
import { useMySize } from "@/lib/my-size";
import type { Product, Size, Variant } from "@/lib/types";
import { addedMessage, showBagToast, useAddToBag } from "./bag-gate";
import { useFitProfile } from "./fit-finder";
import { BagIcon, HeartIcon } from "./icons";
import { toggleSaved, useList } from "./saved";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./ui/sheet";

// The two buttons on a product card. Quick buy starts from the size that matches the person's
// measurements, else the "My size" they picked on the rail, else M, else the first size in
// stock (in the first colour):
//   Quick buy -> a small picker with that choice made, then the Buy now checkout.
//   Heart     -> Save (this phone's Saved list). Always, signed in or not.

const canBuy = (v: Variant) => sellable(v) > 0;

function useCardVariant(product: Product): Variant | null {
  const profile = useFitProfile();
  const mySize = useMySize();
  const inStock = product.variants.filter(canBuy);
  if (!inStock.length) return null;
  const firstColour = product.colours[0]?.name;
  const fit = matchSize(product.category, product.measurements, profile)?.size;
  for (const size of [fit, mySize, "M", "ONE"]) {
    if (!size) continue;
    const v = inStock.find((x) => x.size === size && x.colour === firstColour) ?? inStock.find((x) => x.size === size);
    if (v) return v;
  }
  return inStock.find((x) => x.colour === firstColour) ?? inStock[0];
}

const glass =
  "bg-paper/80 text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors duration-200 [:focus-visible>&]:outline [:focus-visible>&]:outline-2 [:focus-visible>&]:outline-offset-2 [:focus-visible>&]:outline-ink";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

/**
 * Quick buy (top right of the photo): a small picker with the first colour and the best
 * available size already chosen, then straight to the Buy now checkout.
 */
export function QuickBuy({
  product,
  className = "",
  trigger,
  tabIndex,
}: {
  product: Product;
  className?: string;
  /** What the button shows instead of the round bag on a photo (and then `className` styles the whole button). */
  trigger?: React.ReactNode;
  tabIndex?: number;
}) {
  const suggested = useCardVariant(product);
  const profile = useFitProfile();
  const addToBag = useAddToBag();
  const [open, setOpen] = useState(false);
  const [colour, setColour] = useState<string | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  if (product.status !== "live" || !suggested) return null;

  // Until they change something, show the suggestion.
  const chosenColour = colour ?? suggested.colour;
  const variantsOf = (c: string) => product.variants.filter((v) => v.colour === c).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  const sizes = variantsOf(chosenColour);
  const wanted = size ?? suggested.size;
  const chosen = sizes.find((v) => v.size === wanted && canBuy(v)) ?? sizes.find(canBuy) ?? null;
  const oneSize = sizes.length === 1 && sizes[0].size === "ONE";
  const colourHex = (c: string) => product.colours.find((x) => x.name === c)?.hex ?? "#ccc";
  // "Your fit: M · 2 cm roomier than yours", from the piece they measured once.
  const match = hasFit(profile) ? matchSize(product.category, product.measurements, profile) : null;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setColour(null);
      setSize(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {trigger ? (
          <button type="button" aria-label={`Quick buy: ${product.name}`} tabIndex={tabIndex} className={className}>
            {trigger}
          </button>
        ) : (
          <button type="button" aria-label={`Quick buy: ${product.name}`} tabIndex={tabIndex} className={`flex h-11 min-w-11 items-center justify-end outline-none ${className}`}>
            <span className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 hover:bg-ink hover:text-paper ${glass}`}>
              <BagIcon className="h-4 w-4" />
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] md:[@media(hover:hover)]:inline">Quick buy</span>
            </span>
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[14px] border-mist bg-paper px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-md">
          <span className="mx-auto mb-5 block h-1 w-10 rounded-full bg-mist" aria-hidden />
          <div className="flex items-baseline justify-between gap-4 pr-8">
            <SheetTitle className="display text-[28px] leading-none">{product.name}</SheetTitle>
            <p className="shrink-0 font-mono text-[18px]">{formatPrice(product.salePrice ?? product.price)}</p>
          </div>
          <SheetDescription className="mt-1 text-[14px] text-steel-dark">Check the colour and size, then pay.</SheetDescription>

          {product.colours.length > 1 && (
            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">
                Colour <span className="font-normal text-steel-dark">· {chosenColour}</span>
              </legend>
              <div className="mt-3 flex gap-3">
                {product.colours.map((c) => {
                  const any = variantsOf(c.name).some(canBuy);
                  return (
                    <label key={c.name} className={`relative ${any ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
                      <input
                        type="radio"
                        name={`qb-colour-${product.slug}`}
                        checked={chosenColour === c.name}
                        disabled={!any}
                        onChange={() => setColour(c.name)}
                        className="peer sr-only"
                      />
                      <span
                        className="block h-11 w-11 rounded-full border border-black/10 ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink"
                        style={{ background: colourHex(c.name) }}
                      />
                      <span className="sr-only">
                        {c.name}
                        {any ? "" : " (sold out)"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {!oneSize && (
            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">Size</legend>
              <p className="mt-1 text-[13px] text-steel-dark">
                {match ? (
                  <>
                    Your fit: <span className="font-semibold text-ink">{match.size}</span> · {describeMatch(match).toLowerCase()}
                  </>
                ) : (
                  <Link href="/size-guide" onClick={() => setOpen(false)} className="underline underline-offset-2">
                    Not sure? Match your size in cm
                  </Link>
                )}
              </p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {sizes.map((v) => {
                  const left = sellable(v);
                  const out = left <= 0;
                  return (
                    <label key={v.sku} className={out ? "cursor-not-allowed" : "cursor-pointer"}>
                      <input
                        type="radio"
                        name={`qb-size-${product.slug}`}
                        checked={chosen?.sku === v.sku}
                        disabled={out}
                        onChange={() => setSize(v.size)}
                        className="peer sr-only"
                      />
                      <span
                        className={`flex h-[56px] flex-col items-center justify-center rounded-[2px] border text-center peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
                          out ? "border-mist bg-photo text-steel line-through" : "border-mist hover:border-ink"
                        }`}
                      >
                        <span className="font-mono text-base font-semibold">{v.size}</span>
                        <span className="text-[11px] leading-tight">{out ? "Sold out" : left <= 3 ? `${left} left` : ""}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {chosen ? (
            <>
              <Link href={`/buy/${product.slug}?sku=${encodeURIComponent(chosen.sku)}`} onClick={() => setOpen(false)} className="btn btn-volt mt-8 w-full">
                Buy now
              </Link>
              <button
                type="button"
                onClick={() => {
                  const line = { slug: product.slug, sku: chosen.sku, name: product.name, size: chosen.size, colour: chosen.colour, price: product.salePrice ?? product.price };
                  if (addToBag([line])) showBagToast(addedMessage(line));
                  setOpen(false);
                }}
                className="btn btn-outline mt-3 w-full"
              >
                Add to bag
              </button>
            </>
          ) : (
            <button type="button" disabled className="btn btn-volt mt-8 w-full">
              Sold out in {chosenColour}
            </button>
          )}
          <Link href={`/product/${product.slug}`} onClick={() => setOpen(false)} className="mt-4 block text-center text-[14px] underline underline-offset-2">
            See full details
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The heart (bottom left of the photo) always means Save: it keeps the piece in this phone's
 * Saved list. Adding to the bag is in Quick buy, under the bag icon.
 */
export function HeartAdd({ product, className = "" }: { product: Product; className?: string }) {
  const saved = useList("saved").includes(product.slug);
  if (product.status !== "live") return null;

  function onTap() {
    toggleSaved(product.slug);
    showBagToast(saved ? `Removed ${product.name} from Saved.` : `Saved ${product.name}. Find it under Saved.`);
  }

  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={saved}
      aria-label={`Save ${product.name}`}
      className={`flex h-11 w-11 items-center justify-center outline-none ${className}`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-full ${glass}`}>
        <HeartIcon filled={saved} className={`h-4 w-4 ${saved ? "text-[#d70015]" : ""}`} />
      </span>
    </button>
  );
}
