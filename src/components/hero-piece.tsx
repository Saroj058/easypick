"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";
import { HangTag } from "./hang-tag";

// The home page's opening picture: one piece, large on the white page, with its price tag hanging
// beside it. The price on the tag is the price; that is the whole pitch, so nothing else is here.
// A row of small pieces under it switches which one is shown (pointing, tapping or tabbing; left
// alone it moves on by itself), and
// the piece itself leads to its page. The pictures are the products' own photos, cut out
// (public/rack/<slug>.webp, from scripts/rack-cutouts.mjs).

export interface HeroPieceItem {
  product: Product;
  colour: { name: string; hex: string };
  /** Why it can't be bought today ("Sold out", "Coming soon"), if it can't. */
  note?: string | null;
}

/** How long a piece is shown before the next takes its place. */
const CHANGE_MS = 7000;

export function HeroPiece({ pieces }: { pieces: HeroPieceItem[] }) {
  const [slug, setSlug] = useState(pieces[0]?.product.slug ?? null);
  const still = useReducedMotion();
  const sel = pieces.find((p) => p.product.slug === slug) ?? pieces[0];
  // Left alone, it moves to the next piece every seven seconds. It waits while someone is pointing
  // at it or tabbing through it, while the page is in the background, and for people who have asked
  // for less motion.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held || still || pieces.length < 2) return;
    const timer = setTimeout(() => {
      if (document.hidden) return;
      const at = pieces.findIndex((p) => p.product.slug === slug);
      setSlug(pieces[(at + 1) % pieces.length].product.slug);
    }, CHANGE_MS);
    return () => clearTimeout(timer);
  }, [slug, held, still, pieces]);
  if (!sel) return null;
  const price = formatPrice(sel.product.salePrice ?? sel.product.price);

  return (
    <div onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
      <div className="relative mx-auto aspect-[5/4] w-full max-w-[720px]">
        {/* A soft pool of shade, so the piece sits on the page instead of floating */}
        <div aria-hidden className="absolute inset-x-[18%] bottom-[3%] h-[7%] rounded-[50%] bg-ink/15 blur-xl" />

        {/* The piece: it leads to its own page */}
        <Link href={`/product/${sel.product.slug}`} aria-label={`${sel.product.name}, ${sel.colour.name}, ${price}${sel.note ? `, ${sel.note.toLowerCase()}` : ""}`} className="group absolute inset-y-0 left-0 right-[18%] block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink md:right-[24%]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={sel.product.slug}
              src={`/rack/${sel.product.slug}.webp`}
              alt=""
              draggable={false}
              initial={still ? false : { opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={still ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 h-full w-full object-contain [filter:drop-shadow(0_22px_26px_rgba(0,0,0,0.2))] transition-transform duration-500 ease-out group-hover:-translate-y-1.5"
            />
          </AnimatePresence>
        </Link>

        {/* Not on sale today: said plainly, under the piece */}
        {sel.note && <p className="index absolute bottom-0 left-0 rounded-full bg-ink px-3 py-1.5 text-paper">{sel.note}</p>}

        {/* Its tag, on a string: it swings once each time the piece changes */}
        <div className="pointer-events-none absolute right-0 top-[10%] flex w-[92px] flex-col items-center md:top-[16%] md:w-[152px]" aria-hidden>
          <motion.div
            key={sel.product.slug}
            initial={still ? false : { rotate: 9 }}
            animate={{ rotate: [9, -6, 3.5, -1.5, 0].slice(still ? 4 : 0) }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="flex origin-top flex-col items-center"
          >
            <span className="block h-10 w-px bg-ink/40 md:h-16" />
            <div className="-mt-3 h-[128px] w-[92px] md:h-[210px] md:w-[152px]">
              <div className="w-[200px] origin-top-left scale-[0.46] [filter:drop-shadow(0_10px_16px_rgba(0,0,0,0.18))] md:scale-[0.76]">
                <HangTag product={sel.product} colour={sel.colour.name} className="[--hole:var(--color-paper)]" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* The other pieces: pick one to see it and its price */}
      <ul aria-label="Pieces from the shop" className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 md:mx-auto md:w-fit md:max-w-full md:gap-1 md:px-0">
        {pieces.map((p) => {
          const on = p.product.slug === sel.product.slug;
          return (
            <li key={p.product.slug} className="shrink-0">
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${p.product.name}, ${formatPrice(p.product.salePrice ?? p.product.price)}`}
                onClick={() => setSlug(p.product.slug)}
                onMouseEnter={() => setSlug(p.product.slug)}
                onFocus={() => setSlug(p.product.slug)}
                className={`relative flex h-16 w-14 cursor-pointer items-center justify-center rounded-lg p-1.5 transition-[background-color,opacity] duration-200 after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:origin-center after:bg-ink after:transition-transform after:duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:h-[72px] md:w-[58px] ${on ? "bg-mist after:scale-x-100" : "opacity-60 after:scale-x-0 hover:opacity-100"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- the piece's own photo, cut out; small and already compressed */}
                <img src={`/rack/${p.product.slug}.webp`} alt="" draggable={false} loading="lazy" className="max-h-full max-w-full object-contain" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
