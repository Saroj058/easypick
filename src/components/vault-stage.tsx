"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/format";
import type { Category, ProductImage as Img } from "@/lib/types";
import { ProductImage, standInSrc } from "./product-image";

// The first screen of a Vault piece's page (owner's reference, 14 Oct 2026): the piece's name set
// huge on the left with its price, a line about it and the buying panel; the piece itself floating
// large in the middle, tilted, over the Easypick mark; and down the right the brand's
// other pieces, with Prev and Next and a count. It moves: the piece glides in and settles at a
// tilt, then drifts gently up and down, and leans a little toward the pointer. Nothing moves for
// people who ask for less motion.

export interface VaultSibling {
  slug: string;
  name: string;
  image: Img;
  category: Category;
  hex: string;
}

/** The piece alone, without a box: its photo when it has one, otherwise its stand-in dyed to its colour. */
function Piece({ image, category, hex }: { image: Img; category: Category; hex: string }) {
  if (image.src)
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] bg-photo shadow-[0_40px_60px_-30px_rgba(0,0,0,0.45)]">
        <Image src={image.src} alt={image.alt} fill priority sizes="(min-width: 1024px) 34vw, 80vw" className="object-cover" />
      </div>
    );
  const src = standInSrc(image.alt, category);
  if (!src) return <ProductImage image={image} category={category} colourHex={hex} priority sizes="(min-width: 1024px) 34vw, 80vw" className="rounded-[22px]" />;
  const mask = { maskImage: `url(${src})`, WebkitMaskImage: `url(${src})`, maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" };
  return (
    <div role="img" aria-label={image.alt} className="relative isolate aspect-[4/5] w-full [filter:drop-shadow(0_34px_28px_rgba(0,0,0,0.28))]">
      <div className="absolute inset-0" style={{ backgroundColor: hex, ...mask }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- a small neutral photograph, used as a blend layer */}
      <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain mix-blend-multiply" />
      {/* eslint-disable-next-line @next/next/no-img-element -- the same photograph, for highlights */}
      <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain opacity-[0.16] mix-blend-screen" />
    </div>
  );
}

