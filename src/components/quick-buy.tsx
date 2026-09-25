"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { Product } from "@/lib/types";
import { BuyPanel } from "./buy-panel";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./ui/sheet";

/** "+" on a product card: pick colour and size, then Buy now or Add to bag, without leaving the page. */
export function QuickBuy({ product, className = "" }: { product: Product; className?: string }) {
  const [open, setOpen] = useState(false);
  if (product.status !== "live") return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={`Quick buy: ${product.name}`}
          className={`grid h-11 w-11 place-items-center rounded-full bg-paper/95 text-ink shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-colors hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
        >
          <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
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
