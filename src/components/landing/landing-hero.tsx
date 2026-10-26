"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;
const GLIDE = [0.65, 0, 0.35, 1] as const;
/** How long the word shows before it opens into the tiles, in ms. */
const WORD_MS = 3400;

export interface LandingTile {
  label: string;
  href: string;
  images: string[];
}

/**
 * The top of the home page, above the rail (owner, 26 Oct 2026, after a Zara redesign; it plays
 * by itself, no scrolling). First EASYPICK, huge in a didone, our darker black-and-white pictures
 * crossfading and drifting inside the letters, with a small line above it and "Kathmandu" under it;
 * a tap skips ahead. Then the word grows away and four tiles rise out of its place at different
 * heights (Tees, Hoodies, Jackets, Bottoms) that then scroll sideways on their own (pausing when
 * pointed at), each changing its picture on its own rhythm, with one
 * quiet line and "Shop all" under them. Everything below (the rail and the rest) is unchanged.
 * People who ask for less motion get the tiles straight away.
 */
export function LandingHero({ words, tiles, line }: { words: string[]; tiles: LandingTile[]; /** The small line over the word. */ line: string }) {
  const still = useReducedMotion();
  const [stage, setStage] = useState<"word" | "tiles">("word");
  useEffect(() => {
    if (still || stage !== "word") return;
    const t = setTimeout(() => setStage("tiles"), WORD_MS);
    return () => clearTimeout(t);
  }, [still, stage]);
  const show = still ? "tiles" : stage;

  return (
    <section aria-labelledby="landing-title" className="relative isolate flex min-h-[calc(100svh-56px-env(safe-area-inset-bottom))] flex-col justify-center overflow-hidden bg-white pb-8 pt-[96px] lg:min-h-svh lg:pt-[112px]">
      <h1 id="landing-title" className="sr-only">
        Easypick: men&apos;s streetwear in Kathmandu
      </h1>

      <AnimatePresence mode="wait" initial={false}>
        {show === "word" ? (
          <motion.button
            key="word"
            type="button"
            onClick={() => setStage("tiles")}
            aria-label="Skip to the collections"
            className="absolute inset-0 isolate cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.9, ease: EASE } }}
            exit={{ opacity: 0, scale: 1.35, filter: "blur(6px)", transition: { duration: 0.8, ease: GLIDE } }}
          >
            <Drift words={words} />
            {/* A white sheet with black letters, screened over the pictures: the pictures show only inside the letters */}
            <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center bg-white mix-blend-screen">
              <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.4 }} className="mb-[2vw] font-mono text-[10px] uppercase tracking-[0.4em] text-black md:text-[11px]">
                {line}
              </motion.span>
              <motion.span initial={{ letterSpacing: "0.04em", opacity: 0 }} animate={{ letterSpacing: "-0.045em", opacity: 1 }} transition={{ duration: 1.6, ease: EASE }} className="hidden whitespace-nowrap font-[family-name:var(--font-didone)] text-[18vw] font-medium leading-none text-black md:block">
                EASYPICK
              </motion.span>
              <span className="text-center font-[family-name:var(--font-didone)] text-[30vw] font-medium leading-[0.82] tracking-[-0.045em] text-black md:hidden">
                EASY
                <br />
                PICK
              </span>
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.7 }} className="mt-[2vw] font-mono text-[10px] uppercase tracking-[0.4em] text-black md:text-[11px]">
                Kathmandu
              </motion.span>
            </span>
          </motion.button>
        ) : (
          <motion.div key="tiles" className="w-full" initial={false}>
            {/* The tiles, gliding in from the right and then scrolling sideways on their own; two copies make the loop seamless */}
            <motion.div initial={still ? false : { opacity: 0, x: "30vw" }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.2, ease: EASE }} className="overflow-hidden">
              <div className={`flex w-max ${still ? "" : "landing-row"}`}>
                {[0, 1].map((copy) => (
                  <ul key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 items-start gap-4 pr-4 md:gap-[3vw] md:pr-[3vw]">
                    {tiles.map((t, i) => (
                      <li key={t.label} className={`w-[44vw] shrink-0 md:w-[21vw] ${["mt-0", "mt-[7vh]", "mt-[2vh]", "mt-[10vh]", "mt-[4vh]", "mt-[8vh]"][i % 6]}`}>
                        <TileBody t={t} i={i} still={!!still} hidden={copy === 1} />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </motion.div>
            {/* One quiet line, and the way into everything */}
            <motion.div initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.9 }} className="container-ep mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-5 md:mt-14">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[#555]">Fixed prices · Same online and in store</p>
              <Link href="/shop" className="group inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#111]">
                <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:100%_1px] bg-bottom bg-no-repeat pb-1 transition-[background-size] duration-500 group-hover:bg-[length:0%_1px]">Shop all</span>
                <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
              </Link>
            </motion.div>
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
    const t = setInterval(() => setAt((i) => (i + 1) % words.length), 1200);
    return () => clearInterval(t);
  }, [words.length]);
  return (
    <span className="absolute inset-0 block bg-[#111]">
      {words.map((src, i) => (
        <motion.span key={src} className="absolute inset-0 block" initial={false} animate={{ opacity: i === at ? 1 : 0, scale: i === at ? 1.12 : 1.02 }} transition={{ opacity: { duration: 0.8, ease: "easeInOut" }, scale: { duration: 3.4, ease: "linear" } }}>
          <Image src={src} alt="" fill priority={i === 0} sizes="100vw" className="object-cover grayscale contrast-[1.25] brightness-[0.85]" />
        </motion.span>
      ))}
    </span>
  );
}

/** One tile: its pictures, changing on their own rhythm (each a little out of step), its name, and "Shop" on hover. */
function TileBody({ t, i, still, hidden }: { t: LandingTile; i: number; still: boolean; /** The second copy in the loop: out of the tab order. */ hidden?: boolean }) {
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (still || held || t.images.length < 2) return;
    const t1 = setTimeout(() => setAt((a) => (a + 1) % t.images.length), 2000 + i * 450);
    return () => clearTimeout(t1);
  }, [at, still, held, i, t.images.length]);
  return (
    <Link href={t.href} tabIndex={hidden ? -1 : undefined} onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)} className="group block outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111]">
      <span className="relative block aspect-[3/4] overflow-hidden bg-[#ececea]">
        {t.images.map((src, k) => (
          <Image key={src} src={src} alt="" fill priority={k === 0} sizes="(min-width: 768px) 22vw, 46vw" className={`object-cover grayscale transition-[opacity,transform,filter] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05] group-hover:grayscale-0 ${k === at ? "opacity-100" : "opacity-0"}`} />
        ))}
        <span aria-hidden className="absolute inset-x-0 bottom-0 translate-y-full bg-white/95 py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#111] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-focus-visible:translate-y-0">
          Shop {t.label.toLowerCase()}
        </span>
      </span>
      <motion.span initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.8 + i * 0.12 }} className="mt-3 block text-center font-[family-name:var(--font-didone)] text-[13px] font-medium uppercase tracking-[0.16em] text-[#111]">
        {t.label}
      </motion.span>
    </Link>
  );
}
