"use client";

import Link from "next/link";
import { useState } from "react";

import { formatPrice } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import { HangTag } from "./hang-tag";
import { ArrowIcon } from "./icons";
import { GarmentSvg } from "./product-image";

export interface RackPiece {
  product: Product;
  colour: { name: string; hex: string };
}

// How wide each piece hangs relative to its slot, and how far it tucks up under
// the hanger (garment art has headroom above the shoulders).
const fit: Record<Category, { w: string; tuck: string }> = {
  tees: { w: "w-[112%]", tuck: "-mt-[14%]" },
  hoodies: { w: "w-[118%]", tuck: "-mt-[6%]" },
  jackets: { w: "w-[118%]", tuck: "-mt-[12%]" },
  bottoms: { w: "w-[100%]", tuck: "-mt-[8%]" },
  "co-ords": { w: "w-[112%]", tuck: "-mt-[6%]" },
  accessories: { w: "w-[74%]", tuck: "-mt-[28%]" },
};

function Hanger({ category }: { category: Category }) {
  const clip = category === "bottoms";
  const hookOnly = category === "accessories";
  return (
    <svg viewBox="0 0 100 34" className="block w-[70%]" aria-hidden>
      <path d="M50 16 V10 Q50 4 55 4 Q60 4 60 9" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeLinecap="round" />
      {!hookOnly &&
        (clip ? (
          <path d="M50 16 V24 M20 24 H80 M24 24 V32 M76 24 V32" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <path d="M50 16 L8 32 H92 Z" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeLinejoin="round" />
        ))}
    </svg>
  );
}

function sizesLeft(p: Product) {
  const totals = new Map<string, number>();
  for (const v of p.variants) totals.set(v.size, (totals.get(v.size) ?? 0) + v.stock);
  return [...totals.entries()].filter(([s]) => s !== "ONE");
}

/**
 * A clothing rail with one piece of each kind. Tap or hover a piece to bring it
 * forward and read its tag: fixed price and measurements in cm.
 */
export function HeroRack({ pieces, dropLabel }: { pieces: RackPiece[]; dropLabel: string }) {
  // Start on a lighter piece so the first thing you see reads clearly on graphite.
  const [active, setActive] = useState(Math.min(1, pieces.length - 1));
  const sel = pieces[active];
  if (!sel) return null;
  const m = sel.product.measurements.M;
  const sizes = sizesLeft(sel.product);

  return (
    <>
      <p className="index absolute left-4 top-4 z-20 text-paper/70 md:left-6 md:top-6">
        EP / {dropLabel} / {String(active + 1).padStart(2, "0")} of {String(pieces.length).padStart(2, "0")}
      </p>
      <p className="index absolute right-4 top-4 z-20 hidden text-paper/75 md:right-6 md:top-6 md:block">Tap a piece</p>

      {/* The rail */}
      <div className="absolute inset-x-0 top-[15%] h-[3px] bg-paper/25" aria-hidden />

      <ul className="absolute inset-x-0 top-[15%] flex items-start justify-center" aria-label="Pieces on the rail">
        {pieces.map(({ product, colour }, i) => {
          const on = i === active;
          return (
            <li
              key={product.id}
              className={`relative -mx-[35px] w-[150px] shrink-0 md:-mx-[36px] md:w-[170px] lg:-mx-[47px] lg:w-[190px] ${i >= 4 ? "hidden md:block" : ""} ${on ? "z-10" : ""}`}
            >
              <button
                type="button"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                aria-pressed={on}
                aria-label={`${product.name}, ${colour.name}, ${formatPrice(product.salePrice ?? product.price)}`}
                className={`-mt-[7px] flex w-full flex-col items-center transition-[opacity,transform] duration-300 ${
                  on ? "translate-y-1 opacity-100" : "opacity-45 hover:opacity-75"
                }`}
              >
                <Hanger category={product.category} />
                <span className={`block ${fit[product.category].w} ${fit[product.category].tuck}`}>
                  <GarmentSvg category={product.category} colourHex={colour.hex} className="block aspect-[240/230] w-full" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="sr-only" aria-live="polite">
        {sel.product.name}, {sel.colour.name}, {formatPrice(sel.product.salePrice ?? sel.product.price)}
      </p>

      {/* Full tag on larger screens */}
      <div className="absolute bottom-6 right-6 z-20 hidden w-[200px] md:block lg:bottom-8 lg:right-8">
        <div className="origin-top rotate-[3deg]">
          <HangTag key={sel.product.id} product={sel.product} colour={sel.colour.name} className="animate-fade-up" />
        </div>
      </div>
      <div className="absolute bottom-6 left-6 z-20 hidden md:block lg:bottom-8 lg:left-8">
        <p className="text-lg font-semibold">{sel.product.name}</p>
        <p className="index mt-1 text-paper/70">
          {sel.colour.name} · {sel.product.fit} fit
        </p>
        {sizes.length > 0 && (
          <p className="mt-4 flex gap-3 font-mono text-[13px] text-paper/80" aria-label="Sizes left">
            {sizes.map(([s, n]) => (
              <span key={s} className={n === 0 ? "text-paper/60 line-through" : ""}>
                {s}
                {n > 0 && n <= 3 && <sup className="ml-px text-[9px] text-volt">{n}</sup>}
              </span>
            ))}
          </p>
        )}
        <Link href={`/product/${sel.product.slug}`} className="group mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em]">
          View piece
          <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Compact tag on phones */}
      <Link
        href={`/product/${sel.product.slug}`}
        className="absolute inset-x-3 bottom-3 z-20 flex min-h-14 items-center gap-3 bg-paper px-4 py-2 text-ink md:hidden"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{sel.product.name}</span>
          <span className="block font-mono text-[11px] uppercase tracking-[0.08em] text-steel-dark">
            {sel.colour.name}
            {m?.chest ? ` · M · chest ${m.chest} cm` : m?.waist ? ` · M · waist ${m.waist} cm` : ""}
          </span>
        </span>
        <span className="font-mono text-[18px] font-semibold tabular-nums">{formatPrice(sel.product.salePrice ?? sel.product.price)}</span>
        <ArrowIcon className="h-5 w-5 shrink-0" />
      </Link>
    </>
  );
}
