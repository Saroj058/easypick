"use client";

import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ProductImage } from "@/components/product-image";
import { useArrowKeys } from "@/lib/arrow-keys";
import { two, V } from "./look";
import type { TileData } from "./vault-tile";

const EASE = [0.22, 1, 0.36, 1] as const;
const EVERY = 6000;

/**
 * The Vault's opening (after the FRZN reference): three pieces side by side, the middle one large,
 * the two beside it small and quiet; the words set big on either side. Every six seconds, or with
 * the arrows, the arrow keys or a tap on a side piece, the next one glides into the middle. It
 * stops while pointed at or focused, and never moves for people who ask for less motion.
 */
export function VaultTriptych({ pieces, left, right }: { pieces: TileData[]; left: [string, string]; right: [string, string] }) {
  return (
    <MotionConfig reducedMotion="user">
      <Triptych pieces={pieces} left={left} right={right} />
    </MotionConfig>
  );
}

function Triptych({ pieces, left, right }: { pieces: TileData[]; left: [string, string]; right: [string, string] }) {
  const still = useReducedMotion();
  const n = pieces.length;
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const go = (d: number) => setAt((a) => (a + d + n) % n);
  useArrowKeys(box, (d) => go(d));

  useEffect(() => {
    if (still || held || n < 2) return;
    const t = window.setTimeout(() => setAt((a) => (a + 1) % n), EVERY);
    return () => window.clearTimeout(t);
  }, [at, held, still, n]);

  if (!n) return null;
  const centre = pieces[at];
  const prev = n > 1 ? pieces[(at - 1 + n) % n] : null;
  const next = n > 2 ? pieces[(at + 1) % n] : null;
  const spring = { type: "spring" as const, stiffness: 140, damping: 22, mass: 0.9 };

  return (
    <div
      ref={box}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured in the Vault"
      className="relative"
    >
      <p className="sr-only" aria-live="polite">
        {centre.brand} {centre.model}, {centre.sold ? "sold" : centre.priceText}. Piece {at + 1} of {n}.
      </p>

      <LayoutGroup>
        <div className="relative mx-auto grid max-w-[920px] grid-cols-[1fr_1.7fr_1fr] items-center gap-0">
          {[prev, centre, next].map((p, slot) => {
            if (!p) return <span key={`empty-${slot}`} />;
            const main = slot === 1;
            return (
              <motion.div
                key={p.id}
                layoutId={`tri-${p.id}`}
                transition={spring}
                className={`relative ${main ? "z-10" : "z-0 mt-[12%] self-start"}`}
              >
                {main ? (
                  <Link href={`/product/${p.slug}`} className="group block" aria-label={`${p.brand} ${p.model}, ${p.sold ? "sold" : p.priceText}`}>
                    <motion.span
                      layout
                      className="relative block overflow-hidden bg-[#c3d4e4] shadow-[0_40px_80px_-40px_rgba(15,30,45,0.6)]"
                      animate={still ? undefined : { y: [0, -6, 0] }}
                      transition={still ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <span aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(60%_45%_at_50%_0%,rgba(255,255,255,0.55),transparent_70%)]" />
                      <span className={`block transition-transform duration-700 group-hover:scale-[1.03] ${p.sold ? "opacity-50 grayscale" : ""}`}>
                        <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative priority ground="bg-transparent" className="[&_img]:mix-blend-multiply" sizes="(min-width: 1024px) 420px, 50vw" />
                      </span>
                    </motion.span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => go(slot === 0 ? -1 : 1)}
                    aria-label={`${slot === 0 ? "Previous" : "Next"}: ${p.brand} ${p.model}`}
                    className="group block w-full cursor-pointer"
                  >
                    <span className="relative block overflow-hidden bg-[#c3d4e4] opacity-80 transition-opacity duration-500 group-hover:opacity-100">
                      <span aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-[#4b6680]/25 transition-opacity duration-500 group-hover:opacity-0" />
                      <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative ground="bg-transparent" className="[&_img]:mix-blend-multiply" sizes="220px" />
                    </span>
                  </button>
                )}
              </motion.div>
            );
          })}

          {/* The words, set big either side of the middle piece */}
          <p aria-hidden className="display pointer-events-none absolute bottom-[6%] left-0 z-20 hidden text-right text-[clamp(1.6rem,1rem+2vw,2.9rem)] leading-[0.92] text-white md:block md:w-[33%] md:pr-6">
            {left[0]}
            <br />
            {left[1]}
          </p>
          <p aria-hidden className="display pointer-events-none absolute bottom-[6%] right-0 z-20 hidden text-right text-[clamp(1.6rem,1rem+2vw,2.9rem)] leading-[0.92] text-white md:block md:w-[33%]">
            {right[0]}
            <br />
            {right[1]}
          </p>
        </div>
      </LayoutGroup>

      {/* The piece in the middle, and the way through */}
      <div className="mx-auto mt-6 flex max-w-[920px] flex-wrap items-end justify-between gap-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={centre.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE }} className={`${V.mono} leading-[1.7] ${V.iceDim}`}>
            <span className="block text-white">{centre.brand}</span>
            <span className="block">{centre.model}</span>
            <span className="block text-white tabular-nums">
              {centre.sold ? "Sold · archive" : centre.priceText}
              {centre.edition ? ` · No. ${centre.edition}` : ""}
            </span>
          </motion.div>
        </AnimatePresence>
        {n > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(-1)} aria-label="Previous piece" className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-white/30 text-white transition-colors hover:bg-white hover:text-[#1f3347]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span aria-hidden className={`w-20 text-center ${V.mono} tabular-nums text-white`}>
              {two(at + 1)} <span className={V.iceDim}>/ {two(n)}</span>
            </span>
            <button type="button" onClick={() => go(1)} aria-label="Next piece" className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-white/30 text-white transition-colors hover:bg-white hover:text-[#1f3347]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {/* Time to the next piece: a thin line that fills */}
      {n > 1 && !still && (
        <div aria-hidden className="mx-auto mt-4 h-px max-w-[920px] bg-white/15">
          <motion.div key={`${at}-${held}`} className="h-full origin-left bg-white/70" initial={{ scaleX: 0 }} animate={{ scaleX: held ? 0 : 1 }} transition={{ duration: held ? 0.2 : EVERY / 1000, ease: "linear" }} />
        </div>
      )}
    </div>
  );
}
