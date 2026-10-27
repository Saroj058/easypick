"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useReducedMotion, type MotionValue, type Variants } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpRight, Check, Maximize2, Play, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;
/** The films play a little faster than life (owner, 27 Oct 2026: "run the full videos ... make it fast"). */
const RATE = 1.25;
/** A card with nothing playing stays this long (ms). */
const READ = 7000;
/** When a film ends, its card holds a moment before the next one (ms). */
const HOLD = 1200;

/** A recording of the real site in use (public/story/video, made with scripts/record-story.mjs). */
export interface Film {
  src: string;
  poster: string;
  /** The address shown in the window's bar. */
  url: string;
  /** Its length at life speed (s). */
  length: number;
  /** Each step's caption, as burnt into the film, and when it shows (s). */
  steps: [string, number][];
  /** Its name on the card's switch, when the card has more than one. */
  label?: string;
}

export interface ChapterData {
  /** Its word in the row of topics. */
  topic: string;
  label: string;
  /** Lines of the big title; the word in *stars* is set in italic. */
  title: string[];
  line: string;
  href: string;
  cta: string;
  /** "left": the film (or table) left, words right; "right": the other way. */
  layout: "left" | "right";
  /** A small photo by the words (tall computer screens). */
  photo?: string;
  /** The films: the first plays as the card lands, the others are a tap away. */
  films?: Film[];
  /** The Why card: how shopping usually goes, and how it goes here. */
  compare?: [string, string][];
  /** The Pick card: questions to try, each opening Pick on the shop with it asked. */
  ask?: string[];
  /** How long it stays when nothing plays (ms). */
  beat?: number;
}

