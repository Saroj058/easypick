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
  tees: { w: "w-[104%]", tuck: "-mt-[21%]" },
  hoodies: { w: "w-[108%]", tuck: "-mt-[27%]" },
  jackets: { w: "w-[108%]", tuck: "-mt-[25%]" },
  bottoms: { w: "w-[58%]", tuck: "-mt-[7%]" },
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
 * a few pieces each, with room between them. Tap or hover a piece to bring it forward; its colour and the sizes it
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
      {/* The shelf above the rail, and the warm light under it washing down the wall */}
      <div className={`absolute inset-x-[3%] ${at} h-[26%] -translate-y-[14px] bg-[linear-gradient(180deg,rgba(255,226,178,0.95)_0%,rgba(255,236,205,0.45)_30%,transparent_100%)] blur-[5px] md:-translate-y-[20px]`} aria-hidden />
      <div className={`absolute inset-x-[2%] ${at} h-[7px] -translate-y-[20px] rounded-[1px] bg-[#fdfbf7] shadow-[0_3px_5px_rgba(90,70,40,0.28)] md:h-[10px] md:-translate-y-[30px]`} aria-hidden />
      {/* The rail: a photographed steel rod under the shelf */}
      {/* eslint-disable-next-line @next/next/no-img-element -- one thin strip of a photograph, stretched along the rail */}
      <img src="/rack/rail.webp" alt="" aria-hidden draggable={false} className={`absolute inset-x-[4%] ${at} z-[1] h-[5px] w-[92%] -translate-y-1/2 object-fill drop-shadow-[0_4px_3px_rgba(90,70,40,0.3)] md:h-[7px]`} />
      <ul className={`absolute inset-x-[5%] ${at} flex items-start justify-between`} aria-label={label}>
        {pieces.map(({ product, colour }, n) => {
          const i = offset + n;
          const on = i === active;
          return (
            <li key={product.id} className={`relative w-[18%] shrink-0 ${on ? "z-10" : ""}`}>
              <button
                type="button"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                aria-pressed={on}
                aria-label={`${product.name}, ${colour.name}, ${formatPrice(product.salePrice ?? product.price)}`}
                className={`-mt-[3px] flex w-full cursor-pointer flex-col items-center transition-[filter,transform] duration-300 md:-mt-[5px] origin-top ${on ? "rotate-[1.2deg] [filter:drop-shadow(4px_12px_10px_rgba(90,70,40,0.4))]" : "[filter:drop-shadow(2px_7px_6px_rgba(90,70,40,0.28))] hover:rotate-[0.6deg]"}`}
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
      {storey(top, 0, "top-[9%]", "Tops on the upper rail")}
      {storey(bottom, top.length, "top-[46%] md:top-[45%]", "Bottoms, jackets and extras on the lower rail")}

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
