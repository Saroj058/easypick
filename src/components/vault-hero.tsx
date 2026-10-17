"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { Category, ProductImage as Img } from "@/lib/types";
import { ProductImage } from "./product-image";

// The Vault's first screen (owner's reference, 17 Oct 2026, planned by six specialists): a featured
// piece, one brand after another. Left, the brand set huge with the piece's name, a mono row of the
// sizes it comes in (the gone ones struck through: there's nothing to pick here, every piece is
// bought on its own page), its colour and price, and a cut-corner "View piece" button. In the
// middle, the piece on the Vault's steel tile. On the right, the next two and a counter, 01 —— 05.
// It moves on by itself every 8 seconds, holds while pointed at or focused, and can be paused.

export interface HeroPiece {
  slug: string;
  brand: string;
  model: string;
  /** "07 / 20", "ORIGINAL" or "". */
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
const AUTO = 8000;
const two = (n: number) => String(n).padStart(2, "0");
const TILE = "bg-[radial-gradient(120%_90%_at_50%_30%,#e3e7eb_0%,#cdd3d9_70%,#c3cad1_100%)]";
const CUT = "[clip-path:polygon(18px_0,100%_0,100%_calc(100%-18px),calc(100%-18px)_100%,0_100%,0_18px)]";
const OCTAGON = "[clip-path:polygon(30%_0,70%_0,100%_30%,100%_70%,70%_100%,30%_100%,0_70%,0_30%)]";

export function VaultHero({ pieces }: { pieces: HeroPiece[] }) {
  return (
    <MotionConfig reducedMotion="user">
      <Hero pieces={pieces} />
    </MotionConfig>
  );
}

function Hero({ pieces }: { pieces: HeroPiece[] }) {
  const still = useReducedMotion();
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [held, setHeld] = useState(false);
  const playing = (paused === null ? !still : !paused) && pieces.length > 1;
  const box = useRef<HTMLElement>(null);

  const go = (i: number, d = i > at ? 1 : -1) => {
    setDir(d);
    setAt((i + pieces.length) % pieces.length);
  };

  useEffect(() => {
    if (!playing || held) return;
    const t = setTimeout(() => {
      setDir(1);
      setAt((a) => (a + 1) % pieces.length);
    }, AUTO);
    return () => clearTimeout(t);
  }, [playing, held, at, pieces.length]);

  const p = pieces[at];
  if (!p) return null;
  const next = [1, 2].map((k) => pieces[(at + k) % pieces.length]).filter((x, i, a) => pieces.length > 1 && a.indexOf(x) === i && x !== p);

  return (
    <section
      ref={box}
      aria-roledescription="carousel"
      aria-label="Featured in the Vault"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHeld(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(at + 1, 1);
        else if (e.key === "ArrowLeft") go(at - 1, -1);
      }}
      className="relative grid gap-y-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,5fr)_minmax(0,1.5fr)] lg:items-center lg:gap-x-12"
    >
      <p className="sr-only" aria-live="polite">
        Piece {at + 1} of {pieces.length}: {p.brand} {p.model}, {p.sold ? "sold" : p.price}.
      </p>

      {/* Left: the brand, the piece, its sizes, colour and price, and the way in */}
      <div className="order-2 min-w-0 lg:order-1">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#9aa0a6]">
          [ Featured · {two(at + 1)} / {two(pieces.length)} ]{p.label && <span className="ml-3">[ {p.label} ]</span>}
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={p.slug} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            <h2 className="display mt-3 overflow-hidden text-[clamp(3.4rem,2rem+5vw,8rem)] leading-[0.84] tracking-[-0.005em]">
              <motion.span className="block" initial={still ? false : { y: "100%" }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
                {p.brand}
              </motion.span>
            </h2>
            <motion.p initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.5, ease: EASE }} className="mt-2 text-[19px] text-[#dcdfe3] md:text-[22px]">
              {p.model}
            </motion.p>

