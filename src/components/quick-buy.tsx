"use client";

import Link from "next/link";

import { matchSize } from "@/lib/fit-profile";
import type { Product, Variant } from "@/lib/types";
import { addedMessage, showBagToast, useAddToBag } from "./bag-gate";
import { useBag } from "./bag-provider";
import { useFitProfile } from "./fit-finder";
import { BagIcon } from "./icons";

// The two one-tap buttons on a product card. Neither asks for a size: they use the
// person's saved size when it's in stock, otherwise M, otherwise the first size in stock.
// The size can be changed in the bag or on the product page.

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

/** Quick buy (top right of the photo): straight to the Buy now checkout. */
export function QuickBuy({ product, className = "" }: { product: Product; className?: string }) {
  const variant = useCardVariant(product);
  if (product.status !== "live" || !variant) return null;
  const size = variant.size === "ONE" ? "" : `, size ${variant.size}`;
  return (
    <Link
      href={`/buy/${product.slug}?sku=${encodeURIComponent(variant.sku)}`}
      aria-label={`Quick buy: ${product.name} (${variant.colour}${size})`}
      className={`flex h-11 min-w-11 items-center justify-end outline-none transition-opacity duration-200 ${reveal} ${className}`}
    >
      <span className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 hover:bg-ink hover:text-paper ${glass}`}>
        <BagIcon className="h-4 w-4" />
        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] [@media(hover:hover)]:inline">Quick buy</span>
      </span>
    </Link>
  );
}

const Heart = ({ filled, className }: { filled: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
    <path d="M12 20.5s-7.5-4.6-9.2-9.1C1.6 8.2 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.6 3.7 4.4 6.9-1.7 4.5-9.2 9.1-9.2 9.1Z" />
  </svg>
);

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
        <Heart filled={inBag} className={`h-4 w-4 ${inBag ? "text-[#d70015]" : ""}`} />
      </span>
    </button>
  );
}
