"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;
/** How long the word shows before it opens into the tiles, in ms. */
const WORD_MS = 3200;

export interface LandingTile {
  label: string;
  href: string;
  images: string[];
}

/**
 * The top of the home page, above the rail (owner, 26 Oct 2026, after a Zara redesign; it plays
 * by itself, no scrolling): first EASYPICK, huge in a didone, with our black-and-white pictures
 * crossfading inside the letters; then the word grows and fades and four tiles come in at
 * different heights (Tees, Hoodies, Jackets, Bottoms), each changing its picture on its own rhythm.
 * Everything below (the rail and the rest) is unchanged. People who ask for less motion get the
 * tiles straight away.
 */
export function LandingHero({ words, tiles }: { words: string[]; tiles: LandingTile[] }) {
  const still = useReducedMotion();
  const [stage, setStage] = useState<"word" | "tiles">("word");
  useEffect(() => {
    if (still) return;
    const t = setTimeout(() => setStage("tiles"), WORD_MS);
    return () => clearTimeout(t);
  }, [still]);
  const show = still ? "tiles" : stage;

  return (
    <section aria-labelledby="landing-title" className="relative isolate flex min-h-[calc(100svh-56px-env(safe-area-inset-bottom))] items-center overflow-hidden bg-white pb-10 pt-[88px] lg:min-h-svh lg:pt-[96px]">
      <h1 id="landing-title" className="sr-only">
        Easypick: men&apos;s streetwear in Kathmandu
      </h1>

      <AnimatePresence mode="wait" initial={false}>
        {show === "word" ? (
          // The word, with the pictures inside it (a white sheet with black letters, screened over the pictures)
          <motion.div key="word" aria-hidden className="absolute inset-0 isolate" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.8, ease: EASE } }} exit={{ opacity: 0, scale: 1.6, transition: { duration: 0.9, ease: [0.65, 0, 0.35, 1] } }}>
            <Drift words={words} />
            <div className="absolute inset-0 grid place-items-center bg-white mix-blend-screen">
              <span className="hidden whitespace-nowrap font-[family-name:var(--font-didone)] text-[18.5vw] font-medium leading-none tracking-[-0.045em] text-black md:block">EASYPICK</span>
              <span className="text-center font-[family-name:var(--font-didone)] text-[30vw] font-medium leading-[0.82] tracking-[-0.045em] text-black md:hidden">
                EASY
                <br />
                PICK
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div key="tiles" className="w-full" initial={false}>
            <div className="container-ep grid w-full grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-[3vw]">
              {tiles.slice(0, 4).map((t, i) => (
                <motion.div
                  key={t.label}
                  initial={still ? false : { opacity: 0, y: i < 2 ? "-30vh" : "30vh" }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, ease: EASE, delay: [0, 0.08, 0.24, 0.32][i] }}
                  className={["md:mt-0", "mt-10 md:mt-[10vh]", "md:-mt-[4vh]", "mt-10 md:mt-[5vh]"][i]}
                >
                  <TileBody t={t} i={i} still={!!still} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** The pictures inside the letters: crossfading, each drifting slowly, in black and white. */
function Drift({ words }: { words: string[] }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (words.length < 2) return;
    const t = setInterval(() => setAt((i) => (i + 1) % words.length), 1100);
    return () => clearInterval(t);
  }, [words.length]);
  return (
    <div className="absolute inset-0 bg-[#222]">
      {words.map((src, i) => (
        <motion.div key={src} className="absolute inset-0" initial={false} animate={{ opacity: i === at ? 1 : 0, scale: i === at ? 1.1 : 1 }} transition={{ opacity: { duration: 0.7, ease: "easeInOut" }, scale: { duration: 3, ease: "linear" } }}>
          <Image src={src} alt="" fill priority={i === 0} sizes="100vw" className="object-cover grayscale contrast-[1.2]" />
        </motion.div>
      ))}
    </div>
  );
}

/** One tile: its pictures, changing on their own rhythm (each a little out of step), and its name. */
function TileBody({ t, i, still }: { t: LandingTile; i: number; still: boolean }) {
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (still || held || t.images.length < 2) return;
    const t1 = setTimeout(() => setAt((a) => (a + 1) % t.images.length), 1800 + i * 450);
    return () => clearTimeout(t1);
  }, [at, still, held, i, t.images.length]);
  return (
    <Link href={t.href} onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)} className="group block outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111]">
      <span className="relative block aspect-[3/4] overflow-hidden bg-[#ececea]">
        {t.images.map((src, k) => (
          <Image key={src} src={src} alt="" fill priority={k === 0} sizes="(min-width: 768px) 22vw, 46vw" className={`object-cover grayscale transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] ${k === at ? "opacity-100" : "opacity-0"}`} />
        ))}
      </span>
      <motion.span initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.7 + i * 0.12 }} className="mt-3 block text-center font-[family-name:var(--font-didone)] text-[13px] font-medium uppercase tracking-[0.14em] text-[#111]">
        {t.label}
      </motion.span>
    </Link>
  );
}
