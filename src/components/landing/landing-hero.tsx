"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface LandingTile {
  label: string;
  href: string;
  images: string[];
}

/**
 * The home page's opening (owner, 26 Oct 2026, after a Zara redesign): EASYPICK set huge in a
 * didone, our black-and-white pictures crossfading and drifting inside the letters. As the page
 * scrolls the letters grow until the pictures fill the screen, fade to white, and four tiles take
 * their place at different heights (Tees, Hoodies, Jackets, Bottoms), each changing its picture on
 * its own rhythm. Everything follows the scroll, so it plays backwards too. People who ask for less
 * motion get the four tiles straight away, still.
 */
export function LandingHero({ words, tiles }: { words: string[]; tiles: LandingTile[] }) {
  const still = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 28, mass: 0.5 });

  // The wordmark: grows, then the whole picture-filled word fades to white.
  const scale = useTransform(p, [0, 0.3], [1, 2.6]);
  const wordFade = useTransform(p, [0.22, 0.36], [1, 0]);
  const cue = useTransform(p, [0, 0.06], [1, 0]);
  const [phase, setPhase] = useState<"word" | "tiles">("word");
  useMotionValueEvent(p, "change", (v) => setPhase(v > 0.3 ? "tiles" : "word"));

  if (still) {
    return (
      <section aria-labelledby="landing-title" className="bg-white pb-16 pt-28">
        <h1 id="landing-title" className="text-center font-[family-name:var(--font-didone)] text-[clamp(3.4rem,14vw,12rem)] font-normal leading-none tracking-[-0.03em] text-[#111]">
          EASYPICK
        </h1>
        <Tiles tiles={tiles} still />
      </section>
    );
  }

  return (
    <section ref={ref} aria-labelledby="landing-title" className="relative h-[300svh] bg-white">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <h1 id="landing-title" className="sr-only">
          Easypick: men&apos;s streetwear in Kathmandu
        </h1>

        {/* The word, with the pictures inside it (a white sheet with black letters, screened over the pictures) */}
        <motion.div aria-hidden style={{ opacity: wordFade }} className="absolute inset-0 isolate">
          <Drift words={words} />
          <motion.div style={{ scale }} className="absolute inset-0 grid place-items-center bg-white mix-blend-screen">
            <span className="hidden whitespace-nowrap font-[family-name:var(--font-didone)] text-[18.5vw] font-medium leading-none tracking-[-0.045em] text-black md:block">EASYPICK</span>
            <span className="text-center font-[family-name:var(--font-didone)] text-[30vw] font-medium leading-[0.82] tracking-[-0.045em] text-black md:hidden">
              EASY
              <br />
              PICK
            </span>
          </motion.div>
        </motion.div>

        {/* The four tiles, coming in as the word goes */}
        <TilesOnScroll tiles={tiles} p={p} live={phase === "tiles"} />

        {/* The way down */}
        <motion.div aria-hidden style={{ opacity: cue }} className="pointer-events-none absolute inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] flex flex-col items-center gap-2 md:bottom-8">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#111]/70">Scroll</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#111]/70">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.div>
      </div>
    </section>
  );
}

/** The pictures inside the letters: crossfading every few seconds, each drifting slowly, in black and white. */
function Drift({ words }: { words: string[] }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (words.length < 2) return;
    const t = setInterval(() => setAt((i) => (i + 1) % words.length), 2600);
    return () => clearInterval(t);
  }, [words.length]);
  return (
    <div className="absolute inset-0 bg-[#222]">
      {words.map((src, i) => (
        <motion.div key={src} className="absolute inset-0" initial={false} animate={{ opacity: i === at ? 1 : 0, scale: i === at ? 1.12 : 1 }} transition={{ opacity: { duration: 1.2, ease: "easeInOut" }, scale: { duration: 4.5, ease: "linear" } }}>
          <Image src={src} alt="" fill priority={i === 0} sizes="100vw" className="object-cover grayscale contrast-[1.15]" />
        </motion.div>
      ))}
    </div>
  );
}

// Where each tile rests, as in the reference: four across at different heights (mid, low, high, mid).
const DROP = [0, 12, -6, 6];

function TilesOnScroll({ tiles, p, live }: { tiles: LandingTile[]; p: MotionValue<number>; live: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center">
      <div className="container-ep grid w-full grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-[3vw]">
        {tiles.slice(0, 4).map((t, i) => (
          <OneTile key={t.label} t={t} i={i} p={p} live={live} />
        ))}
      </div>
    </div>
  );
}

function OneTile({ t, i, p, live }: { t: LandingTile; i: number; p: MotionValue<number>; live: boolean }) {
  // Tiles one and two come down from above, three and four up from below, a beat apart.
  const from = i < 2 ? -40 : 40;
  const start = 0.32 + i * 0.05;
  const y = useTransform(p, [start, start + 0.2], [`${from}vh`, "0vh"]);
  const opacity = useTransform(p, [start, start + 0.12], [0, 1]);
  const label = useTransform(p, [start + 0.14, start + 0.24], [0, 1]);
  return (
    <motion.div style={{ y, opacity, ["--d" as string]: `${DROP[i]}vh` }} className={`${live ? "" : "pointer-events-none"} md:mt-[var(--d)]`}>
      <div className={i % 2 ? "mt-10 md:mt-0" : ""}>
        <TileBody t={t} i={i} labelOpacity={label} />
      </div>
    </motion.div>
  );
}

function Tiles({ tiles, still }: { tiles: LandingTile[]; still?: boolean }) {
  return (
    <div className="container-ep mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-[3vw]">
      {tiles.slice(0, 4).map((t, i) => (
        <div key={t.label} className={i % 2 ? "mt-10 md:mt-16" : ""}>
          <TileBody t={t} i={i} still={still} />
        </div>
      ))}
    </div>
  );
}

/** One tile: its pictures, changing on their own rhythm (each tile a little out of step), and its name. */
function TileBody({ t, i, still, labelOpacity }: { t: LandingTile; i: number; still?: boolean; labelOpacity?: MotionValue<number> }) {
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (still || held || t.images.length < 2) return;
    const t1 = setTimeout(() => setAt((a) => (a + 1) % t.images.length), 1700 + i * 450);
    return () => clearTimeout(t1);
  }, [at, still, held, i, t.images.length]);
  return (
    <Link href={t.href} onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)} className="group block outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111]">
      <span className="relative block aspect-[3/4] overflow-hidden bg-[#ececea]">
        {t.images.map((src, k) => (
          <Image key={src} src={src} alt="" fill sizes="(min-width: 768px) 22vw, 46vw" className={`object-cover grayscale transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] ${k === at ? "opacity-100" : "opacity-0"}`} />
        ))}
      </span>
      <motion.span style={labelOpacity ? { opacity: labelOpacity } : undefined} className="mt-3 block text-center font-[family-name:var(--font-didone)] text-[13px] font-medium uppercase tracking-[0.14em] text-[#111]">
        {t.label}
      </motion.span>
    </Link>
  );
}
