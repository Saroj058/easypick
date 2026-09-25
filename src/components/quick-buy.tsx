"use client";

import Link from "next/link";
import { useState } from "react";

import type { Product } from "@/lib/types";
import { useBag } from "./bag-provider";
import { BuyPanel } from "./buy-panel";
import { BagIcon } from "./icons";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./ui/sheet";

const Heart = ({ filled, className }: { filled: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
    <path d="M12 20.5s-7.5-4.6-9.2-9.1C1.6 8.2 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.6 3.7 4.4 6.9-1.7 4.5-9.2 9.1-9.2 9.1Z" />
  </svg>
);

/**
 * Buttons on a product card that open a sheet to pick colour and size without leaving the page.
 *   "buy": Quick buy (top right of the photo), Buy now leads.
 *   "bag": the heart (bottom left), Add to bag leads; it turns red once the piece is in the bag.
 */
export function QuickBuy({ product, mode = "buy", className = "" }: { product: Product; mode?: "buy" | "bag"; className?: string }) {
  const [open, setOpen] = useState(false);
  const { lines } = useBag();
  if (product.status !== "live") return null;
  const inBag = lines.some((l) => l.slug === product.slug);
  const glass =
    "bg-paper/80 text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors duration-200 [button:focus-visible_&]:outline [button:focus-visible_&]:outline-2 [button:focus-visible_&]:outline-offset-2 [button:focus-visible_&]:outline-ink";
  // Hidden until hover on hover screens (unless the heart is already red); always shown on phones.
  const reveal = "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {mode === "buy" ? (
          <button type="button" aria-label={`Quick buy: ${product.name}`} className={`flex h-11 min-w-11 items-center justify-end outline-none transition-opacity duration-200 ${reveal} ${className}`}>
            <span className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 hover:bg-ink hover:text-paper ${glass}`}>
              <BagIcon className="h-4 w-4" />
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] [@media(hover:hover)]:inline">Quick buy</span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            aria-label={inBag ? `${product.name} is in your bag. Add another` : `Add to bag: ${product.name}`}
            className={`flex h-11 w-11 items-center justify-center outline-none transition-opacity duration-200 ${inBag ? "" : reveal} ${className}`}
          >
            <span className={`grid h-9 w-9 place-items-center rounded-full ${glass}`}>
              <Heart filled={inBag} className={`h-4 w-4 ${inBag ? "text-[#d70015]" : ""}`} />
            </span>
          </button>
        )}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto rounded-t-[14px] border-mist bg-paper px-4 pb-[calc(28px+env(safe-area-inset-bottom))] pt-3"
      >
        <div className="mx-auto max-w-lg">
          <span className="mx-auto mb-5 block h-1 w-10 rounded-full bg-mist" aria-hidden />
          <SheetTitle className="display pr-10 text-[32px] leading-none">{product.name}</SheetTitle>
          <SheetDescription className="mt-2 text-[14px] text-steel-dark">
            {product.shortDescription}{" "}
            <Link href={`/product/${product.slug}`} className="whitespace-nowrap font-semibold text-ink underline underline-offset-2">
              Full details
            </Link>
          </SheetDescription>
          <div className="mt-5">
            <BuyPanel
              compact
              lead={mode}
              slug={product.slug}
              name={product.name}
              price={product.price}
              salePrice={product.salePrice}
              colours={product.colours}
              variants={product.variants}
              status={product.status}
              fit={product.fit}
              category={product.category}
              measurements={product.measurements}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
