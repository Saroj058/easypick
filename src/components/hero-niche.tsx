"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { formatPrice } from "@/lib/format";
import type { Product, Size } from "@/lib/types";
import { HangTag } from "./hang-tag";
import { ArrowIcon } from "./icons";

// The home page's wardrobe: the owner's photograph of it (public/rack/wardrobe.webp, 9 Oct 2026) — a
// white recess with an accessories shelf, two steel rails of five hangers, and an empty compartment
// at the bottom.
//
// The clothes are part of the photograph, so each one has a see-through button laid over it, placed
// by the piece's slug (SPOTS). Picking a piece (pointing at it, tapping it, or tabbing to it) shows
// its name, colour, sizes and hang tag in the empty bottom compartment, with the way to its page.
// A new photograph needs its pieces measured again here.

export interface NichePiece {
  product: Product;
  colour: { name: string; hex: string };
}

const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

/** Where each piece is in the photograph, in percent of its width and height: left, top, width, height. */
const SPOTS: Record<string, [number, number, number, number]> = {
  "six-panel-cap": [18, 6, 9.5, 8.5],
  "oversized-heavy-tee": [9.2, 18.5, 16.2, 22.5],
  "everyday-hoodie": [25.4, 17.5, 17.6, 25.5],
  "boxy-pocket-tee": [42.4, 18.5, 12.3, 23],
  "brushed-crewneck": [58.6, 18.5, 17.6, 24],
  "washed-co-ord-set": [76.6, 18.5, 14.6, 26],
  "tapered-jogger": [12, 51, 10.2, 27],
  "coach-jacket": [25.4, 49, 17, 24],
  "relaxed-straight-jean": [45, 51, 10.8, 27.5],
  "fleece-quarter-zip": [58.4, 49, 17.8, 25.5],
  "wide-cargo-pant": [77, 51, 11.8, 25.5],
};

export function HeroNiche({ upper, lower, cap }: { /** The pieces on the first rail. */ upper: NichePiece[]; /** The pieces on the second. */ lower: NichePiece[]; /** The cap on the accessories shelf, if it is on sale. */ cap: NichePiece | null }) {
  const all = [...upper, ...lower, ...(cap ? [cap] : [])].filter((p) => p.product.slug in SPOTS);
  const [activeSlug, setActiveSlug] = useState(all.find((p) => p.product.slug === "everyday-hoodie")?.product.slug ?? all[0]?.product.slug ?? null);
  const sel = all.find((p) => p.product.slug === activeSlug) ?? all[0] ?? null;
  const sizes = sel ? sel.product.variants.filter((v) => v.colour === sel.colour.name).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)) : [];
  const oneSize = sizes.length === 1 && sizes[0].size === "ONE";

  return (
    <div className="relative">
      <div role="group" aria-label="The Easypick wardrobe: pieces from the shop, hung in a lit white hollow" className="relative -mx-4 aspect-[1408/1136] overflow-hidden bg-[#f4f2ee] md:-mx-8 lg:mx-0">
        <Image src="/rack/wardrobe.webp" alt="" fill priority sizes="(min-width: 1024px) 58vw, 100vw" className="object-cover" />
        {/* One see-through button over each piece; the picked one gets a quiet frame */}
        {all.map((piece) => {
          const [left, top, width, height] = SPOTS[piece.product.slug];
          const on = piece.product.slug === activeSlug;
          return (
            <button
              key={piece.product.slug}
              type="button"
              onClick={() => setActiveSlug(piece.product.slug)}
              onMouseEnter={() => setActiveSlug(piece.product.slug)}
              onFocus={() => setActiveSlug(piece.product.slug)}
              aria-pressed={on}
              aria-label={`${piece.product.name}, ${piece.colour.name}, ${formatPrice(piece.product.salePrice ?? piece.product.price)}`}
              className={`absolute cursor-pointer rounded-xl transition-[background-color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${on ? "bg-ink/[0.035] shadow-[0_0_0_1px_rgba(0,0,0,0.22)]" : ""}`}
              style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
            />
          );
        })}
      </div>

      {/* The picked piece: in the wardrobe's empty bottom compartment; on a phone, where that is too small, under the picture. */}
      {sel && (
        <div className="mt-3 flex items-center justify-between gap-3 md:absolute md:inset-x-[7%] md:bottom-[3.5%] md:top-[81%] md:mt-0 lg:inset-x-[7.5%]">
          <div className="min-w-0" aria-live="polite">
            <p className="truncate text-[15px] font-semibold md:text-lg">{sel.product.name}</p>
            <p className="flex items-center gap-2 text-[13px] text-ink/75 md:text-[14px]">
              <span aria-hidden className="h-3 w-3 rounded-full border border-ink/30 md:h-3.5 md:w-3.5" style={{ background: sel.colour.hex }} />
              {sel.colour.name}
              <span className="font-mono text-ink md:hidden">· {formatPrice(sel.product.salePrice ?? sel.product.price)}</span>
            </p>
            <p className="flex gap-2.5 font-mono text-[12px] text-ink/85 md:gap-3 md:text-[13px]">
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
          </div>
          <Link href={`/product/${sel.product.slug}`} className="group inline-flex min-h-11 shrink-0 items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] md:text-sm">
            View piece
            <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
          {/* The tag: the piece's fixed price and its measurements in cm */}
          <div className="relative h-[88px] w-[68px] shrink-0 self-end max-md:hidden" aria-hidden>
            <div className="absolute bottom-0 left-0 w-[200px] origin-bottom-left rotate-[3deg] scale-[0.34] [filter:drop-shadow(0_6px_10px_rgba(0,0,0,0.18))]">
              <HangTag key={sel.product.id} product={sel.product} colour={sel.colour.name} className="animate-fade-up [--hole:var(--color-mist)]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
