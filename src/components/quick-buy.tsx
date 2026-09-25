"use client";

import Link from "next/link";
import { useState } from "react";

import { matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import type { Product, Size, Variant } from "@/lib/types";
import { addedMessage, showBagToast, useAddToBag } from "./bag-gate";
import { useBag } from "./bag-provider";
import { useFitProfile } from "./fit-finder";
import { BagIcon, HeartIcon } from "./icons";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./ui/sheet";

// The two buttons on a product card. Both start from the person's saved size when it's in
// stock, otherwise M, otherwise the first size in stock (in the first colour):
//   Quick buy -> a small picker with that choice made, then the Buy now checkout.
//   Heart     -> straight into the bag (tap again to take it out).

const sellable = (v: Variant) => v.stock - (v.lastPieceOnFloor ? 1 : 0) > 0;

function useCardVariant(product: Product): Variant | null {
  const profile = useFitProfile();
  const inStock = product.variants.filter(sellable);
  if (!inStock.length) return null;
  const firstColour = product.colours[0]?.name;
  const fit = matchSize(product.category, product.measurements, profile)?.size;
  for (const size of [fit, "M", "ONE"]) {
    if (!size) continue;
    const v = inStock.find((x) => x.size === size && x.colour === firstColour) ?? inStock.find((x) => x.size === size);
    if (v) return v;
  }
  return inStock.find((x) => x.colour === firstColour) ?? inStock[0];
}

const glass =
  "bg-paper/80 text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors duration-200 [:focus-visible>&]:outline [:focus-visible>&]:outline-2 [:focus-visible>&]:outline-offset-2 [:focus-visible>&]:outline-ink";
// Hidden until hover on hover screens; always shown on phones.
const reveal = "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

/**
 * Quick buy (top right of the photo): a small picker with the first colour and the best
 * available size already chosen, then straight to the Buy now checkout.
 */
export function QuickBuy({ product, className = "" }: { product: Product; className?: string }) {
  const suggested = useCardVariant(product);
  const [open, setOpen] = useState(false);
  const [colour, setColour] = useState<string | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  if (product.status !== "live" || !suggested) return null;

  // Until they change something, show the suggestion.
  const chosenColour = colour ?? suggested.colour;
  const variantsOf = (c: string) => product.variants.filter((v) => v.colour === c).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  const sizes = variantsOf(chosenColour);
  const wanted = size ?? suggested.size;
  const chosen = sizes.find((v) => v.size === wanted && sellable(v)) ?? sizes.find(sellable) ?? null;
  const oneSize = sizes.length === 1 && sizes[0].size === "ONE";
  const colourHex = (c: string) => product.colours.find((x) => x.name === c)?.hex ?? "#ccc";

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
        <button type="button" aria-label={`Quick buy: ${product.name}`} className={`flex h-11 min-w-11 items-center justify-end outline-none transition-opacity duration-200 ${reveal} ${className}`}>
          <span className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 hover:bg-ink hover:text-paper ${glass}`}>
            <BagIcon className="h-4 w-4" />
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] [@media(hover:hover)]:inline">Quick buy</span>
          </span>
        </button>
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
                  const any = variantsOf(c.name).some(sellable);
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
              <div className="mt-3 grid grid-cols-4 gap-2">
                {sizes.map((v) => {
                  const left = v.stock - (v.lastPieceOnFloor ? 1 : 0);
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
            <Link href={`/buy/${product.slug}?sku=${encodeURIComponent(chosen.sku)}`} onClick={() => setOpen(false)} className="btn btn-volt mt-8 w-full">
              Continue to checkout
            </Link>
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
 * The heart (bottom left of the photo): one tap adds it to the bag, another tap takes it out.
 * Logged out → log in first, then it's added.
 */
export function HeartAdd({ product, className = "" }: { product: Product; className?: string }) {
  const variant = useCardVariant(product);
  const { lines, remove } = useBag();
  const addToBag = useAddToBag();
  if (product.status !== "live" || !variant) return null;
  const inBag = lines.some((l) => l.slug === product.slug);

  function onTap() {
    if (inBag) {
      lines.filter((l) => l.slug === product.slug).forEach((l) => remove(l.sku));
      showBagToast(`Removed ${product.name} from your bag.`);
      return;
    }
    const line = { slug: product.slug, sku: variant!.sku, name: product.name, size: variant!.size, colour: variant!.colour, price: product.salePrice ?? product.price };
    if (addToBag([line])) showBagToast(addedMessage(line));
  }

  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={inBag}
      aria-label={inBag ? `Remove ${product.name} from bag` : `Add ${product.name} to bag`}
      className={`flex h-11 w-11 items-center justify-center outline-none transition-opacity duration-200 ${inBag ? "" : reveal} ${className}`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-full ${glass}`}>
        <HeartIcon filled={inBag} className={`h-4 w-4 ${inBag ? "text-[#d70015]" : ""}`} />
      </span>
    </button>
  );
}
