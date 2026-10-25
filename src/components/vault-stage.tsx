"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/format";
import type { Category, ProductImage as Img } from "@/lib/types";
import { ProductImage, standInSrc } from "./product-image";

// The first screen of a Vault piece's page. Since 25 Oct 2026 (owner, from a catalogue reference,
// in black and white): a spread. The spec sheet and close-ups on the left, the piece floating large
// in the middle over its brand's mark, a black rule, then the name, its story, its colours and the
// buying panel on the right; under it the brand's other pieces, three across. It moves: the parts
// rise in from either side, the rule draws down, the piece glides up and drifts, and leans a little
// toward the pointer. Nothing moves for people who ask for less motion.

// Each brand's own logo behind its pieces (public/brand/vault/<brand>.png: shapes taken from the
// brands' logos on Wikimedia Commons, owner's request 14 Oct 2026). A brand with none here gets the
// Easypick mark.
const LOGOS: Record<string, { file: string; aspect: number }> = {
  nike: { file: "nike", aspect: 1196 / 428 },
  adidas: { file: "adidas", aspect: 1188 / 801 },
  puma: { file: "puma", aspect: 1148 / 357 },
  "new balance": { file: "new-balance", aspect: 1192 / 653 },
  converse: { file: "converse", aspect: 1200 / 806 },
  carhartt: { file: "carhartt", aspect: 1134 / 1200 },
};
function logoFor(brand: string) {
  const l = LOGOS[brand.trim().toLowerCase()];
  return l ? { src: `/brand/vault/${l.file}.png`, aspect: l.aspect, own: true } : { src: "/brand/mark-large.png", aspect: 1024 / 1038, own: false };
}

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
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[4px] bg-photo shadow-[0_40px_60px_-30px_rgba(0,0,0,0.45)]">
        <Image src={image.src} alt={image.alt} fill priority sizes="(min-width: 1024px) 34vw, 80vw" className="object-cover" />
      </div>
    );
  const src = standInSrc(image.alt, category);
  if (!src) return <ProductImage image={image} category={category} colourHex={hex} priority sizes="(min-width: 1024px) 34vw, 80vw" className="rounded-[4px]" />;
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

const EASE = [0.16, 1, 0.3, 1] as const;

