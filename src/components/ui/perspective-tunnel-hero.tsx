"use client";

import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ProductImage } from "@/components/product-image";
import type { TileData } from "@/components/vault/vault-tile";

// The Vault's opening (owner, 25 Oct 2026: "starting use this", a perspective tunnel from 21st.dev).
// Adapted: the cards are the Vault's own pieces (own photos only), the flight is driven by the
// page's scroll through a tall pinned stage (the original took over the wheel, which trapped the
// page), and it wears the Vault's dark ground instead of the demo's indigo and grid. People who ask
// for less motion get the pieces laid out still.

interface Card {
  t: TileData;
  cos: number;
  sin: number;
  rx: number;
  ry: number;
  rot: number;
  i: number;
}

const toCards = (tiles: TileData[]): Card[] =>
  tiles.map((t, i) => {
    const a = i * 137.5 * (Math.PI / 180);
    return { t, cos: Math.cos(a), sin: Math.sin(a), rx: 0.28 + (i % 3) * 0.08, ry: 0.26 + (i % 2) * 0.09, rot: (i % 2 === 0 ? 1 : -1) * (2 + (i % 4)), i };
  });

const SPRING = { stiffness: 60, damping: 25, mass: 0.5 };

interface Stage {
  width: number;
  height: number;
  mobile: boolean;
}

function useParallax(enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING);
  const y = useSpring(rawY, SPRING);
  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, rawX, rawY]);
  return { x, y };
}

function TunnelCard({ card, progress, pointer, total, stage }: { card: Card; progress: MotionValue<number>; pointer: { x: MotionValue<number>; y: MotionValue<number> }; total: number; stage: Stage }) {
  const span = 0.55;
  const start = (card.i / total) * (1 - span);
  const local = useTransform(progress, [start, start + span], [0, 1]);
  const z = useTransform(local, [0, 1], stage.mobile ? [-1200, 350] : [-1700, 500]);
  const opacity = useTransform(local, [0, 0.18, 0.82, 0.98], [0, 1, 1, 0]);
  const width = stage.mobile ? Math.max(130, Math.min(180, stage.width * 0.38)) : Math.max(180, Math.min(260, stage.width * 0.17));
  const baseX = card.cos * (stage.width * card.rx);
  const baseY = card.sin * (stage.height * card.ry);
  const pan = stage.mobile ? 20 : 45;
  const transform = useTransform([z, pointer.x, pointer.y], ([cz, px, py]: number[]) => `translate3d(calc(-50% + ${baseX - px * pan}px), calc(-50% + ${baseY - py * pan}px), ${cz}px) rotateZ(${card.rot}deg)`);
  // Only the cards near the front take clicks, so far ones never catch a stray tap.
  const events = useTransform(local, (v) => (v > 0.45 && v < 0.9 ? "auto" : "none"));

  return (
    <motion.div style={{ width, transform, opacity, zIndex: card.i + 1, pointerEvents: events }} className="absolute left-1/2 top-1/2 aspect-[4/5] select-none will-change-transform">
      <Link href={`/product/${card.t.slug}`} tabIndex={-1} className="group relative block h-full w-full overflow-hidden rounded-[3px] bg-[#16161a] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10 transition-[box-shadow] duration-500 hover:ring-white/40">
        <ProductImage image={card.t.image} category={card.t.category} colourHex={card.t.hex} decorative ground="bg-transparent" sizes="260px" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
        <span className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/5 to-transparent p-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/75">{card.t.brand}</span>
          <span className="mt-1 text-[13px] text-white">{card.t.model}</span>
        </span>
      </Link>
    </motion.div>
  );
}

export default function PerspectiveTunnelHero({ pieces, eyebrow, title, line }: { pieces: TileData[]; eyebrow: string; title: [string, string]; line: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>({ width: 1440, height: 900, mobile: false });
  useEffect(() => {
    const update = () => setStage({ width: window.innerWidth, height: window.innerHeight, mobile: window.innerWidth < 768 });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // The flight follows the page's scroll through this section.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 30, restDelta: 0.0001 });
  const pointer = useParallax(!reduce);
  const titleScale = useTransform(progress, [0, 0.5, 1], [0.85, 1, 1.25]);
  const titleOpacity = useTransform(progress, [0, 0.08, 0.85, 1], [0.6, 1, 1, 0]);
  const cue = useTransform(progress, [0, 0.08], [1, 0]);
  const cards = toCards(pieces.slice(0, 9));

  const words = (
    <>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.4em] text-white/75">{eyebrow}</p>
      <h1 className="mt-5 font-serif text-[clamp(3.4rem,1.8rem+7vw,9rem)] font-light leading-[0.88] tracking-[-0.02em] text-[#ede8df]">
        {title[0]}
        <br />
        <em className="italic text-white/70">{title[1]}</em>
      </h1>
      <p className="mt-6 max-w-[38ch] text-[14px] leading-relaxed text-white/75 sm:text-[15px]">{line}</p>
    </>
  );

  if (reduce) {
    return (
      <section ref={ref} className="relative bg-[var(--lx-ground,#0e0d0c)] px-4 pb-16 pt-28 text-center">
        <div className="mx-auto flex max-w-xl flex-col items-center">{words}</div>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
          {pieces.slice(0, 8).map((t) => (
            <Link key={t.id} href={`/product/${t.slug}`} className="relative aspect-[4/5] overflow-hidden rounded-[3px] bg-[#16161a] ring-1 ring-white/10">
              <ProductImage image={t.image} category={t.category} colourHex={t.hex} decorative ground="bg-transparent" sizes="240px" className="h-full w-full object-cover" />
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} aria-label={title.join(" ")} className="relative h-[260svh] bg-[var(--lx-ground,#0e0d0c)]">
      <div className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden text-white" style={{ perspective: stage.mobile ? "900px" : "1200px", transformStyle: "preserve-3d" }}>
        {/* A soft pool of light at the centre, and two faint depth rings */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(237,232,223,0.08)_0%,transparent_65%)]" />
        <div aria-hidden className="pointer-events-none absolute h-[48vmin] w-[48vmin] rounded-full border border-white/[0.06]" />
        <div aria-hidden className="pointer-events-none absolute h-[78vmin] w-[78vmin] rounded-full border border-white/[0.04]" />

        <motion.div style={{ scale: titleScale, opacity: titleOpacity }} className="pointer-events-none z-0 flex max-w-xl flex-col items-center px-6 text-center">
          {words}
        </motion.div>

        <motion.div style={{ opacity: cue }} aria-hidden className="pointer-events-none absolute bottom-8 z-20 flex flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/70">
          <span>Scroll</span>
          <span className="h-8 w-px bg-gradient-to-b from-white/60 to-transparent" />
        </motion.div>

        <div className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {cards.map((c) => (
            <TunnelCard key={c.t.id} card={c} progress={progress} pointer={pointer} total={cards.length} stage={stage} />
          ))}
        </div>
      </div>
    </section>
  );
}
