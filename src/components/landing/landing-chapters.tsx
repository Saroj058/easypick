"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;
/** The sideways glide, as in the reference (a short delay, then 1.2 s), in ms. */
const GLIDE = 1280;

export interface ChapterData {
  label: string;
  /** Lines of the big title; the word in *stars* is set in italic. */
  title: string[];
  line: string;
  href: string;
  cta: string;
  /** "left": big picture left, words right; "right": the other way; "figure": a cut-out person in front of the words. */
  layout: "left" | "right" | "figure";
  big: string;
  /** CSS object-position for the big picture, e.g. "50% 20%". */
  bigAt?: string;
  small?: string;
  figure?: { src: string; width: number; height: number };
  /** How to use it, in three short steps ("Pick a size", "Buy now", "Pay"). Shown instead of facts. */
  steps?: [string, string, string];
  /** Or two short facts, true to the store. */
  facts?: [string, string];
}

const wrap = (n: number, i: number) => ((i % n) + n) % n;
const subVis = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
const useTabHidden = () => useSyncExternalStore(subVis, () => document.hidden, () => false);

/** How long a chapter rests after its glide: long enough to read it, never so long it stands still (ms). */
function restFor(ch: ChapterData) {
  const words = [...ch.title, ch.line, ...(ch.steps ?? ch.facts ?? [])].join(" ").split(/\s+/).length;
  return Math.min(5200, Math.max(3400, 1400 + words * 120));
}

// The same picture sizes for the slides and for fetching the next chapter early, so nothing loads twice.
const SIZES = { big: "(min-width: 768px) 30vw, 92vw", small: "(min-width: 768px) 12vw, 1px", figure: "(min-width: 768px) 420px, 50vw" };

/**
 * As in the reference: nothing fades. The old chapter slides out left and the new one in from the
 * right on one ease-in-out curve, each layer travelling a screen-width times its depth, so the
 * pictures and words slide past each other (far pictures lag, near ones and the figure run ahead).
 */
const SLIDE = [0.7, 0, 0.2, 1] as const;
const layer = (depth: number, still: boolean): Variants => ({
  enter: (d: number) => (still ? { opacity: 0 } : { x: `${d * 100 * depth}vw` }),
  center: { x: 0, opacity: 1, transition: { duration: still ? 0.4 : 1.2, ease: SLIDE, delay: still ? 0 : 0.08 } },
  exit: (d: number) => (still ? { opacity: 0, transition: { duration: 0.3 } } : { x: `${-d * 100 * depth}vw`, transition: { duration: 1.2, ease: SLIDE, delay: 0.08 } }),
});
/** Inside the words, one piece after another settles as the slide lands: label, title lines, line, steps, link. */
const item = (k: number, still: boolean, mask = false): Variants =>
  still ? {} : { enter: mask ? { y: "105%" } : { y: 12, opacity: 0 }, center: { y: 0, opacity: 1, transition: { delay: 0.55 + k * 0.08, duration: 0.9, ease: EASE } } };

/** "The *heavy* tee" → The <em>heavy</em> tee, rising out of its own mask. */
function Line({ text, k, still }: { text: string; k: number; still: boolean }) {
  const parts = text.split(/(\*[^*]+\*)/);
  return (
    <span className="-mb-[0.1em] -mr-[0.1em] block overflow-hidden pb-[0.1em] pr-[0.1em]">
      <motion.span className="block" variants={item(k, still, true)}>
        {parts.map((p, i) => (p.startsWith("*") ? <em key={i} className="italic text-[#111]/60">{p.slice(1, -1)}</em> : <span key={i}>{p}</span>))}{" "}
      </motion.span>
    </span>
  );
}

