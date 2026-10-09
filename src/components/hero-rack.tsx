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

// The wardrobe is photographs: a steel rail and hangers (public/rack/rail.webp, hanger.webp,
// hanger-clip.webp, made once with scripts/rack-hardware.mjs) and each piece's own product photo cut
// out of its studio background (public/rack/<slug>.webp, from scripts/rack-cutouts.mjs: run it again
// when a product gets a new front photo, and add its slug below). A piece without a cut-out falls
// back to the drawn garment.
const CUTOUTS = new Set([
  "boxy-pocket-tee",
  "brushed-crewneck",
  "coach-jacket",
  "everyday-hoodie",
  "fleece-quarter-zip",
  "oversized-heavy-tee",
  "relaxed-straight-jean",
  "six-panel-cap",
  "tapered-jogger",
  "washed-co-ord-set",
  "wide-cargo-pant",
]);

// How wide each piece hangs relative to its slot, and how far it sits up over its hanger (tops
// cover the hanger's shoulders; trousers hang from its clips; a cap hangs from a short hook).
const fit: Record<Category, { w: string; tuck: string }> = {
  tees: { w: "w-[112%]", tuck: "-mt-[25%]" },
  hoodies: { w: "w-[116%]", tuck: "-mt-[30%]" },
  jackets: { w: "w-[116%]", tuck: "-mt-[28%]" },
  bottoms: { w: "w-[54%]", tuck: "-mt-[7%]" },
  "co-ords": { w: "w-[86%]", tuck: "-mt-[24%]" },
  accessories: { w: "w-[70%]", tuck: "-mt-[2%]" },
};

const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

function Hanger({ category }: { category: Category }) {
  // A cap hangs from a short steel hook, not a hanger.
  if (category === "accessories") return <span className="block h-[22px] w-[2px] rounded-full bg-gradient-to-b from-[#8d8d8d] to-[#5c5c5c]" aria-hidden />;
  const clip = category === "bottoms";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small cut-out photograph, already the size it is shown at
    <img src={clip ? "/rack/hanger-clip.webp" : "/rack/hanger.webp"} alt="" width={clip ? 569 : 652} height={clip ? 327 : 340} className={`block h-auto ${clip ? "w-[62%]" : "w-[78%]"}`} draggable={false} />
  );
}

/**
 * A two-storey shelf: tops on the upper rail; bottoms, jackets and extras on the lower one, up to
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
      {/* The rail: a photographed steel rod, edge to edge */}
      {/* eslint-disable-next-line @next/next/no-img-element -- one thin strip of a photograph, stretched along the rail */}
      <img src="/rack/rail.webp" alt="" aria-hidden draggable={false} className={`absolute inset-x-0 ${at} h-[9px] w-full -translate-y-1/2 object-fill drop-shadow-[0_3px_3px_rgba(0,0,0,0.25)] md:h-[12px]`} />
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
                className={`-mt-[5px] flex w-full cursor-pointer flex-col items-center transition-[filter,transform] duration-300 md:-mt-[7px] ${on ? "translate-y-1.5 [filter:drop-shadow(0_14px_14px_rgba(0,0,0,0.32))]" : "[filter:drop-shadow(0_8px_8px_rgba(0,0,0,0.18))_saturate(0.9)_brightness(0.97)] hover:translate-y-0.5"}`}
              >
                <Hanger category={product.category} />
                <span className={`relative z-10 block ${fit[product.category].w} ${fit[product.category].tuck}`}>
                  {CUTOUTS.has(product.slug) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the piece's own photo, cut out; small and already compressed
                    <img src={`/rack/${product.slug}.webp`} alt="" className="block h-auto w-full" draggable={false} />
                  ) : (
                    <GarmentSvg category={product.category} colourHex={colour.hex} className="block aspect-[240/230] w-full" />
                  )}
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
      {storey(bottom, top.length, "top-[44%] md:top-[42%]", "Bottoms, jackets and extras on the lower rail")}

      <p className="sr-only" aria-live="polite">
        {sel.product.name}, {sel.colour.name}, {formatPrice(sel.product.salePrice ?? sel.product.price)}
      </p>

      {/* The chosen piece: its colour and sizes on the left, its tag on the right (larger screens) */}
      <div className="pointer-events-none absolute inset-x-5 bottom-5 z-20 hidden items-end justify-between gap-6 md:flex lg:inset-x-6 lg:bottom-6">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{sel.product.name}</p>
          <p className="mt-2 flex items-center gap-2 text-[14px] text-ink/75">
            <span aria-hidden className="h-3.5 w-3.5 rounded-full border border-ink/30" style={{ background: sel.colour.hex }} />
            {sel.colour.name}
          </p>
          <p className="mt-2 flex gap-3 font-mono text-[13px] text-ink/85">
            <span className="sr-only">Sizes: </span>
            {oneSize
              ? "One size"
              : sizes.map((v) =>
                  v.stock > 0 ? (
                    <span key={v.sku}>
                      {v.size}
                      {v.stock <= 3 && <sup className="ml-px text-[9px] text-ink/70">{v.stock}</sup>}
                    </span>
                  ) : (
                    <s key={v.sku} className="text-steel-dark">
                      {v.size}
                      <span className="sr-only"> sold out</span>
                    </s>
                  ),
                )}
          </p>
          <Link href={`/product/${sel.product.slug}`} className="group pointer-events-auto mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em]">
            View piece
            <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
        {/* The tag: the piece's fixed price and its measurements in cm */}
        <div className="relative h-[130px] w-[100px] shrink-0" aria-hidden>
          <div className="absolute bottom-0 left-0 w-[200px] origin-bottom-left rotate-[3deg] scale-50">
            <HangTag key={sel.product.id} product={sel.product} colour={sel.colour.name} className="animate-fade-up" />
          </div>
        </div>
      </div>

      {/* Compact bar on phones */}
      <Link href={`/product/${sel.product.slug}`} className="absolute inset-x-3 bottom-3 z-20 flex min-h-14 items-center gap-3 border border-ink/15 bg-paper px-4 py-2 text-ink shadow-[0_8px_18px_-12px_rgba(0,0,0,0.5)] md:hidden">
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