const wrap = (n: number, i: number) => ((i % n) + n) % n;
const noop = () => () => {};
const subVis = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
const useTabHidden = () => useSyncExternalStore(subVis, () => document.hidden, () => false);
const WIDE = "(min-width: 768px)";
const subWide = (cb: () => void) => {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useWide = () => useSyncExternalStore(subWide, () => window.matchMedia(WIDE).matches, () => true);
/** Data Saver on: the films wait for a tap. */
const useSaveData = () => useSyncExternalStore(noop, () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true, () => false);

/** A film open full screen: which, under what title, and from where (it carries on from the card). */
type Watching = { film: Film; title: string; from: number };

/** "0:47", for a length in seconds. */
const clock = (s: number) => {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
};
/** The step a film is on at a moment (its caption fades in a little before it settles). */
const stepAt = (film: Film, t: number) => film.steps.reduce((i, [, s], k) => (t >= s - 0.25 ? k : i), -1);

/**
 * As in the reference: nothing fades. The old card slides out and the new one in on one ease-in-out
 * curve, each layer travelling a screen-width times its depth, so the film and the words slide past
 * each other. Tapping a topic turns quicker.
 */
type Turn = { d: number; fast: boolean };
const SLIDE = [0.7, 0, 0.2, 1] as const;
const QUICK = [0.76, 0, 0.24, 1] as const;
const glide = (t: Turn) => (t.fast ? { duration: 0.8, ease: QUICK } : { duration: 1.2, ease: SLIDE, delay: 0.08 });
const layer = (depth: number, still: boolean): Variants => ({
  enter: (t: Turn) => (still ? { opacity: 0 } : { x: `${t.d * 100 * depth}vw` }),
  center: (t: Turn) => ({ x: 0, opacity: 1, transition: still ? { duration: 0.4 } : glide(t) }),
  exit: (t: Turn) => (still ? { opacity: 0, transition: { duration: 0.3 } } : { x: `${-t.d * 100 * depth}vw`, transition: glide(t) }),
});
/** Inside the words, one piece after another settles as the slide lands: label, title lines, line, steps, link. */
const item = (k: number, still: boolean, mask = false): Variants =>
  still ? {} : { enter: mask ? { y: "105%" } : { y: 12, opacity: 0 }, center: { y: 0, opacity: 1, transition: { delay: 0.5 + k * 0.07, duration: 0.9, ease: EASE } } };

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
 * The home's cards, after the EASYPICK opening (owner, 27 Oct 2026, planned with twenty agents: "make it
 * practical, effective and creative"; "run the full videos ... fast and easy to understand"). First why
 * Easypick, then how each part of the store works, each played start to finish in a film of the real
 * site with its steps listed beside it (tap one to jump there). A row of topics on top shows where you
 * are, its underline filling as the card plays; tap one to go there. A card moves on when its film
 * ends. On phones (and with Data Saver or less motion) the films wait for a tap and open full screen.
 * It holds for the Pause word, keyboard focus, a hidden tab, a film open full screen, and while the
 * hero is scrolled away.
 */
export function LandingChapters({ chapters }: { chapters: ChapterData[] }) {
  const still = !!useReducedMotion();
  const wide = useWide();
  const saveData = useSaveData();
  const [[page, d, fast], setPage] = useState<[number, number, boolean]>([0, 1, false]);
  const [focus, setFocus] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [inView, setInView] = useState(true);
  const [watching, setWatching] = useState<Watching | null>(null);
  // The browser wouldn't play a film by itself (a phone saving battery): from then on they wait for a tap.
  const [blocked, setBlocked] = useState(false);
  const tabHidden = useTabHidden();
  const root = useRef<HTMLDivElement>(null);
  const panned = useRef(false);
  const progress = useMotionValue(0);
  const n = chapters.length;
  const at = wrap(n, page);
  const ch = chapters[at];
  // The films run by themselves, phones too (owner, 27 Oct 2026: "make it auto run motions as well"), and a tap
  // opens one full screen. With Data Saver or less motion they wait for the tap. On a phone, Pick's card
  // keeps its questions in the film's place.
  const plays = (c: ChapterData) => !still && !saveData && !blocked && !!c.films?.length && !(c.ask && !wide);
  const playing = plays(ch);
  const paused = stopped || focus || tabHidden || !inView || !!watching || n < 2;
  const turn: Turn = { d, fast };

  const advance = useCallback(() => setPage(([p]) => (wrap(n, p) === n - 1 ? [p - (n - 1), -1, false] : [p + 1, 1, false])), [n]);
  const go = (step: number) => setPage(([p]) => [p + step, step, false]);
  const jump = (i: number) =>
    setPage(([p]) => {
      const from = wrap(n, p);
      return i === from ? [p, 1, false] : [p + i - from, i > from ? 1 : -1, true];
    });

  // Each card starts its underline from nothing.
  useLayoutEffect(() => progress.set(0), [page, progress]);
  // A card with nothing playing: the underline fills over its beat, then the next card.
  useEffect(() => {
    if (playing || paused) return;
    const c = animate(progress, 1, { duration: ((1 - progress.get()) * (ch.beat ?? READ)) / 1000, ease: "linear", onComplete: advance });
    return () => c.stop();
  }, [page, playing, paused, progress, ch.beat, advance]);
  // Scrolled away (down to the rail), it holds; back up, it goes on where it was.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Past the hero, to the rail.
  const shop = () => {
    const el = root.current?.closest("section");
    if (el) window.scrollTo({ top: el.getBoundingClientRect().bottom + window.scrollY - (wide ? 88 : 72), behavior: still ? "auto" : "smooth" });
  };

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label="How Easypick works"
      onFocus={(e) => e.target.matches(":focus-visible") && setFocus(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocus(false)}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
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
          if (Math.abs(i.offset.x) > 60 || Math.abs(i.velocity.x) > 400) go(i.offset.x < 0 ? 1 : -1);
          setTimeout(() => (panned.current = false), 0);
        }}
        onClickCapture={(e) => panned.current && e.preventDefault()}
      >
        <AnimatePresence initial={false} custom={turn}>
          <motion.div key={page} custom={turn} initial="enter" animate="center" exit="exit" className="absolute inset-0" role="group" aria-roledescription="slide" aria-label={`${at + 1} of ${n}: ${ch.label}`}>
            <Slide
              ch={ch}
              still={still}
              turn={turn}
              first={page === 0}
              wide={wide}
              plays={playing}
              paused={paused}
              progress={progress}
              onEnd={advance}
              onBlocked={() => setBlocked(true)}
              onWatch={(film, from = 0) => setWatching({ film, title: ch.label, from })}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <Topics chapters={chapters} at={at} progress={progress} onPick={jump} />

      {/* Pause (anything that moves by itself needs a way to stop it), and the way on to the rail */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-3 pb-1 md:px-[4vw] md:pb-3">
        <button type="button" onClick={() => setStopped((v) => !v)} aria-pressed={stopped} className="pointer-events-auto inline-flex min-h-11 cursor-pointer items-center px-1 font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#555] hover:text-[#111]">
          {stopped ? "Play" : "Pause"}
        </button>
        <button type="button" onClick={shop} className="group pointer-events-auto inline-flex min-h-11 cursor-pointer items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#111]">
          Shop now
          <ArrowDown aria-hidden className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-0.5" />
        </button>
      </div>

      <FilmDialog watching={watching} onClose={() => setWatching(null)} />
      <p className="sr-only" aria-live="polite">{paused ? `${ch.label}, ${at + 1} of ${n}` : ""}</p>
    </div>
  );
}

