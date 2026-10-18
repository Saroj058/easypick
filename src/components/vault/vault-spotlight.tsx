"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

import { ProductImage } from "@/components/product-image";
import { V } from "./look";
import type { TileData } from "./vault-tile";

/**
 * One piece, large and floating over the words (after the FRZN reference). As the page scrolls the
 * piece rises and turns a touch, the words drift the other way; at rest it breathes gently. The
 * octagon is the way in, with the price beside it. Nothing moves for people who ask for less motion.
 */
export function VaultSpotlight({ piece }: { piece: TileData }) {
  const still = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });
  const y = useTransform(smooth, [0, 1], still ? [0, 0] : [70, -70]);
  const rotate = useTransform(smooth, [0, 1], still ? [0, 0] : [-5, 4]);
  const wordsX = useTransform(smooth, [0, 1], still ? [0, 0] : [-14, 14]);
  const wordsX2 = useTransform(smooth, [0, 1], still ? [0, 0] : [14, -14]);
  const size = piece.sizes.filter((s) => s.left).map((s) => (s.size === "ONE" ? "One size" : s.size));

  return (
    <section ref={ref} aria-labelledby="vault-spot" className="relative py-16 md:py-24">
      <div className="relative mx-auto max-w-[1100px]">
        <motion.h2 id="vault-spot" style={{ x: wordsX }} className="display relative z-0 max-w-[12ch] text-[clamp(2.6rem,1.4rem+5vw,6.4rem)] leading-[0.86] text-white">
          When it&apos;s gone,
          <br />
          <span className="text-white/60">it&apos;s gone.</span>
        </motion.h2>
        <p className={`absolute right-0 top-2 hidden max-w-[22ch] text-right ${V.mono} leading-[1.6] ${V.iceDim} md:block`}>
          One of each.
          <br />
          Never restocked.
          <br />
          Checked by hand.
        </p>

        {/* The piece, floating over the words */}
        <motion.div style={{ y, rotate }} className="relative z-10 mx-auto -mt-[10%] w-[min(78%,460px)] md:-mt-[14%]">
          <motion.div animate={still ? undefined : { y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
            <Link href={`/product/${piece.slug}`} tabIndex={-1} aria-hidden className="block">
              <span className="relative block overflow-hidden rounded-[2px] bg-[var(--v-tile)] shadow-[0_60px_90px_-50px_rgba(10,25,40,0.75)]">
                <span aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(60%_45%_at_50%_0%,rgba(255,255,255,0.5),transparent_70%)]" />
                <ProductImage image={piece.image} category={piece.category} colourHex={piece.hex} decorative ground="bg-transparent" className="[&_img]:mix-blend-multiply" sizes="460px" />
              </span>
            </Link>
          </motion.div>
          <span aria-hidden className="mx-auto mt-6 block h-4 w-[60%] rounded-[50%] bg-black/40 blur-[14px]" />
        </motion.div>

        <div className="relative z-20 mt-8 grid gap-8 md:-mt-24 md:grid-cols-[1fr_auto] md:items-end">
          {/* The plain facts, as the reference's bracketed notes */}
          <dl className={`grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 ${V.mono} leading-[1.6] ${V.iceDim}`}>
            <dt>[Brand]</dt>
            <dd className="text-white">{piece.brand}</dd>
            <dt>[Piece]</dt>
            <dd className="text-white">{piece.model}</dd>
            <dt>[Size]</dt>
            <dd className="text-white">{size.join(" · ") || "Gone"}</dd>
            <dt>[Colour]</dt>
            <dd className="text-white">{piece.colour}</dd>
            {piece.edition && (
              <>
                <dt>[No.]</dt>
                <dd className="text-white">{piece.edition}</dd>
              </>
            )}
          </dl>
          {/* The octagon: the way in, with the price */}
          <Link href={`/product/${piece.slug}`} className="group flex items-center gap-4 justify-self-start md:justify-self-end" aria-label={`View ${piece.brand} ${piece.model}, ${piece.sold ? "sold" : piece.priceText}`}>
            <span className="relative grid h-[84px] w-[84px] place-items-center text-white">
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[22.5deg]" aria-hidden>
                <polygon points="30,3 70,3 97,30 97,70 70,97 30,97 3,70 3,30" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </span>
            <span>
              <span className={`block ${V.mono} ${V.iceDim}`}>{piece.sold ? "See the piece" : "View piece"}</span>
              <span className="block font-mono text-[22px] tabular-nums text-white">{piece.sold ? "Sold" : piece.priceText}</span>
            </span>
          </Link>
        </div>

        <motion.p aria-hidden style={{ x: wordsX2 }} className="display mt-10 text-right text-[clamp(2.2rem,1.2rem+4vw,5.2rem)] leading-[0.86] text-white/90">
          Not for the crowd.
          <br />
          <span className="text-white/60">For the few.</span>
        </motion.p>
      </div>
    </section>
  );
}
