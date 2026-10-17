"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import type { Category, ProductImage as Img } from "@/lib/types";
import { ProductImage } from "./product-image";

// The Vault's featured piece, on a plinth (light since 17 Oct 2026, after ten specialists' plans):
// one piece standing on the shelf grey with its brand faint and huge behind it; under it the name,
// the sizes it comes in (gone ones struck through: nothing to pick here, it's bought on its own
// page), the price inside the one button, and "Try it in store". Previous and next by hand only:
// nothing plays on its own. Shown on wide screens; phones go straight to the shelves.

export interface HeroPiece {
  slug: string;
  brand: string;
  model: string;
  /** "07 / 20" or "". */
  label: string;
  sizes: { size: string; left: boolean }[];
  colour: string;
  hex: string;
  price: string;
  sold: boolean;
  image: Img;
  category: Category;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const two = (n: number) => String(n).padStart(2, "0");

export function VaultHero({ pieces }: { pieces: HeroPiece[] }) {
  return (
    <MotionConfig reducedMotion="user">
      <Plinth pieces={pieces} />
    </MotionConfig>
  );
}

function Plinth({ pieces }: { pieces: HeroPiece[] }) {
  const still = useReducedMotion();
  const [at, setAt] = useState(0);
  const p = pieces[at];
  if (!p) return null;
  const go = (d: number) => setAt((a) => (a + d + pieces.length) % pieces.length);

  return (
    <section aria-roledescription="carousel" aria-label="Featured in the Vault" className="relative">
      <p className="sr-only" aria-live="polite">
        Piece {at + 1} of {pieces.length}: {p.brand} {p.model}, {p.sold ? "sold" : p.price}.
      </p>
      {/* The plinth: the piece on the shelf grey, its brand huge and faint behind it */}
      <div className="relative overflow-hidden bg-[#ededeb]">
        <AnimatePresence initial={false}>
          <motion.p
            key={`w-${p.slug}`}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.8, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            className="display pointer-events-none absolute inset-x-0 top-[8%] select-none whitespace-nowrap text-center text-[clamp(4rem,9vw,8.5rem)] leading-none text-ink/[0.05]"
          >
            {p.brand}
          </motion.p>
        </AnimatePresence>
        <div className="relative mx-auto w-[min(78%,340px)] pb-6 pt-10">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div key={p.slug} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.6, ease: EASE } }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
              <Link href={`/product/${p.slug}`} tabIndex={-1} aria-hidden className={`block ${p.sold ? "opacity-50 grayscale" : ""}`}>
                <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative priority={at === 0} ground="bg-transparent" className="[&_img]:mix-blend-multiply" sizes="340px" />
              </Link>
              <span aria-hidden className="mx-auto -mt-4 block h-3 w-[58%] rounded-[50%] bg-ink/[0.14] blur-[8px]" />
            </motion.div>
          </AnimatePresence>
        </div>
        {/* Where you are, and the way through */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 pb-2">
          <button type="button" onClick={() => go(-1)} aria-label="Previous piece" className="grid h-11 w-11 cursor-pointer place-items-center rounded-full transition-colors hover:bg-ink/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span aria-hidden className="font-mono text-[11px] tabular-nums text-[#55575c]">
            <span className="text-ink">{two(at + 1)}</span> —— {two(pieces.length)}
          </span>
          <button type="button" onClick={() => go(1)} aria-label="Next piece" className="grid h-11 w-11 cursor-pointer place-items-center rounded-full transition-colors hover:bg-ink/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* The piece's label */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={p.slug}
          initial={still ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-4"
        >
          <p className="min-w-0">
            <span className="display block text-[30px] leading-none">{p.brand}</span>
            <span className="mt-1 block text-[15px] text-[#55575c]">
              {p.model}
              {p.label && <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.12em]">No. {p.label}</span>}
            </span>
          </p>
          <dl className="mt-3 grid grid-cols-[64px_minmax(0,1fr)] gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#55575c]">
            <dt>Size</dt>
            <dd className="flex flex-wrap gap-x-3">
              {p.sizes.map((s) => (
                <span key={s.size} className={s.left ? "text-ink" : "text-[#5f6166] line-through"}>
                  {s.size === "ONE" ? "One size" : s.size}
                  {!s.left && <span className="sr-only"> (gone)</span>}
                </span>
              ))}
            </dd>
            <dt>Colour</dt>
            <dd className="flex items-center gap-2 text-ink">
              <span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-ink/15" style={{ background: p.hex }} />
              {p.colour}
            </dd>
          </dl>
          <div className="mt-4 flex items-center gap-4">
            <Link
              href={`/product/${p.slug}`}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[13px] font-semibold uppercase tracking-[0.06em] text-paper transition-[background-color,scale] hover:bg-[#2c2c2e] active:scale-[0.98]"
            >
              {p.sold ? "See the piece" : `View piece — ${p.price}`}
            </Link>
            <Link href="/visit" className="text-[13px] font-semibold underline-offset-4 hover:underline">
              Try it in store
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