            <dl className="mt-7 grid max-w-[360px] grid-cols-[72px_minmax(0,1fr)] gap-y-3 font-mono text-[11px] uppercase tracking-[0.14em]">
              <dt className="text-[#9aa0a6]">Size</dt>
              <dd className="flex flex-wrap gap-x-4">
                {p.sizes.map((s) => (
                  <span key={s.size} className={s.left ? "text-[#eef0f2]" : "text-[#9aa0a6]/50 line-through"}>
                    {s.size === "ONE" ? "One size" : s.size}
                    {!s.left && <span className="sr-only"> (gone)</span>}
                  </span>
                ))}
              </dd>
              <dt className="text-[#9aa0a6]">Colour</dt>
              <dd className="flex items-center gap-2 text-[#eef0f2]">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-white/25" style={{ background: p.hex }} />
                {p.colour}
              </dd>
            </dl>

            <Link href={`/product/${p.slug}`} className="group mt-8 inline-flex items-center gap-4">
              <span className={`grid h-16 w-16 shrink-0 place-items-center bg-[#eef0f2]/70 transition-colors duration-200 group-hover:bg-[#eef0f2] ${OCTAGON}`}>
                <span className={`grid h-[62px] w-[62px] place-items-center bg-[#0d0e10] text-[#eef0f2] transition-colors duration-200 group-hover:bg-[#eef0f2] group-hover:text-[#0d0e10] ${OCTAGON}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="transition-transform duration-200 group-hover:rotate-45">
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </span>
              </span>
              <span>
                <span className="block font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#9aa0a6]">{p.sold ? "Sold · in the archive" : "View piece"}</span>
                <span className="block text-[26px] font-semibold tabular-nums leading-tight">{p.sold ? "Sold" : p.price}</span>
              </span>
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Middle: the piece on the steel tile */}
      <div className="relative order-1 mx-auto w-full max-w-[300px] lg:order-2 lg:max-w-[min(420px,calc((100svh-88px-200px)*0.8))]">
        <AnimatePresence initial={false} mode="popLayout" custom={dir}>
          <motion.div
            key={p.slug}
            initial={still ? false : { opacity: 0, y: 16, x: dir * 24 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, x: -dir * 24, transition: { duration: 0.25 } }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <Link href={`/product/${p.slug}`} tabIndex={-1} aria-hidden className={`block overflow-hidden ${CUT} ${p.sold ? "opacity-60 grayscale" : ""}`}>
              <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative priority ground={TILE} sizes="(min-width: 1024px) 38vw, 92vw" />
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right: the next two, and where you are */}
      <div className="order-3 flex items-center gap-4 lg:flex-col lg:items-stretch">
        <div className="hidden gap-3 lg:grid">
          {next.map((n) => (
            <button
              key={n.slug}
              type="button"
              onClick={() => go(pieces.indexOf(n), 1)}
              aria-label={`Show ${n.brand} ${n.model}`}
              className={`block cursor-pointer overflow-hidden opacity-60 transition-opacity duration-300 hover:opacity-100 ${CUT}`}
            >
              <ProductImage image={n.image} category={n.category} colourHex={n.hex} decorative ground={TILE} sizes="140px" />
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-3 font-mono text-[11px] tabular-nums text-[#9aa0a6] lg:mt-4 lg:flex-none">
          <span className="text-[#eef0f2]">{two(at + 1)}</span>
          <span aria-hidden className="relative h-px flex-1 bg-white/15 lg:w-auto">
            {playing && !held && <motion.span key={`${at}`} className="absolute inset-0 origin-left bg-[#eef0f2]/70" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: AUTO / 1000, ease: "linear" }} />}
          </span>
          <span>{two(pieces.length)}</span>
        </div>
        <div className="flex shrink-0 items-center lg:justify-between">
          <button type="button" onClick={() => go(at - 1, -1)} aria-label="Previous piece" className="grid h-11 w-11 cursor-pointer place-items-center rounded-full text-[#eef0f2] hover:bg-white/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          {pieces.length > 1 && (
            <button type="button" onClick={() => setPaused(playing)} aria-label={playing ? "Pause the featured pieces" : "Play the featured pieces"} className="grid h-11 w-11 cursor-pointer place-items-center rounded-full text-[#eef0f2] hover:bg-white/5">
              {playing ? (
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                  <path d="M2.5 1.5v7M7.5 1.5v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                  <path d="M3 1.5l5 3.5-5 3.5z" fill="currentColor" />
                </svg>
              )}
            </button>
          )}
          <button type="button" onClick={() => go(at + 1, 1)} aria-label="Next piece" className="grid h-11 w-11 cursor-pointer place-items-center rounded-full text-[#eef0f2] hover:bg-white/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
