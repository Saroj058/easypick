"use client";

import Link from "next/link";
import { useState } from "react";

import { formatPrice } from "@/lib/format";
import type { Category, Product, Size } from "@/lib/types";
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

const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

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

/**
 * A two-storey shelf: tops on the upper rail, bottoms and extras on the lower one, up to
 * seven pieces each. Tap or hover a piece to bring it forward; its colour and the sizes it
 * comes in show at the bottom left, and its tag (price, measurements in cm) at the bottom right.
 */
export function HeroRack({ top, bottom }: { top: RackPiece[]; bottom: RackPiece[] }) {
  const all = [...top, ...bottom];
  // Start on a piece near the middle of the upper rail.
  const [active, setActive] = useState(Math.min(Math.floor(top.length / 2), Math.max(all.length - 1, 0)));
  const sel = all[active];
  if (!sel) return null;
  const sizes = sel.product.variants.filter((v) => v.colour === sel.colour.name).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
  const oneSize = sizes.length === 1 && sizes[0].size === "ONE";

  const storey = (pieces: RackPiece[], offset: number, at: string, label: string) => (
    <>
      <div className={`absolute inset-x-0 ${at} h-[3px] bg-paper/25`} aria-hidden />
      <ul className={`absolute inset-x-0 ${at} flex items-start justify-center`} aria-label={label}>
        {pieces.map(({ product, colour }, n) => {
          const i = offset + n;
          const on = i === active;
          return (
            <li key={product.id} className={`relative -mx-[22px] w-[96px] shrink-0 sm:-mx-[26px] sm:w-[120px] xl:-mx-[30px] xl:w-[150px] ${on ? "z-10" : ""}`}>
              <button
                type="button"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                aria-pressed={on}
                aria-label={`${product.name}, ${colour.name}, ${formatPrice(product.salePrice ?? product.price)}`}
                className={`-mt-[7px] flex w-full flex-col items-center transition-[opacity,transform] duration-300 ${on ? "translate-y-1 opacity-100" : "opacity-55 hover:opacity-80"}`}
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
    </>
  );

  return (
    <>
      {storey(top, 0, "top-[6%]", "Tops on the upper rail")}
      {storey(bottom, top.length, "top-[44%] md:top-[47%]", "Bottoms and extras on the lower rail")}

      <p className="sr-only" aria-live="polite">
        {sel.product.name}, {sel.colour.name}, {formatPrice(sel.product.salePrice ?? sel.product.price)}
      </p>

      {/* The chosen piece: its colour and sizes on the left, its tag on the right (larger screens) */}
      <div className="absolute inset-x-5 bottom-5 z-20 hidden items-end justify-between gap-6 md:flex lg:inset-x-6 lg:bottom-6">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{sel.product.name}</p>
          <p className="mt-2 flex items-center gap-2 text-[14px] text-paper/80">
            <span aria-hidden className="h-3.5 w-3.5 rounded-full border border-paper/40" style={{ background: sel.colour.hex }} />
            {sel.colour.name}
          </p>
          <p className="mt-2 flex gap-3 font-mono text-[13px] text-paper/85">
            <span className="sr-only">Sizes: </span>
            {oneSize
              ? "One size"
              : sizes.map((v) =>
                  v.stock > 0 ? (
                    <span key={v.sku}>
                      {v.size}
                      {v.stock <= 3 && <sup className="ml-px text-[9px] text-paper/70">{v.stock}</sup>}
                    </span>
                  ) : (
                    <s key={v.sku} className="text-paper/60">
                      {v.size}
                      <span className="sr-only"> sold out</span>
                    </s>
                  ),
                )}
          </p>
          <Link href={`/product/${sel.product.slug}`} className="group mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em]">
            View piece
            <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
        {/* The tag: the piece's fixed price and its measurements in cm */}
        <div className="w-[132px] shrink-0" aria-hidden>
          <div className="w-[200px] origin-bottom-left rotate-[3deg] scale-[0.66]">
            <HangTag key={sel.product.id} product={sel.product} colour={sel.colour.name} className="animate-fade-up" />
          </div>
        </div>
      </div>

      {/* Compact bar on phones */}
      <Link href={`/product/${sel.product.slug}`} className="absolute inset-x-3 bottom-3 z-20 flex min-h-14 items-center gap-3 bg-paper px-4 py-2 text-ink md:hidden">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{sel.product.name}</span>
          <span className="block truncate font-mono text-[11px] uppercase tracking-[0.08em] text-steel-dark">
            {sel.colour.name}
            {oneSize
              ? " · one size"
              : ` · ${sizes
                  .filter((v) => v.stock > 0)
                  .map((v) => v.size)
                  .join(" ")}`}
          </span>
        </span>
        <span className="font-mono text-[18px] font-semibold tabular-nums">{formatPrice(sel.product.salePrice ?? sel.product.price)}</span>
        <ArrowIcon className="h-5 w-5 shrink-0" />
      </Link>
    </>
  );
}
