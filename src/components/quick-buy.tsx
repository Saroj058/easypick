"use client";

import Link from "next/link";
import { useState } from "react";

import type { Product } from "@/lib/types";
import { BuyPanel } from "./buy-panel";
import { BagIcon } from "./icons";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./ui/sheet";

/** Small bag button on a product card: pick colour and size, then Buy now or Add to bag, without leaving the page. */
export function QuickBuy({ product, className = "" }: { product: Product; className?: string }) {
  const [open, setOpen] = useState(false);
  if (product.status !== "live") return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* 44px tap area around a quieter 36px glass chip. On hover screens it only shows on hover
            (or keyboard focus) and opens out to say "Quick buy". */}
        <button
          type="button"
          aria-label={`Quick buy: ${product.name}`}
          className={`peer/qb flex h-11 min-w-11 items-center justify-end outline-none transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 ${className}`}
        >
          <span className="flex h-9 items-center gap-1.5 rounded-full bg-paper/80 px-2.5 text-ink ring-1 ring-ink/10 backdrop-blur-md transition-colors duration-200 hover:bg-ink hover:text-paper [button:focus-visible_&]:outline [button:focus-visible_&]:outline-2 [button:focus-visible_&]:outline-offset-2 [button:focus-visible_&]:outline-ink">
            <BagIcon className="h-4 w-4" />
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] [@media(hover:hover)]:inline">Quick buy</span>
          </span>
        </button>
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
