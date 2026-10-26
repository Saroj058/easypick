"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";


const EASE = [0.16, 1, 0.3, 1] as const;
/** How long each chapter stays, in ms. */
const STAY = 5200;

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
  /** Two or three short facts, true to the store. */
  facts: string[];
}

const wrap = (n: number, i: number) => ((i % n) + n) % n;
const subVis = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
const useTabHidden = () => useSyncExternalStore(subVis, () => document.hidden, () => false);

/**
 * As in the reference: nothing fades. The old chapter slides out left and the new one in from the
 * right on one ease-in-out curve, each layer travelling a screen-width times its depth, so the
 * pictures and words slide past each other (far pictures lag, near ones and the figure run ahead).
 */
const SLIDE = [0.7, 0, 0.2, 1] as const;
const layer = (depth: number, still: boolean): Variants => ({
  enter: (d: number) => (still ? { opacity: 0 } : { x: `${d * 100 * depth}vw` }),
  center: { x: 0, opacity: 1, transition: { duration: still ? 0.4 : 1.2, ease: SLIDE } },
  exit: (d: number) => (still ? { opacity: 0, transition: { duration: 0.3 } } : { x: `${-d * 100 * depth}vw`, transition: { duration: 1.2, ease: SLIDE } }),
});

/** "The *heavy* tee" → The <em>heavy</em> tee */
function Line({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/);
  return (
    <span className="block">
      {parts.map((p, i) => (p.startsWith("*") ? <em key={i} className="italic text-[#111]/55">{p.slice(1, -1)}</em> : <span key={i}>{p}</span>))}
    </span>
  );
}

/**
 * The home's chapters (owner, 26 Oct 2026, after a parallax editorial reference; plays by itself, no
 * scrolling): after the EASYPICK opening, one chapter at a time slides in sideways, its pictures and
 * words at different depths. They inform, not sell (owner: "make it informative; I don't want what the
 * page already has"): how the store works, in a headline, a line, a few facts and one way to learn more. A big *0N counter with a line that fills, arrows, dots and a pause
 * button; swipe on phones, arrow keys; it holds while pointed at or used, and when the tab is hidden.
 * People who ask for less motion get still chapters they can step through.
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
  const paused = still || stopped || hover || focus || tabHidden || n < 2;
  const go = (d: number) => setPage(([p]) => [p + d, d]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setPage(([p]) => [p + 1, 1]), STAY);
    return () => clearTimeout(t);
  }, [page, paused]);

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
            <Slide ch={ch} i={at} still={still} dir={dir} first={page === 0} />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* The next chapter's pictures, fetched quietly so it arrives ready */}
      <div aria-hidden className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0">
        {[next.big, next.small, next.figure?.src].filter(Boolean).map((src) => (
          <Image key={src} src={src!} alt="" width={1} height={1} sizes="40vw" loading="eager" fetchPriority="low" />
        ))}
      </div>

      {/* The big counter, with a line that fills while the chapter stays */}
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
          <span className="ml-1 text-[12px] text-[#111]/50">/ {String(n).padStart(2, "0")}</span>
        </div>
        <span className="mt-2 block h-px w-24 bg-[#111]/15 md:w-32">
          {!paused && <motion.span key={page} className="block h-px origin-left bg-[#111]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: STAY / 1000, ease: "linear" }} />}
        </span>
      </div>

      {/* Arrows, dots and pause: always visible, 44px */}
      <div className="absolute bottom-4 left-1 z-30 flex items-center md:bottom-7 md:left-[3.4vw]">
        <button type="button" onClick={() => { setStopped(true); go(-1); }} aria-label="Previous chapter" className="grid size-11 cursor-pointer place-items-center text-[#111]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        {chapters.map((c, i) => (
          <button key={c.label} type="button" aria-label={`${c.label}`} aria-current={i === at || undefined} onClick={() => { setStopped(true); if (i !== at) setPage(([p]) => [p + i - at, i > at ? 1 : -1]); }} className="hidden size-11 cursor-pointer place-items-center md:grid">
            <span className={`block h-px transition-all duration-500 ${i === at ? "w-6 bg-[#111]" : "w-3 bg-[#111]/30"}`} />
          </button>
        ))}
        <button type="button" onClick={() => { setStopped(true); go(1); }} aria-label="Next chapter" className="grid size-11 cursor-pointer place-items-center text-[#111]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
        </button>
        {!still && (
          <button type="button" onClick={() => setStopped((s) => !s)} aria-pressed={stopped} aria-label={stopped ? "Play the chapters" : "Pause the chapters"} className="grid size-11 cursor-pointer place-items-center text-[#111]">
            {stopped ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5v14l12-7z" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
            )}
          </button>
        )}
      </div>
      <p className="sr-only" aria-live={paused ? "polite" : "off"}>{`${ch.label}, ${at + 1} of ${n}`}</p>
    </div>
  );
}

