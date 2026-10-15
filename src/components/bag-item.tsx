"use client";

import { Minus, Plus, X } from "lucide-react";
import Link from "next/link";

import { useCatalogue } from "@/lib/catalogue-client";
import { formatPrice } from "@/lib/format";
import type { Size } from "@/lib/types";
import { ProductImage } from "./product-image";

// One piece in the bag or the gift bag: its photo, name, colour and size, the quantity (bag only)
// and a small remove button. Photos come from the catalogue the browser already loads once.

export function BagItem({
  slug,
  name,
  colour,
  size,
  price,
  qty,
  onQty,
  onRemove,
  href = `/product/${slug}`,
}: {
  slug: string;
  name: string;
  colour: string;
  size: Size;
  price: number;
  /** With onQty: a quantity stepper. */
  qty?: number;
  onQty?: (n: number) => void;
  onRemove: () => void;
  href?: string;
}) {
  const catalogue = useCatalogue(true);
  const product = catalogue?.find((p) => p.slug === slug);
  const hex = product?.colours.find((c) => c.name === colour)?.hex ?? product?.colours[0]?.hex ?? "#888888";
  const n = qty ?? 1;

  return (
    <li className="relative flex gap-4 rounded-2xl border border-ink/10 bg-paper p-3 pr-4 md:gap-5">
      <Link href={href} className="relative block h-[112px] w-[90px] shrink-0 overflow-hidden rounded-xl bg-[#efefef] md:h-[132px] md:w-[106px]" tabIndex={-1} aria-hidden>
        {product && (
          <span className="absolute inset-x-0 -top-[4%] block">
            <ProductImage image={product.images[0] ?? { src: null, alt: name, kind: "front" }} category={product.category} colourHex={hex} decorative sizes="110px" />
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <Link href={href} className="pr-9 font-semibold leading-snug hover:underline">
          {name}
        </Link>
        <p className="mt-0.5 text-[13.5px] text-steel-dark">
          {colour} · {size === "ONE" ? "One size" : size}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          {onQty ? (
            <div className="inline-flex h-9 items-center rounded-full border border-ink/15" role="group" aria-label={`Quantity for ${name}`}>
              <button type="button" onClick={() => onQty(n - 1)} disabled={n <= 1} aria-label="One fewer" className="grid h-9 w-9 cursor-pointer place-items-center rounded-full disabled:cursor-default disabled:opacity-30">
                <Minus aria-hidden className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-6 text-center font-mono text-[14px] tabular-nums" aria-live="polite">
                {n}
              </span>
              <button type="button" onClick={() => onQty(n + 1)} disabled={n >= 5} aria-label="One more" className="grid h-9 w-9 cursor-pointer place-items-center rounded-full disabled:cursor-default disabled:opacity-30">
                <Plus aria-hidden className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <span />
          )}
          <p className="font-mono text-[15px] font-semibold tabular-nums">{formatPrice(price * n)}</p>
        </div>
      </div>
      <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="absolute right-2 top-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full text-steel-dark transition-colors hover:bg-mist hover:text-ink">
        <X aria-hidden className="h-4 w-4" />
      </button>
    </li>
  );
}