/**
 * The home's chapters (owner, 26 Oct 2026, after a parallax editorial reference; plays by itself, no
 * scrolling): after the EASYPICK opening, one chapter at a time slides in sideways, its pictures and
 * words at different depths. They explain the whole system and how to use it (planned with ten agents:
 * story, copy, facts checked against the code, pictures, motion, access): a headline, a line, three
 * steps or two facts, and one way to learn more. Each rests long enough to read (it depends on the
 * words), with the pictures and title still drifting so it never stands still. A big *0N counter with a
 * line that fills, a pause button, arrows and dots; swipe on phones, arrow keys; it holds while pointed
 * at or used, and when the tab is hidden. People who ask for less motion get still chapters.
 */
export function LandingChapters({ chapters }: { chapters: ChapterData[] }) {
  const still = !!useReducedMotion();
  const [[page, dir], setPage] = useState<[number, number]>([0, 1]);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [stopped, setStopped] = useState(false);
  const tabHidden = useTabHidden();
  const panned = useRef(false);
  const n = chapters.length;
  const at = wrap(n, page);
  const ch = chapters[at];
  const next = chapters[wrap(n, page + 1)];
  const rest = restFor(ch);
  const paused = still || stopped || hover || focus || tabHidden || n < 2;
  const go = (d: number) => setPage(([p]) => [p + d, d]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setPage(([p]) => (wrap(n, p) === n - 1 ? [p - (n - 1), -1] : [p + 1, 1])), GLIDE + rest);
    return () => clearTimeout(t);
  }, [page, paused, n, rest]);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="How Easypick works"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocus(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        else if (e.key === "ArrowLeft") go(-1);
      }}
      className="absolute inset-0 overflow-hidden bg-white text-[#111]"
    >
      {/* Swipe: panning never moves the slide itself; pan-y keeps the page scrolling */}
      <motion.div
        className="absolute inset-0 touch-pan-y"
        onPanStart={() => (panned.current = true)}
        onPanEnd={(_, i) => {
          if (Math.abs(i.offset.x) > 60 || Math.abs(i.velocity.x) > 400) {
            setStopped(true);
            go(i.offset.x < 0 ? 1 : -1);
          }
          setTimeout(() => (panned.current = false), 0);
        }}
        onClickCapture={(e) => panned.current && e.preventDefault()}
      >
        <AnimatePresence initial={false} custom={dir}>
          <motion.div key={page} custom={dir} initial="enter" animate="center" exit="exit" className="absolute inset-0" role="group" aria-roledescription="slide" aria-label={`${at + 1} of ${n}: ${ch.label}`}>
            <Slide ch={ch} still={still} dir={dir} first={page === 0} rest={rest} />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* The next chapter's pictures, fetched quietly at the same sizes so it arrives ready */}
      <div aria-hidden className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0">
        {(
          [
            [next.big, SIZES.big],
            [next.small, SIZES.small],
            [next.figure?.src, SIZES.figure],
          ] as const
        )
          .filter(([src]) => src)
          .map(([src, sizes]) => (
            <Image key={src} src={src!} alt="" width={1} height={1} sizes={sizes} loading="eager" fetchPriority="low" />
          ))}
      </div>

      {/* The big counter, with a line that fills while the chapter rests */}
      <div aria-hidden className="pointer-events-none absolute bottom-5 right-4 z-30 text-right md:bottom-8 md:right-[4vw]">
        <div className="flex items-baseline justify-end gap-1 font-[family-name:var(--font-didone)] leading-none">
          <span className="text-[26px] md:text-[34px]">*</span>
          <span className="relative block h-[40px] overflow-hidden md:h-[58px]">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.span key={page} custom={dir} className="block text-[40px] font-medium tabular-nums md:text-[58px]" variants={{ enter: (d: number) => ({ y: d > 0 ? "100%" : "-100%" }), center: { y: 0 }, exit: (d: number) => ({ y: d > 0 ? "-100%" : "100%" }) }} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: EASE }}>
                {String(at + 1).padStart(2, "0")}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="ml-1 text-[12px] text-[#111]/60">/ {String(n).padStart(2, "0")}</span>
        </div>
        <span className="mt-2 block h-px w-24 bg-[#111]/15 md:w-32">
          {!paused && <motion.span key={page} className="block h-px origin-left bg-[#111]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: GLIDE / 1000, duration: rest / 1000, ease: "linear" }} />}
        </span>
      </div>

      {/* Pause, arrows and dots: always visible, 44px */}
      <div className="absolute bottom-4 left-1 z-30 flex items-center md:bottom-7 md:left-[3.4vw]">
        {!still && (
          <button type="button" onClick={() => setStopped((s) => !s)} aria-pressed={stopped} aria-label={stopped ? "Play the chapters" : "Pause the chapters"} className="grid size-11 cursor-pointer place-items-center text-[#111]">
            {stopped ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5v14l12-7z" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
            )}
          </button>
        )}
        <button type="button" onClick={() => { setStopped(true); go(-1); }} aria-label="Previous chapter" className="grid size-11 cursor-pointer place-items-center text-[#111]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        {chapters.map((c, i) => (
          <button key={c.label} type="button" aria-label={c.label} aria-current={i === at || undefined} onClick={() => { setStopped(true); if (i !== at) setPage(([p]) => [p + i - at, i > at ? 1 : -1]); }} className="hidden h-11 w-7 cursor-pointer place-items-center md:grid">
            <span className={`block h-px transition-all duration-500 ${i === at ? "w-6 bg-[#111]" : "w-3 bg-[#111]/30"}`} />
          </button>
        ))}
        <button type="button" onClick={() => { setStopped(true); go(1); }} aria-label="Next chapter" className="grid size-11 cursor-pointer place-items-center text-[#111]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
      <p className="sr-only" aria-live="polite">{paused ? `${ch.label}, ${at + 1} of ${n}` : ""}</p>
    </div>
  );
}