function Slide({ ch, i, still, dir, first }: { ch: ChapterData; i: number; still: boolean; dir: number; first: boolean }) {
  const right = ch.layout === "right";
  const fig = ch.layout === "figure";
  // Where things sit. Phones: the words on top, the pictures under them. Computers: side by side.
  const big = fig
    ? "right-4 top-[38%] h-[44%] w-[46vw] md:left-[8vw] md:right-auto md:top-[20%] md:h-[58%] md:w-[22vw]"
    : right
      ? "right-4 top-[36%] h-[46%] w-[60vw] md:right-[7vw] md:top-[15%] md:h-[72%] md:w-[31vw]"
      : "right-4 top-[36%] h-[46%] w-[60vw] md:left-[7vw] md:right-auto md:top-[15%] md:h-[72%] md:w-[31vw]";
  const small = right ? "left-4 top-[58%] h-[24%] w-[34vw] md:left-auto md:right-[33vw] md:top-[56%] md:h-[30%] md:w-[13vw]" : "left-4 top-[58%] h-[24%] w-[34vw] md:left-[33vw] md:top-[58%] md:h-[30%] md:w-[13vw]";
  const words = fig
    ? "left-4 right-4 top-[13%] md:left-[34vw] md:right-[6vw] md:top-[20%]"
    : right
      ? "left-4 right-4 top-[13%] md:left-[7vw] md:right-auto md:top-1/2 md:w-[42vw] md:-translate-y-1/2"
      : "left-4 right-4 top-[13%] md:left-auto md:right-[7vw] md:top-1/2 md:w-[42vw] md:-translate-y-1/2";

  return (
    <>
      {/* The big picture (far, slow) */}
      <motion.div custom={dir} variants={layer(0.85, still)} className={`absolute z-[1] overflow-hidden bg-[#ececea] ${big}`}>
        <motion.div className="h-full w-full" initial={false} animate={still ? undefined : { scale: [1.02, 1.08] }} transition={{ duration: STAY / 1000 + 1, ease: "linear" }}>
          <Image src={ch.big} alt="" fill priority={first} sizes="(min-width: 768px) 32vw, 60vw" className="object-cover grayscale" style={{ objectPosition: ch.bigAt ?? "50% 50%" }} />
        </motion.div>
      </motion.div>
      {/* The small picture (near, fast) */}
      {ch.small && (
        <motion.div custom={dir} variants={layer(1.25, still)} className={`absolute z-[3] overflow-hidden bg-[#ececea] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)] ${small}`}>
          <Image src={ch.small} alt="" fill sizes="(min-width: 768px) 14vw, 34vw" className="object-cover grayscale" />
        </motion.div>
      )}
      {/* The words */}
      <motion.div custom={dir} variants={layer(1, still)} className={`absolute z-[2] ${words} ${right ? "" : "md:text-right"}`}>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#555]">
          *{String(i + 1).padStart(2, "0")} · {ch.label}
        </p>
        <h2 className={`mt-3 font-[family-name:var(--font-didone)] font-normal uppercase leading-[0.86] tracking-[-0.03em] ${fig ? "text-[clamp(3rem,15vw,5rem)] md:text-[11vw]" : "text-[clamp(2.6rem,12vw,4.2rem)] md:text-[6.6vw]"}`}>
          {ch.title.map((t) => (
            <Line key={t} text={t} />
          ))}
        </h2>
        <div className={`hidden md:block ${fig ? "md:mt-[32vh] md:max-w-[30vw]" : "md:mt-6"} ${right ? "" : "md:ml-auto md:max-w-[34ch]"}`}>
          <p className="max-w-[34ch] text-[14px] leading-relaxed text-[#111]/70 md:ml-[inherit]">{ch.line}</p>
        </div>
        <InfoRow ch={ch} alignRight={!right && !fig} />
      </motion.div>
      {/* A cut-out person in front of the words (the Vault) */}
      {ch.figure && (
        <motion.div custom={dir} variants={layer(1.35, still)} className="pointer-events-none absolute bottom-0 right-[2vw] z-[4] h-[62%] md:right-[12vw] md:h-[90%]">
          <Image src={ch.figure.src} alt="" width={ch.figure.width} height={ch.figure.height} sizes="(min-width: 768px) 420px, 50vw" className="h-full w-auto object-contain [filter:drop-shadow(0_30px_40px_rgba(0,0,0,0.2))]" />
        </motion.div>
      )}
    </>
  );
}

/** A few facts, and one way to learn more. */
function InfoRow({ ch, alignRight }: { ch: ChapterData; alignRight: boolean }) {
  return (
    <div className={`mt-4 flex flex-col gap-3 md:mt-6 ${alignRight ? "md:items-end" : ""}`}>
      <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#111]/75 ${alignRight ? "md:justify-end" : ""}`}>
        {ch.facts.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span aria-hidden className="h-px w-3 bg-[#111]/40" />
            {f}
          </li>
        ))}
      </ul>
      <Link href={ch.href} className="group inline-flex min-h-11 w-fit items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#111]">
        <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:100%_1px] bg-bottom bg-no-repeat pb-1 transition-[background-size] duration-500 group-hover:bg-[length:0%_1px]">{ch.cta}</span>
        <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
      </Link>
    </div>
  );
}