/** A small heading over a few lines of the spec sheet, as in a catalogue's margin. */
function Spec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">{title}</p>
      <div className="mt-1 text-[13px] leading-snug text-[#3a3a3a]">{children}</div>
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
  details,
  sizes,
  colours,
  gallery,
  siblings,
  children,
}: {
  slug: string;
  name: string;
  /** The brand: its logo is drawn behind the piece, and it names the row of its other pieces. */
  brand: string;
  /** The small line over the name: brand, Original, the edition number. */
  label: React.ReactNode;
  price: number;
  was?: number;
  description: string;
  image: Img;
  category: Category;
  hex: string;
  /** Fabric, fit and care lines, for the spec sheet. */
  details: string[];
  /** The sizes it comes in, in order. */
  sizes: string[];
  colours: { name: string; hex: string }[];
  /** Its other photos (details, worn), beside the spec sheet. */
  gallery: Img[];
  /** The brand's pieces in the Vault, this one among them, in order. */
  siblings: VaultSibling[];
  /** The buying panel. */
  children: React.ReactNode;
}) {
  const still = useReducedMotion();
  const logo = logoFor(brand);
  const at = Math.max(0, siblings.findIndex((s) => s.slug === slug));
  const n = siblings.length;
  const prev = n > 1 ? siblings[(at - 1 + n) % n] : null;
  const next = n > 1 ? siblings[(at + 1) % n] : null;
  // The row under the spread: the brand's other pieces, up to three, starting after this one.
  const more = n > 1 ? Array.from({ length: Math.min(3, n - 1) }, (_, i) => siblings[(at + 1 + i) % n]) : [];

  // The lean toward the pointer, eased so it never jerks.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 16 });
  const sy = useSpring(py, { stiffness: 60, damping: 16 });
  const rotY = useTransform(sx, [-1, 1], [-6, 6]);
  const rotX = useTransform(sy, [-1, 1], [4, -4]);
  const shiftX = useTransform(sx, [-1, 1], [-14, 14]);
  const wordX = useTransform(sx, [-1, 1], [18, -18]);
  const rise = (delay: number, x = 0) => ({ initial: still ? false : { opacity: 0, y: 24, x }, animate: { opacity: 1, y: 0, x: 0 }, transition: { duration: 0.9, ease: EASE, delay } }) as const;

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
      className="relative overflow-hidden border-b border-[#111]/10 bg-[#f4f3ef] text-[#111]"
    >
      {/* The spread, as a catalogue page (owner, 25 Oct 2026, black and white): the spec sheet and
          close-ups on the left, the piece large in the middle over its brand's mark, a black rule,
          and the name, its story, colours and the buying panel on the right. */}
      <div key={slug} className="container-ep relative grid gap-10 py-10 lg:min-h-[calc(100svh-88px)] lg:grid-cols-[minmax(0,3fr)_minmax(0,5fr)_auto_minmax(0,4fr)] lg:items-center lg:gap-8 lg:py-14">
        {/* Left: the spec sheet, and the close-ups beside it */}
        <motion.div {...rise(0.35, -24)} className="order-3 grid grid-cols-[1fr_auto] items-start gap-5 lg:order-1">
          <div className="space-y-5 text-right">
            {details.length > 0 && (
              <Spec title="Material & details">
                {details.slice(0, 4).map((d) => (
                  <p key={d}>{d}</p>
                ))}
              </Spec>
            )}
            {sizes.length > 0 && (
              <Spec title="Size">
                <p className="font-mono tracking-[0.12em]">{sizes.map((s) => (s === "ONE" ? "One size" : s)).join("   ")}</p>
              </Spec>
            )}
            <Spec title="Brand">
              <p>{brand}</p>
            </Spec>
          </div>
          {gallery.length > 0 && (
            <ul className="flex w-[84px] flex-col gap-3 sm:w-[96px]">
              {gallery.slice(0, 3).map((g, i) => (
                <motion.li key={`${g.src}-${i}`} initial={still ? false : { opacity: 0, clipPath: "inset(100% 0 0 0)" }} animate={{ opacity: 1, clipPath: "inset(0% 0 0 0)" }} transition={{ duration: 1, ease: EASE, delay: 0.5 + i * 0.12 }} className="overflow-hidden bg-[#e6e5e0]">
                  <ProductImage image={g} category={category} colourHex={hex} sizes="96px" />
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* Middle: the piece, floating over its brand's mark */}
        <div className="relative order-1 mx-auto flex w-full max-w-[560px] items-center justify-center [perspective:1100px] lg:order-2">
          <motion.div aria-hidden style={still ? undefined : { x: wordX }} className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <motion.span
              initial={still ? false : { opacity: 0, x: -70, rotate: -18 }}
              animate={{ opacity: 1, x: 0, rotate: -8 }}
              transition={{ duration: 1.2, ease: EASE }}
              className={`block -translate-x-[6%] bg-white [filter:drop-shadow(0_18px_30px_rgba(0,0,0,0.08))] ${logo.aspect > 1.6 ? "w-[118%]" : "w-[96%]"}`}
              style={{ aspectRatio: String(logo.aspect), maskImage: `url(${logo.src})`, WebkitMaskImage: `url(${logo.src})`, maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }}
            />
          </motion.div>
          <motion.div style={still ? undefined : { rotateY: rotY, rotateX: rotX, x: shiftX }} className="relative w-[70%] [transform-style:preserve-3d] lg:w-[80%]">
            <motion.div initial={still ? false : { opacity: 0, y: 80, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 70, damping: 15, mass: 0.9 }}>
              <motion.div animate={still ? undefined : { y: [0, -14, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}>
                <Piece image={image} category={category} hex={hex} />
              </motion.div>
            </motion.div>
            <motion.span
              aria-hidden
              animate={still ? undefined : { scaleX: [1, 0.82, 1], opacity: [0.32, 0.2, 0.32] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
              className="absolute inset-x-[18%] -bottom-[4%] block h-[6%] rounded-[50%] bg-[#111]/40 blur-xl"
            />
          </motion.div>
        </div>

        {/* The black rule between the piece and the words, drawn top to bottom */}
        <motion.span aria-hidden initial={still ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.2, ease: EASE, delay: 0.3 }} className="hidden h-[62%] w-px origin-top self-center bg-[#111] lg:order-3 lg:block" />

        {/* Right: the name, its story, its colours and the buying panel */}
        <motion.div {...rise(0.2, 24)} className="order-2 min-w-0 lg:order-4">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] uppercase tracking-[0.16em] text-[#555]">{label}</p>
          <h1 className="display mt-3 text-[clamp(2.2rem,1.4rem+2.6vw,4rem)] font-extralight uppercase leading-[0.92] tracking-[0.04em]">{name}</h1>
          <p className="mt-4 font-mono text-[20px] font-semibold tabular-nums">
            {formatPrice(price)}
            {was && <s className="ml-3 text-[14px] font-normal text-[#666]">{formatPrice(was)}</s>}
          </p>
          <p className="mt-4 max-w-[44ch] text-justify font-mono text-[12px] uppercase leading-[1.7] tracking-[0.06em] text-[#333]">{description}</p>
          {colours.length > 0 && (
            <div className="mt-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">Colour</p>
              <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-[#333]">{colours.map((c) => c.name).join(" / ")}</p>
              <p aria-hidden className="mt-3 flex gap-3">
                {colours.map((c) => (
                  <span key={c.name} className="h-6 w-6 rounded-full ring-1 ring-[#111]/15" style={{ background: c.hex }} />
                ))}
              </p>
            </div>
          )}
          {/* The buying panel in black and white: its lime buttons turn black (owner, 25 Oct 2026: premium) */}
          <div className="mt-6 max-w-[460px] border-t border-[#111]/15 pt-5 [&_.bg-volt]:bg-[#111] [&_.bg-volt]:text-white [&_.bg-volt:hover]:bg-[#2b2b2b] [&_.bg-volt\/45]:bg-[#111]/35 [&_.bg-volt\/45]:text-white/80">{children}</div>
        </motion.div>
      </div>

      {/* Under the spread: the brand's other pieces, large, three across */}
      {n > 1 && (
        <nav aria-label={`More from ${brand}`} className="container-ep relative pb-14">
          <div className="flex items-end justify-between gap-4 border-t border-[#111]/15 pt-5">
            <p className="font-mono text-[12px] uppercase tracking-[0.16em]">
              More from {brand} <span className="tabular-nums text-[#666]">· {String(at + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
            </p>
            <p className="flex gap-5">
              <Link href={`/product/${prev!.slug}`} aria-label={`Previous: ${prev!.name}`} className="flex min-h-11 items-center font-mono text-[12px] uppercase tracking-[0.16em] underline-offset-4 hover:underline">
                ‹ Prev
              </Link>
              <Link href={`/product/${next!.slug}`} aria-label={`Next: ${next!.name}`} className="flex min-h-11 items-center font-mono text-[12px] uppercase tracking-[0.16em] underline-offset-4 hover:underline">
                Next ›
              </Link>
            </p>
          </div>
          <ul className="no-scrollbar -mx-4 mt-5 flex snap-x gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {more.map((s, i) => (
              <motion.li key={s.slug} initial={still ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.9, ease: EASE, delay: i * 0.1 }} className="w-[72vw] shrink-0 snap-start md:w-auto">
                <Link href={`/product/${s.slug}`} className="group block">
                  <span className="block overflow-hidden bg-[#e6e5e0]">
                    <span className="block grayscale-[35%] transition-[transform,filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] group-hover:grayscale-0">
                      <ProductImage image={s.image} category={s.category} colourHex={s.hex} decorative sizes="(min-width: 768px) 33vw, 72vw" />
                    </span>
                  </span>
                  <span className="mt-3 block font-mono text-[12px] uppercase tracking-[0.12em]">{s.name}</span>
                </Link>
              </motion.li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