export function VaultStage({
  slug,
  name,
  brand,
  label,
  price,
  was,
  description,
  image,
  category,
  hex,
  siblings,
  children,
}: {
  slug: string;
  name: string;
  /** The brand: names the row of its other pieces. */
  brand: string;
  /** The small line over the name: brand, Original, the edition number. */
  label: React.ReactNode;
  price: number;
  was?: number;
  description: string;
  image: Img;
  category: Category;
  hex: string;
  /** The brand's pieces in the Vault, this one among them, in order. */
  siblings: VaultSibling[];
  /** The buying panel. */
  children: React.ReactNode;
}) {
  const still = useReducedMotion();
  const at = Math.max(0, siblings.findIndex((s) => s.slug === slug));
  const n = siblings.length;
  const prev = n > 1 ? siblings[(at - 1 + n) % n] : null;
  const next = n > 1 ? siblings[(at + 1) % n] : null;
  // Prev, this one, next: the column on the right, the middle one larger.
  const column = n > 2 ? [prev!, siblings[at], next!] : siblings;

  // The lean toward the pointer, eased so it never jerks.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 16 });
  const sy = useSpring(py, { stiffness: 60, damping: 16 });
  const rotY = useTransform(sx, [-1, 1], [-9, 9]);
  const rotX = useTransform(sy, [-1, 1], [7, -7]);
  const shiftX = useTransform(sx, [-1, 1], [-14, 14]);
  const wordX = useTransform(sx, [-1, 1], [18, -18]);

  return (
    <section
      onPointerMove={(e) => {
        if (still || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width) * 2 - 1);
        py.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
      className="relative overflow-hidden border-b border-ink/10 bg-[#e8e9ed] text-ink"
    >
      {/* Faint upright lines across the page, as on a drawing board */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.06)_1px,transparent_1px)] bg-[length:25%_100%]" />

      <div className="container-ep relative grid min-h-[calc(100svh-88px)] items-center gap-8 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_auto] lg:gap-10 lg:py-12">
        {/* The words and the buying panel */}
        <motion.div key={`words-${slug}`} initial={still ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} className="order-2 min-w-0 lg:order-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] uppercase tracking-[0.16em] text-steel-dark">{label}</p>
          <h1 className="display mt-3 text-[clamp(2.6rem,1.6rem+3.2vw,5rem)] uppercase leading-[0.88]">{name}</h1>
          <p className="mt-5 font-mono text-[20px] font-semibold tabular-nums">
            {formatPrice(price)}
            {was && <s className="ml-3 text-[14px] font-normal text-steel-dark">{formatPrice(was)}</s>}
          </p>
          <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-ink/70">{description}</p>
          <div className="mt-6 max-w-[460px] border-t border-ink/15 pt-5">{children}</div>
        </motion.div>

        {/* The piece, floating over its brand's name */}
        <div className="relative order-1 mx-auto flex w-full max-w-[560px] items-center justify-center [perspective:1100px] lg:order-2">
          {/* The Easypick mark, large and white behind the piece; it slides in, then drifts against the pointer */}
          <motion.div aria-hidden style={still ? undefined : { x: wordX }} className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <motion.span
              key={`mark-${slug}`}
              initial={still ? false : { opacity: 0, x: -70, rotate: -18 }}
              animate={{ opacity: 1, x: 0, rotate: -8 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="block aspect-[1024/1038] w-[96%] -translate-x-[6%] bg-white [filter:drop-shadow(0_18px_30px_rgba(0,0,0,0.08))]"
              style={{ maskImage: "url(/brand/mark-large.png)", WebkitMaskImage: "url(/brand/mark-large.png)", maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }}
            />
          </motion.div>
          <motion.div style={still ? undefined : { rotateY: rotY, rotateX: rotX, x: shiftX }} className="relative w-[64%] [transform-style:preserve-3d] lg:w-[66%]">
            <motion.div
              key={`piece-${slug}`}
              initial={still ? false : { opacity: 0, x: 140, rotate: 8, scale: 0.88 }}
              animate={{ opacity: 1, x: 0, rotate: -9, scale: 1 }}
              transition={{ type: "spring", stiffness: 70, damping: 15, mass: 0.9 }}
            >
              <motion.div animate={still ? undefined : { y: [0, -16, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}>
                <Piece image={image} category={category} hex={hex} />
              </motion.div>
            </motion.div>
            {/* Its shadow on the floor, breathing with the drift */}
            <motion.span
              aria-hidden
              animate={still ? undefined : { scaleX: [1, 0.82, 1], opacity: [0.32, 0.2, 0.32] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
              className="absolute inset-x-[18%] -bottom-[4%] block h-[6%] rounded-[50%] bg-ink/40 blur-xl"
            />
          </motion.div>
        </div>

        {/* The brand's other pieces */}
        {n > 1 && (
          <nav aria-label={`More from ${brand}`} className="order-3 flex items-center justify-center gap-4 lg:flex-col lg:items-end lg:gap-5">
            <Link href={`/product/${prev!.slug}`} aria-label={`Previous: ${prev!.name}`} className="group flex min-h-11 items-center gap-1.5 text-[13px] font-semibold">
              <span aria-hidden className="transition-transform duration-200 group-hover:-translate-x-0.5 lg:hidden">‹</span>
              <span aria-hidden className="hidden transition-transform duration-200 group-hover:-translate-y-0.5 lg:inline">‹</span> Prev
            </Link>
            <div className="flex items-center gap-3 lg:gap-5">
              <ul className="flex gap-2.5 lg:flex-col lg:items-end lg:gap-3">
                {column.map((s) => {
                  const on = s.slug === slug;
                  return (
                    <li key={s.slug}>
                      <Link
                        href={`/product/${s.slug}`}
                        aria-label={s.name}
                        aria-current={on ? "page" : undefined}
                        className={`block overflow-hidden rounded-[10px] bg-paper transition-[transform,box-shadow] duration-300 hover:-translate-y-1 ${on ? "w-[92px] shadow-[0_18px_30px_-16px_rgba(0,0,0,0.45)] lg:w-[128px]" : "w-[72px] opacity-80 shadow-[0_10px_20px_-14px_rgba(0,0,0,0.4)] hover:opacity-100 lg:w-[104px]"}`}
                      >
                        <ProductImage image={s.image} category={s.category} colourHex={s.hex} decorative sizes="128px" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {/* The count, upright, as in a magazine's margin */}
              <p aria-label={`${at + 1} of ${n}`} className="hidden flex-col items-center gap-2 font-mono text-[11px] tabular-nums tracking-[0.1em] lg:flex">
                <span className="[writing-mode:vertical-rl]">{String(at + 1).padStart(2, "0")}</span>
                <span aria-hidden className="h-14 w-px bg-ink" />
                <span className="text-steel-dark [writing-mode:vertical-rl]">{String(n).padStart(2, "0")}</span>
              </p>
            </div>
            <Link href={`/product/${next!.slug}`} aria-label={`Next: ${next!.name}`} className="group flex min-h-11 items-center gap-1.5 text-[13px] font-semibold">
              Next <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">›</span>
            </Link>
          </nav>
        )}
      </div>
    </section>
  );
}
