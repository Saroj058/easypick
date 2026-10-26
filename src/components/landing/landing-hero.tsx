"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

import { LandingChapters, type ChapterData } from "./landing-chapters";

const EASE = [0.16, 1, 0.3, 1] as const;
const GLIDE = [0.65, 0, 0.35, 1] as const;
/** How long the word shows before the chapters, in ms. */
const WORD_MS = 2800;
/** Set once the word has played: it plays once per visit (until the tab or window is closed). */
const SEEN = "ep-intro-seen";

// Whether this visit has already seen the word. Unknown on the server and while the page wakes up
// (so nothing flashes), then read from this tab's session.
const noop = () => () => {};
function readSeen(): "seen" | "new" {
  try {
    return sessionStorage.getItem(SEEN) ? "seen" : "new";
  } catch {
    return "new";
  }
}
function markSeen() {
  try {
    sessionStorage.setItem(SEEN, "1");
  } catch {
    /* private mode: it simply plays again next time */
  }
}


/**
 * The top of the home page, above the rail (owner, 26 Oct 2026; it all plays by itself, no
 * scrolling). First EASYPICK, huge and bold in a didone, our dark black-and-white pictures crossfading
 * inside the letters, a small line above and "Kathmandu" under it (a tap skips ahead). It plays once
 * per visit; coming back to the home page during the same visit goes straight to the chapters. Then the collections,
 * one chapter at a time sliding sideways with depth, after a parallax editorial reference
 * (landing-chapters.tsx). Everything below (the rail and the rest) is unchanged. People who ask for
 * less motion go straight to still chapters.
 */
export function LandingHero({ words, chapters, line }: { words: string[]; chapters: ChapterData[]; /** The small line over the word. */ line: string }) {
  const still = useReducedMotion();
  const status = useSyncExternalStore(noop, readSeen, () => "unknown" as const);
  const [stage, setStage] = useState<"word" | "chapters">("word");
  const done = () => {
    markSeen();
    setStage("chapters");
  };
  useEffect(() => {
    if (status !== "new" || stage !== "word") return;
    const t = setTimeout(() => {
      markSeen();
      setStage("chapters");
    }, WORD_MS);
    return () => clearTimeout(t);
  }, [status, stage]);
  // The word shows for everyone the first time (still, for people who ask for less motion).
  const show = status === "unknown" ? null : status === "seen" ? "chapters" : stage;

  return (
    <section aria-labelledby="landing-title" className="relative isolate h-[86svh] min-h-[600px] overflow-hidden bg-white md:h-svh md:min-h-[640px]">
      <h1 id="landing-title" className="sr-only">
        Easypick: men&apos;s streetwear in Kathmandu
      </h1>
      {/* In the page's first HTML (before it knows whether the word has played), the chapters as plain links, for search engines */}
      {show === null && (
        <ul className="sr-only">
          {chapters.map((c) => (
            <li key={c.label}>
              <a href={c.href}>{`${c.label}: ${c.line}`}</a>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence initial={false}>
        {show === "word" ? (
          <motion.button
            key="word"
            type="button"
            onClick={done}
            aria-label="Skip the intro"
            className="absolute inset-0 isolate cursor-pointer"
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.9, ease: EASE } }}
            exit={still ? { opacity: 0 } : { opacity: 0, scale: 1.35, filter: "blur(6px)", transition: { duration: 0.8, ease: GLIDE } }}
          >
            <Drift words={words} />
            {/* A white sheet with black letters, screened over the pictures: the pictures show only inside the letters */}
            <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center bg-white mix-blend-screen">
              <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.4 }} className="mb-[2vw] font-mono text-[10px] uppercase tracking-[0.4em] text-black md:text-[11px]">
                {line}
              </motion.span>
              <motion.span initial={still ? false : { letterSpacing: "0.04em", opacity: 0 }} animate={{ letterSpacing: "-0.045em", opacity: 1 }} transition={{ duration: 1.6, ease: EASE }} className="hidden whitespace-nowrap font-[family-name:var(--font-didone)] text-[18vw] font-bold leading-none text-black md:block">
                EASYPICK
              </motion.span>
              <span className="text-center font-[family-name:var(--font-didone)] text-[30vw] font-bold leading-[0.82] tracking-[-0.045em] text-black md:hidden">
                EASY
                <br />
                PICK
              </span>
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.7 }} className="mt-[2vw] font-mono text-[10px] uppercase tracking-[0.4em] text-black md:text-[11px]">
                Kathmandu
              </motion.span>
            </span>
          </motion.button>
        ) : show === null ? null : (
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
    <span className="absolute inset-0 block bg-[#0a0a0a]">
      {words.map((src, i) => (
        <motion.span key={src} className="absolute inset-0 block" initial={false} animate={{ opacity: i === at ? 1 : 0, scale: i === at ? 1.12 : 1.02 }} transition={{ opacity: { duration: 0.8, ease: "easeInOut" }, scale: { duration: 3.4, ease: "linear" } }}>
          <Image src={src} alt="" fill priority={i === 0} sizes="100vw" className="object-cover grayscale contrast-[1.4] brightness-[0.55]" />
        </motion.span>
      ))}
    </span>
  );
}