function Slide({ ch, still, dir, first, rest }: { ch: ChapterData; still: boolean; dir: number; first: boolean; rest: number }) {
  const right = ch.layout === "right";
  const fig = ch.layout === "figure";
  const life = (GLIDE + rest) / 1000 + 1.2;
  // Where things sit. Phones: the words on top, one picture under them. Computers: side by side.
  const big = fig
    ? "left-4 bottom-[13%] h-[26%] w-[44vw] md:bottom-auto md:left-[8vw] md:top-[20%] md:h-[58%] md:w-[22vw]"
    : right
      ? "left-4 right-4 bottom-[13%] h-[26%] md:left-auto md:bottom-auto md:right-[7vw] md:top-[15%] md:h-[70%] md:w-[30vw]"
      : "left-4 right-4 bottom-[13%] h-[26%] md:bottom-auto md:left-[7vw] md:right-auto md:top-[15%] md:h-[70%] md:w-[30vw]";
  const small = right ? "md:right-[32vw] md:top-[58%] md:h-[28%] md:w-[12vw]" : "md:left-[32vw] md:top-[60%] md:h-[28%] md:w-[12vw]";
  const words = fig
    ? "left-4 right-4 top-[11%] md:left-[34vw] md:right-[6vw] md:top-[20%]"
    : right
      ? "left-4 right-4 top-[11%] md:left-[8vw] md:right-auto md:top-1/2 md:w-[40vw] md:-translate-y-1/2"
      : "left-4 right-4 top-[11%] md:left-auto md:right-[8vw] md:top-1/2 md:w-[40vw] md:-translate-y-1/2";
  // On computers the left-layout words sit on the right: the title lines up right, the reading text stays left-aligned in a block on the right.
  const end = !right && !fig;

  return (
    <>
      {/* The big picture (far, slow) */}
      <motion.div custom={dir} variants={layer(0.85, still)} className={`absolute z-[1] overflow-hidden bg-[#ececea] will-change-transform ${big}`}>
        <motion.div className="h-full w-full" initial={false} animate={still ? undefined : { scale: [1.02, 1.08] }} transition={{ duration: life, ease: "linear" }}>
          <Image src={ch.big} alt="" fill priority={first} sizes={SIZES.big} className="object-cover grayscale" style={{ objectPosition: ch.bigAt ?? "50% 50%" }} />
        </motion.div>
      </motion.div>
      {/* The small picture (near, fast; computers only) */}
      {ch.small && (
        <motion.div custom={dir} variants={layer(1.25, still)} className={`absolute z-[3] hidden overflow-hidden bg-[#ececea] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)] will-change-transform md:block ${small}`}>
          <motion.div className="h-full w-full" initial={false} animate={still ? undefined : { x: [0, -22], scale: [1.06, 1.06] }} transition={{ duration: life, ease: "linear" }}>
            <Image src={ch.small} alt="" fill sizes={SIZES.small} className="object-cover grayscale" />
          </motion.div>
        </motion.div>
      )}
      {/* The words */}
      <motion.div custom={dir} variants={layer(1, still)} className={`absolute z-[2] will-change-transform ${words}`}>
        <motion.p variants={item(0, still)} className={`font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#555] ${end ? "md:text-right" : ""}`}>
          {ch.label}
        </motion.p>
        {/* The title drifts a little while it rests, so it never stands still; the reading text stays put */}
        <h2
          className={`mt-3 font-[family-name:var(--font-didone)] font-normal uppercase leading-[0.86] tracking-[-0.03em] ${end ? "md:text-right" : ""} ${fig ? "text-[clamp(3rem,15vw,5rem)] md:text-[11vw]" : "text-[clamp(2.4rem,11.5vw,4.2rem)] md:text-[5.8vw]"}`}
          style={still ? undefined : { animation: `chapter-drift ${life}s linear forwards` }}
        >
          {ch.title.map((t, k) => (
            <Line key={t} text={t} k={k + 1} still={still} />
          ))}
        </h2>
        <div className={`max-w-[36ch] ${end ? "md:ml-auto" : ""} ${fig ? "md:mt-[28vh]" : ""}`}>
          <motion.p variants={item(3, still)} className="mt-4 text-[13.5px] leading-relaxed text-[#111]/75 md:mt-7 md:text-[14.5px]">
            {ch.line}
          </motion.p>
          <motion.div variants={item(4, still)}>
            <Info ch={ch} />
          </motion.div>
          <motion.div variants={item(5, still)}>
            <Link href={ch.href} className="group mt-3 inline-flex min-h-11 w-fit items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#111] md:mt-4">
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:100%_1px] bg-bottom bg-no-repeat pb-1 transition-[background-size] duration-500 group-hover:bg-[length:0%_1px]">{ch.cta}</span>
              <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
            </Link>
          </motion.div>
        </div>
      </motion.div>
      {/* A cut-out person in front of the words (the Vault) */}
      {ch.figure && (
        <motion.div custom={dir} variants={layer(1.35, still)} className="pointer-events-none absolute bottom-[12%] right-[2vw] z-[4] h-[40%] will-change-transform md:bottom-0 md:right-[12vw] md:h-[90%]">
          <Image src={ch.figure.src} alt="" width={ch.figure.width} height={ch.figure.height} sizes={SIZES.figure} className="h-full w-auto object-contain [filter:drop-shadow(0_30px_40px_rgba(0,0,0,0.2))]" />
        </motion.div>
      )}
    </>
  );
}

/** How to use it in three numbered steps, or two facts. */
function Info({ ch }: { ch: ChapterData }) {
  if (ch.steps)
    return (
      <ol className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.16em] md:mt-5">
        {ch.steps.map((s, i) => (
          <li key={s} className="flex items-baseline gap-2">
            <span className="text-[#111]">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-[#111]/70">{s}</span>
          </li>
        ))}
      </ol>
    );
  if (!ch.facts) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#111]/70 md:mt-5">
      {ch.facts.map((f) => (
        <li key={f} className="flex items-center gap-2">
          <span aria-hidden className="h-px w-3 bg-[#111]/40" />
          {f}
        </li>
      ))}
    </ul>
  );
}
