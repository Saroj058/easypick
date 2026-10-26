"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

import { LandingChapters, type ChapterData } from "./landing-chapters";

const EASE = [0.16, 1, 0.3, 1] as const;
const GLIDE = [0.65, 0, 0.35, 1] as const;
/** How long the word shows before it opens into the tiles, in ms. */
const WORD_MS = 2600;


/**
 * The top of the home page, above the rail (owner, 26 Oct 2026; it all plays by itself, no
 * scrolling). First EASYPICK, huge in a didone, our darker black-and-white pictures crossfading inside
 * the letters, a small line above and "Kathmandu" under it (a tap skips ahead). Then the collections,
 * one chapter at a time sliding sideways with depth, after a parallax editorial reference
 * (landing-chapters.tsx). Everything below (the rail and the rest) is unchanged. People who ask for
 * less motion go straight to still chapters.
 */
export function LandingHero({ words, chapters, line }: { words: string[]; chapters: ChapterData[]; /** The small line over the word. */ line: string }) {
  const still = useReducedMotion();
  const [stage, setStage] = useState<"word" | "chapters">("word");
  useEffect(() => {
    if (still || stage !== "word") return;
    const t = setTimeout(() => setStage("chapters"), WORD_MS);
    return () => clearTimeout(t);
  }, [still, stage]);
  const show = still ? "chapters" : stage;

  return (
    <section aria-labelledby="landing-title" className="relative isolate h-[86svh] min-h-[600px] overflow-hidden bg-white md:h-svh md:min-h-[640px]">
      <h1 id="landing-title" className="sr-only">
        Easypick: men&apos;s streetwear in Kathmandu
      </h1>

      <AnimatePresence initial={false}>
        {show === "word" ? (
          <motion.button
            key="word"
            type="button"
            onClick={() => setStage("chapters")}
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
          <motion.div key="chapters" className="absolute inset-0" initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <LandingChapters chapters={chapters} />
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
