"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ProductImage } from "@/components/product-image";
import { V } from "./look";
import type { TileData } from "./vault-tile";

const EASE = [0.16, 1, 0.3, 1] as const;
const EVERY = 5000;

/**
 * The Vault's opening, in black and white (owner, 25 Oct 2026, after a minimal fashion-store
 * reference): the name set huge across the page, one piece standing in front of it, a short note
 * top left, the count bottom right and two ways in. The letters rise in one after another, the
 * piece rises in front and changes every few seconds, and as the page scrolls the word and the
 * piece drift apart. Nothing moves for people who ask for less motion.
 */
export function VaultHero({ title, note, pieces, count, side, figure }: { title: string; note: string; pieces: TileData[]; count: string; side: string; /** A person standing in front of the word (cut out, see public/vault/); without one, the piece stands there. */ figure?: { src: string; width: number; height: number } }) {
  const still = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const n = pieces.length;

  useEffect(() => {
    if (still || held || n < 2) return;
    const t = setTimeout(() => setAt((i) => (i + 1) % n), EVERY);
    return () => clearTimeout(t);
  }, [at, still, held, n]);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // Through a soft spring, so the word and the figure glide with the scroll rather than step.
  const glide = useSpring(scrollYProgress, { stiffness: 70, damping: 26, mass: 0.6 });
  const wordY = useTransform(glide, [0, 1], still ? [0, 0] : [0, 120]);
  const pieceY = useTransform(glide, [0, 1], still ? [0, 0] : [0, -70]);
  const fade = useTransform(glide, [0, 0.7], still ? [1, 1] : [1, 0.25]);

  const piece = pieces[at];
  // The word fills the width whatever its length: "THE VAULT" or a brand's name.
  const letters = Array.from(title.toUpperCase());
  const size = `clamp(3rem, ${Math.min(17, 150 / Math.max(letters.length, 4)).toFixed(2)}vw, 19rem)`;

  return (
    <section ref={ref} aria-labelledby="vault-title" className="relative isolate overflow-hidden">
      <div className="container-ep relative flex min-h-[calc(100svh-88px)] flex-col pb-8 pt-8 md:min-h-[100svh] md:pb-10 md:pt-[112px]">
        {/* Top: the note on the left, the count on the right */}
        <div className="flex items-start justify-between gap-6">
          <motion.p initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.6 }} className={`max-w-[30ch] ${V.mono} leading-[1.9] ${V.ink}`}>
            {note}
            <span aria-hidden className="mt-3 block h-px w-10 bg-[var(--v-ink)]" />
          </motion.p>
          <motion.p initial={still ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.7 }} className={`hidden text-right ${V.mono} leading-[1.9] ${V.ink} sm:block`}>
            {count}
          </motion.p>
        </div>

        {/* The word, and the piece standing in front of it */}
        <div className="relative flex flex-1 items-center justify-center py-6 md:py-0">
          <motion.h1 id="vault-title" aria-label={title} style={{ y: wordY, opacity: fade, fontSize: size }} className={`display relative z-0 flex select-none whitespace-nowrap font-extralight leading-[0.8] tracking-[0.06em] ${V.deep}`}>
            {letters.map((ch, i) => (
              <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.04em]">
                <motion.span className="inline-block" initial={still ? false : { y: "110%" }} animate={{ y: "0%" }} transition={{ duration: 1, ease: EASE, delay: 0.1 + i * 0.05 }}>
                  {ch === " " ? " " : ch}
                </motion.span>
              </span>
            ))}
          </motion.h1>

          {figure ? (
            <motion.div style={{ y: pieceY }} className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              {/* Sized by height, so every figure stands as tall, whatever its width */}
              <motion.div initial={still ? false : { opacity: 0, y: 70 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.3, ease: EASE, delay: 0.45 }}>
                <Image src={figure.src} alt="" width={figure.width} height={figure.height} priority sizes="(min-width: 768px) 440px, 70vw" className="h-[min(56svh,520px)] w-auto max-w-[80vw] object-contain md:h-[min(72svh,660px)] [filter:drop-shadow(0_28px_24px_rgba(0,0,0,0.18))]" />
              </motion.div>
            </motion.div>
          ) : (
            piece && (
            <motion.div style={{ y: pieceY }} className="absolute inset-x-0 top-1/2 z-10 mx-auto w-[min(62vw,400px)] -translate-y-1/2 md:w-[min(30vw,420px)]" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}>
              <AnimatePresence mode="popLayout" initial={!still}>
                <motion.div
                  key={piece.id}
                  initial={still ? false : { opacity: 0, y: 60, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 1.1, ease: EASE, delay: at === 0 ? 0.5 : 0 } }}
                  exit={{ opacity: 0, y: -30, scale: 0.98, transition: { duration: 0.5, ease: EASE } }}
                >
                  <Link href={`/product/${piece.slug}`} aria-label={`${piece.name}, ${piece.sold ? "sold" : piece.priceText}`} className="group block">
                    <span className={`block transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1.5 ${piece.sold ? "grayscale" : ""}`}>
                      <ProductImage image={piece.image} category={piece.category} colourHex={piece.hex} decorative priority ground="bg-transparent" sizes="(min-width: 768px) 420px, 62vw" className="[filter:drop-shadow(0_30px_30px_rgba(0,0,0,0.22))]" />
                    </span>
                  </Link>
                </motion.div>
              </AnimatePresence>
            </motion.div>
            )
          )}
        </div>

        {/* Bottom: the way in on the left; on the right the piece in front and where we are */}
        <div className="relative z-20 flex flex-wrap items-end justify-between gap-6">
          <motion.div initial={still ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.9 }} className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="#inventory" className="inline-flex h-12 items-center bg-[var(--v-deep)] px-7 font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--v-frost)] transition-opacity hover:opacity-85">
              {side}
            </Link>
          </motion.div>
          {piece && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={piece.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35, ease: EASE }} className="flex items-end gap-4" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}>
                <p className={`text-right ${V.mono} leading-[1.9] ${V.ink}`}>
                  {piece.brand} · {piece.model}
                  <br />
                  <span className="tabular-nums">
                    {piece.sold ? "Sold" : piece.priceText}
                    {n > 1 && ` · ${String(at + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`}
                  </span>
                </p>
                {figure && (
                  <Link href={`/product/${piece.slug}`} aria-label={`${piece.name}, ${piece.sold ? "sold" : piece.priceText}`} className="block w-[64px] shrink-0 bg-[var(--v-tile)] transition-transform duration-500 hover:-translate-y-1 md:w-[76px]">
                    <ProductImage image={piece.image} category={piece.category} colourHex={piece.hex} decorative ground="bg-transparent" sizes="76px" />
                  </Link>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </section>
  );
}