/** The topics, one word each, at the foot of the hero (owner, 27 Oct 2026: "keep it below not top"); the current one's underline fills as its card plays. Tap one to go there. */
function Topics({ chapters, at, progress, onPick }: { chapters: ChapterData[]; at: number; progress: MotionValue<number>; onPick: (i: number) => void }) {
  const row = useRef<HTMLDivElement>(null);
  // On a phone the row scrolls sideways: keep the current word in view.
  useEffect(() => {
    const r = row.current;
    const b = r?.children[at] as HTMLElement | undefined;
    if (!r || !b || r.scrollWidth <= r.clientWidth) return;
    r.scrollTo({ left: b.offsetLeft - (r.clientWidth - b.offsetWidth) / 2, behavior: "smooth" });
  }, [at]);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[44px] z-30 flex justify-center lg:bottom-3">
      <div ref={row} role="group" aria-label="Topics" className="no-scrollbar pointer-events-auto relative flex max-w-full overflow-x-auto px-2 max-md:[mask-image:linear-gradient(to_right,transparent,#000_12px,#000_calc(100%-28px),transparent)] md:gap-2">
        {chapters.map((c, i) => (
          <button
            key={c.topic}
            type="button"
            onClick={() => onPick(i)}
            aria-current={i === at ? "step" : undefined}
            className={`relative min-h-11 shrink-0 cursor-pointer px-2.5 font-mono text-[10.5px] uppercase tracking-[0.22em] transition-colors duration-300 md:px-3 ${i === at ? "text-[#111]" : "text-[#111]/40 hover:text-[#111]/75"}`}
          >
            {c.topic}
            <span aria-hidden className="absolute inset-x-2.5 bottom-1.5 h-px bg-[#111]/10 md:inset-x-3" />
            {i === at && <motion.span aria-hidden style={{ scaleX: progress }} className="absolute inset-x-2.5 bottom-1.5 h-px origin-left bg-[#111] md:inset-x-3" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slide({
  ch,
  still,
  turn,
  first,
  wide,
  plays,
  paused,
  progress,
  onEnd,
  onBlocked,
  onWatch,
}: {
  ch: ChapterData;
  still: boolean;
  turn: Turn;
  first: boolean;
  wide: boolean;
  /** Its film runs by itself. */
  plays: boolean;
  paused: boolean;
  progress: MotionValue<number>;
  onEnd: () => void;
  onBlocked: () => void;
  onWatch: (film: Film, from?: number) => void;
}) {
  const right = ch.layout === "right";
  const [which, setWhich] = useState(0);
  const [step, setStep] = useState(-1);
  const video = useRef<HTMLVideoElement>(null);
  const film = ch.films?.[which];
  // Pick's questions sit by the words while his film plays; otherwise in the film's place.
  const askBy = !!ch.ask && plays;
  const seek = (t: number) => {
    const v = video.current;
    if (v) v.currentTime = Math.max(0, t - 0.2);
  };
  // Full screen carries on from where the card's film is.
  const expand = () => film && onWatch(film, plays ? (video.current?.currentTime ?? 0) : 0);

  // Phones: the words on top, the film (or table, or Pick's questions) at the foot, clear of the topics
  // and the Pause row. Computers: side by side, each centred in its half, above the topics.
  const big = right
    ? "inset-x-0 bottom-[100px] md:inset-x-auto md:right-[3vw] md:top-[112px] md:bottom-[104px] md:w-[52vw] lg:bottom-[76px]"
    : "inset-x-0 bottom-[100px] md:inset-x-auto md:left-[3vw] md:top-[112px] md:bottom-[104px] md:w-[52vw] lg:bottom-[76px]";
  const words = right
    ? "left-4 right-4 top-[84px] md:left-[6vw] md:right-auto md:top-[104px] md:bottom-[96px] md:w-[34vw] lg:bottom-[68px]"
    : "left-4 right-4 top-[84px] md:left-auto md:right-[5vw] md:top-[104px] md:bottom-[96px] md:w-[34vw] lg:bottom-[68px]";
  // On a phone a film card shows only its label and title over the film; the film and its step say the rest.
  const filmCard = !!film && !ch.ask;

  return (
    <>
      {/* The film, Pick's questions, or the Why table (far, slow) */}
      <motion.div custom={turn} variants={layer(0.85, still)} className={`absolute z-[1] flex flex-col justify-end will-change-transform md:justify-center ${big}`}>
        {ch.compare ? (
          <Compare rows={ch.compare} still={still} />
        ) : ch.ask && !askBy ? (
          <div className="px-4 md:flex md:justify-center md:px-0">
            <Ask questions={ch.ask} still={still} onWatch={film ? expand : undefined} watchFor={film?.length} />
          </div>
        ) : film ? (
          <div className="flex flex-col items-center gap-2 px-3 md:px-0">
            <motion.div variants={item(1, still)} className="w-full">
              <Window
                url={film.url}
                onExpand={expand}
                switcher={
                  ch.films!.length > 1 && (
                    <div role="group" aria-label="Which film" className="flex rounded-full bg-white p-0.5 ring-1 ring-black/[0.06]">
                      {ch.films!.map((f, i) => (
                        <button
                          key={f.src}
                          type="button"
                          onClick={() => {
                            setWhich(i);
                            setStep(-1);
                          }}
                          aria-pressed={i === which}
                          className={`min-h-7 cursor-pointer rounded-full px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] transition-colors duration-300 ${i === which ? "bg-[#111] text-white" : "text-[#111]/50 hover:text-[#111]"}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )
                }
              >
                {plays ? (
                  <Playing key={film.src} film={film} video={video} paused={paused} progress={progress} onStep={setStep} onEnd={onEnd} onBlocked={onBlocked} onExpand={expand} />
                ) : (
                  <Poster film={film} first={first} onWatch={expand} />
                )}
              </Window>
            </motion.div>
            {/* On a phone the film's own captions are small: the step it's on, readable, under it */}
            {plays && !wide && (
              <p aria-hidden className="flex min-h-6 w-full items-baseline gap-2.5 px-1 text-[13px] font-semibold leading-tight">
                {step >= 0 && (
                  <>
                    <span className="font-mono text-[10.5px] font-normal tabular-nums tracking-[0.1em] text-[#111]/45">
                      {String(step + 1).padStart(2, "0")}/{String(film.steps.length).padStart(2, "0")}
                    </span>
                    <span className="truncate">{film.steps[step][0]}</span>
                  </>
                )}
              </p>
            )}
          </div>
        ) : null}
      </motion.div>

      {/* The words (near) */}
      <motion.div custom={turn} variants={layer(1, still)} className={`absolute z-[2] will-change-transform md:flex md:flex-col md:justify-center ${words}`}>
        {ch.photo && (
          <motion.div variants={item(0, still)} className="relative mb-6 hidden aspect-[3/4] h-[15vh] self-start overflow-hidden bg-[#ececea] [@media(min-width:768px)_and_(min-height:860px)]:block">
            <Image src={ch.photo} alt="" fill priority={first} sizes="12vw" className="object-cover grayscale" />
          </motion.div>
        )}
        <motion.p variants={item(0, still)} className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#555]">
          {ch.label}
        </motion.p>
        {/* The title drifts a little while it rests, so it never stands still; the reading text stays put */}
        <h2
          className={`mt-3 font-[family-name:var(--font-didone)] font-normal uppercase leading-[0.86] tracking-[-0.03em] ${ch.compare ? "text-[clamp(2.4rem,12vw,4.4rem)] md:text-[min(6vw,11vh)]" : "text-[clamp(2rem,9.6vw,3.6rem)] md:text-[min(4.4vw,7.6vh)]"}`}
          style={still ? undefined : { animation: "chapter-drift 14s linear forwards" }}
        >
          {ch.title.map((t, k) => (
            <Line key={t} text={t} k={k + 1} still={still} />
          ))}
        </h2>
        <div className="max-w-[44ch]">
          <motion.p variants={item(3, still)} className={`mt-4 text-[13.5px] leading-relaxed text-[#111]/75 md:mt-6 md:text-[14.5px] ${ch.compare || filmCard ? "max-md:hidden" : "max-md:[@media(max-height:740px)]:hidden"}`}>
            {ch.line}
          </motion.p>
          {film && wide && !ch.ask && (
            <motion.div variants={item(4, still)}>
              <Steps film={film} step={plays ? step : -1} onSeek={plays ? seek : undefined} />
            </motion.div>
          )}
          {askBy && (
            <motion.div variants={item(4, still)}>
              <Ask questions={ch.ask!} still={still} />
            </motion.div>
          )}
          {/* Short phones keep the room for the film */}
          <motion.div variants={item(5, still)} className="max-md:[@media(max-height:740px)]:hidden">
            <Link href={ch.href} className="group mt-2 inline-flex min-h-11 w-fit items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#111] md:mt-4">
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:100%_1px] bg-bottom bg-no-repeat pb-1 transition-[background-size] duration-500 group-hover:bg-[length:0%_1px]">{ch.cta}</span>
              <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

/** The film's steps, numbered, down one column and then the next; the one playing stands out, and a tap goes to it. */
function Steps({ film, step, onSeek, dark = false }: { film: Film; step: number; onSeek?: (t: number) => void; dark?: boolean }) {
  const tone = (i: number) =>
    dark ? (i === step ? "text-white" : i < step ? "text-white/60" : "text-white/40") : i === step ? "text-[#111]" : i < step ? "text-[#111]/55" : step < 0 ? "text-[#111]/75" : "text-[#111]/40";
  const two = film.steps.length > 5;
  const row = "flex w-full items-baseline gap-2.5 py-[3px] text-left text-[13px] leading-snug transition-colors duration-300";
  return (
    <ol aria-label="Steps" className={`mt-5 grid gap-x-6 ${two ? "grid-flow-col grid-cols-2" : "grid-cols-1"}`} style={two ? { gridTemplateRows: `repeat(${Math.ceil(film.steps.length / 2)}, auto)` } : undefined}>
      {film.steps.map(([label, t], i) => {
        const inner = (
          <>
            <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums tracking-[0.06em] opacity-70">{String(i + 1).padStart(2, "0")}</span>
            <span className={i === step ? "font-semibold" : ""}>{label}</span>
            {i === step && <span aria-hidden className="h-1.5 w-1.5 shrink-0 -translate-y-px self-center rounded-full bg-current" />}
          </>
        );
        return (
          <li key={i}>
            {onSeek ? (
              <button type="button" onClick={() => onSeek(t)} aria-current={i === step ? "step" : undefined} className={`${row} min-h-7 cursor-pointer ${dark ? "hover:text-white" : "hover:text-[#111]"} ${tone(i)}`}>
                {inner}
              </button>
            ) : (
              <span className={`${row} ${tone(i)}`}>{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A browser window on a clean ground: the address in its bar (or the card's switch between films), the film inside. */
function Window({ url, onExpand, switcher, children }: { url: string; onExpand: () => void; switcher?: ReactNode; children: ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-[12px] bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.08)]">
      <div className="flex items-center gap-3 border-b border-black/[0.06] bg-[#f4f4f2] px-3 py-1.5">
        <span aria-hidden className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#111]/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#111]/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#111]/20" />
        </span>
        <span className="mx-auto min-w-0">{switcher || <span className="block truncate rounded-full bg-white px-3 py-0.5 font-mono text-[10px] tracking-[0.04em] text-[#111]/60 ring-1 ring-black/[0.06]">{url}</span>}</span>
        <button type="button" onClick={onExpand} aria-label="Watch full screen" className="-my-1 grid h-8 w-[42px] cursor-pointer place-items-center rounded-full text-[#111]/50 hover:text-[#111]">
          <Maximize2 aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

/** The film playing in its window: from the start as the card lands, holding with the hero, and on to the next card when it ends. A tap opens it full screen. */
function Playing({
  film,
  video,
  paused,
  progress,
  onStep,
  onEnd,
  onBlocked,
  onExpand,
}: {
  film: Film;
  video: RefObject<HTMLVideoElement | null>;
  paused: boolean;
  progress: MotionValue<number>;
  onStep: (i: number) => void;
  onEnd: () => void;
  onBlocked: () => void;
  onExpand: () => void;
}) {
  const present = useIsPresent();
  const landed = useRef(false);
  const live = useRef({ paused, onEnd, onBlocked });
  useEffect(() => {
    live.current = { paused, onEnd, onBlocked };
  });
  useEffect(() => {
    const v = video.current;
    if (!v || !present) return;
    if (paused) {
      v.pause();
      return;
    }
    // A browser that won't play it by itself says so at once: the card then waits for a tap instead.
    const play = () => void v.play().catch((e: unknown) => e instanceof DOMException && e.name === "NotAllowedError" && live.current.onBlocked());
    // Held at its end and let go: straight on to the next card.
    const t = v.ended ? window.setTimeout(() => live.current.onEnd(), HOLD) : window.setTimeout(play, landed.current ? 0 : 600);
    landed.current = true;
    return () => window.clearTimeout(t);
  }, [paused, present, video]);
  // Where it is: the topics' underline, and the step it's on.
  useEffect(() => {
    const v = video.current;
    if (!v || !present) return;
    let raf = 0;
    const tick = () => {
      progress.set(Math.min(1, v.currentTime / (v.duration || film.length)));
      onStep(stepAt(film, v.currentTime));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    let hold = 0;
    const ended = () => {
      hold = window.setTimeout(() => !live.current.paused && live.current.onEnd(), HOLD);
    };
    v.addEventListener("ended", ended);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hold);
      v.removeEventListener("ended", ended);
    };
  }, [present, film, progress, onStep, video]);
  const fast = (v: HTMLVideoElement) => {
    v.defaultPlaybackRate = RATE;
    v.playbackRate = RATE;
  };
  return (
    <button type="button" onClick={onExpand} aria-label="Watch full screen" className="block w-full cursor-zoom-in">
      <video
        ref={video}
        src={film.src}
        poster={film.poster}
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => fast(e.currentTarget)}
        onPlay={(e) => fast(e.currentTarget)}
        className="block aspect-[1120/700] w-full bg-white object-cover"
        aria-hidden
      />
    </button>
  );
}

/** The film's first frame and a Watch button (phones, Data Saver, less motion). */
function Poster({ film, first, onWatch }: { film: Film; first: boolean; onWatch: () => void }) {
  return (
    <button type="button" onClick={onWatch} className="group relative block aspect-[1120/700] w-full cursor-pointer bg-white">
      <Image src={film.poster} alt="" fill priority={first} sizes="(min-width: 768px) 52vw, 94vw" className="object-cover" />
      <span className="absolute inset-0 grid place-items-center bg-black/[0.04]">
        <span className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111] pl-3.5 pr-4 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-[1.04]">
          <Play aria-hidden className="h-3.5 w-3.5 fill-current" />
          Watch how · {clock(film.length / RATE)}
        </span>
      </span>
    </button>
  );
}

/** A film full screen, with its steps under it (tap one to go there). */
function FilmDialog({ watching, onClose }: { watching: Watching | null; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState(-1);
  const film = watching?.film;
  return (
    <Dialog.Root open={!!film} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[#0a0a0a]/95" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-[91] flex flex-col items-center justify-center overflow-y-auto px-4 py-16 outline-none md:px-10">
          <Dialog.Title className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.3em] text-white/60">{watching?.title}</Dialog.Title>
          <Dialog.Close aria-label="Close" className="absolute right-3 top-3 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <X aria-hidden className="h-5 w-5" />
          </Dialog.Close>
          {film && (
            <div className="w-full max-w-[1200px]">
              <video
                ref={video}
                key={film.src}
                src={film.src}
                poster={film.poster}
                autoPlay
                muted
                playsInline
                controls
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  v.defaultPlaybackRate = RATE;
                  v.playbackRate = RATE;
                  if (watching?.from) v.currentTime = Math.max(0, watching.from - 0.5);
                }}
                onTimeUpdate={(e) => setStep(stepAt(film, e.currentTarget.currentTime))}
                className="mx-auto block max-h-[70svh] w-full bg-black"
              />
              <div className="mx-auto max-w-[720px]">
                <Steps
                  film={film}
                  step={step}
                  dark
                  onSeek={(t) => {
                    const v = video.current;
                    if (!v) return;
                    v.currentTime = Math.max(0, t - 0.2);
                    void v.play().catch(() => {});
                  }}
                />
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Ask Pick: questions to try, or their own; each opens Pick on the shop with it asked. */
function Ask({ questions, still, onWatch, watchFor }: { questions: string[]; still: boolean; onWatch?: () => void; watchFor?: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const to = (q: string) => `/shop?ask=${encodeURIComponent(q)}#pick`;
  return (
    <div className="mt-5 w-full max-w-[440px]">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#111]/50">Try asking</p>
      <ul className="mt-2 flex flex-col items-start gap-1.5">
        {questions.map((q, i) => (
          <motion.li key={q} initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.12, duration: 0.6, ease: EASE }}>
            <Link href={to(q)} className="group inline-flex min-h-10 items-center gap-2 rounded-full bg-[#f2f1ee] px-4 text-[13px] font-medium transition-colors duration-300 hover:bg-[#111] hover:text-white">
              “{q}”
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5 opacity-50 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </motion.li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = text.trim();
          if (q) router.push(to(q));
        }}
        className="mt-3 flex h-12 w-full items-center rounded-full bg-white pl-5 pr-1 ring-1 ring-black/15 transition-shadow focus-within:ring-[#111]"
      >
        <label htmlFor="hero-ask" className="sr-only">
          Ask Pick
        </label>
        <input id="hero-ask" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} autoComplete="off" placeholder="Or ask your own" className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#111]/40 md:text-[14px]" />
        <button type="submit" aria-label="Ask Pick" disabled={!text.trim()} className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-[#111] text-white transition-opacity disabled:cursor-default disabled:opacity-25">
          <ArrowUp aria-hidden className="h-4 w-4" />
        </button>
      </form>
      {onWatch && (
        <button type="button" onClick={onWatch} className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#111]/70 hover:text-[#111]">
          <Play aria-hidden className="h-3 w-3 fill-current" />
          Watch how · {clock((watchFor ?? 0) / RATE)}
        </button>
      )}
    </div>
  );
}

/** Why Easypick: how shopping for clothes usually goes, struck through one by one, and how it goes here. */
function Compare({ rows, still }: { rows: [string, string][]; still: boolean }) {
  return (
    <div className="w-full px-4 md:px-[2vw]">
      <div className="mx-auto w-full max-w-[640px]">
        <div aria-hidden className="grid grid-cols-2 gap-4 border-b border-[#111] pb-2.5 font-mono text-[10px] uppercase tracking-[0.24em] md:pb-3 md:text-[10.5px]">
          <span className="text-[#111]/45">Usually</span>
          <span>At Easypick</span>
        </div>
        <ul>
          {rows.map(([was, is], i) => (
            <li key={is} className="grid grid-cols-2 items-baseline gap-4 border-b border-black/10 py-2 [@media(min-height:740px)]:py-3 md:py-[min(2.4vh,22px)]">
              <span className="text-[12px] leading-snug text-[#111]/45 [@media(min-height:740px)]:text-[12.5px] md:text-[15px]">
                <span className="sr-only">Usually: </span>
                <motion.span
                  className="bg-[linear-gradient(currentColor,currentColor)] bg-[position:0_58%] bg-no-repeat [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
                  initial={still ? false : { backgroundSize: "0% 1px" }}
                  animate={{ backgroundSize: "100% 1px" }}
                  transition={{ delay: 1 + i * 0.32, duration: 0.5, ease: EASE }}
                >
                  {was}
                </motion.span>
              </span>
              <motion.span
                className="flex items-baseline gap-2 text-[12.5px] font-semibold leading-snug [@media(min-height:740px)]:text-[13px] md:text-[16px]"
                initial={still ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 + i * 0.32, duration: 0.6, ease: EASE }}
              >
                <Check aria-hidden className="h-3.5 w-3.5 shrink-0 translate-y-0.5" strokeWidth={2.5} />
                <span>
                  <span className="sr-only">At Easypick: </span>
                  {is}
                </span>
              </motion.span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
