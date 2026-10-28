"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { Maximize2, Play, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** The films play a little faster than life. */
const RATE = 1.25;

type Guide = { title: string; film: string; /** Its length at life speed (s). */ length: number; /** Each step's caption, as burnt into the film, and when it shows (s). */ steps: [string, number][] };

// The films of the real site in use, each a whole process (public/story/video, made on a test copy with
// scripts/record-story.mjs, which prints each film's step times).
export const GUIDES = {
  buy: { title: "How buying works", film: "shop", length: 40.8, steps: [["Find the rail", 1.6], ["Swipe to browse", 3.2], ["Pick your size", 7.6], ["Tap Buy now", 10.4], ["Enter your number", 13.6], ["Pickup is free", 17.6], ["Tap Pay", 18.8], ["Log in to eSewa", 22.4], ["Enter the code", 27.6], ["Confirm the payment", 32.4], ["Paid. Your order is in", 38]] },
  pick: { title: "How Pick works", film: "ask-pick", length: 31.1, steps: [["Tap Ask Pick", 2.3], ["Tap Pick to chat", 7.6], ["Ask in your own words", 11.1], ["Tap Send", 18], ["Real pieces, in your size", 22.4], ["Add one to your bag", 24.7]] },
  gift: { title: "How sending a gift works", film: "gift", length: 59.2, steps: [["Send a piece", 1.6], ["Send it as a gift", 5.2], ["Let them pick the size", 9.2], ["Write their name", 15.2], ["Pick the occasion", 21.6], ["Add their email", 28.4], ["Your mobile number", 32.8], ["Tap Pay", 36.8], ["Log in to eSewa", 40.4], ["Enter the code", 46], ["Confirm the payment", 50.8], ["Sent. They pick their size", 56.4]] },
  giftcards: { title: "How gift cards work", film: "giftcards", length: 38.6, steps: [["Pick an amount", 2], ["Write their name", 5.2], ["Add their email", 8], ["Add your name", 12], ["Your mobile number", 14], ["Tap Buy gift card", 17.6], ["Log in to eSewa", 20], ["Enter the code", 25.2], ["Confirm the payment", 30.4], ["Sent, with its code", 36]] },
  fits: { title: "How Designer Fits work", film: "outfits", length: 47.7, steps: [["Choose an occasion", 1.6], ["Browse the fits", 6.4], ["Pick each size", 10.4], ["Tap Quick buy", 15.6], ["Enter your number", 20], ["Tap Pay", 24.8], ["Log in to eSewa", 28.4], ["Enter the code", 34.4], ["Confirm the payment", 39.2], ["Paid. Your order is in", 44.8]] },
  size: { title: "How finding your size works", film: "size", length: 25.4, steps: [["Tap Find my size", 1.6], ["Use height and weight", 4.8], ["Set your height", 7.6], ["Tap Next", 11.2], ["See your size", 14], ["Save your size", 17.2], ["Your size, already picked", 20.4]] },
  vault: { title: "How the Vault works", film: "vault", length: 23.4, steps: [["Choose a brand", 2], ["See every piece", 3.6], ["Open a piece", 4.8], ["Pick your size", 13.6], ["Tap Buy now", 16.8]] },
  drops: { title: "How drops work", film: "drops", length: 15.8, steps: [["Leave your email", 1.6], ["Tap Notify me", 5.6], ["Shop the drop", 9.6]] },
} satisfies Record<string, Guide>;
export type GuideId = keyof typeof GUIDES;

const src = (g: Guide) => `/story/video/${g.film}.webm`;
const poster = (g: Guide) => `/story/video/${g.film}.webp`;
const clock = (s: number) => {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
};
const stepAt = (g: Guide, t: number) => g.steps.reduce((i, [, s], k) => (t >= s - 0.25 ? k : i), -1);
const fast = (v: HTMLVideoElement) => {
  v.defaultPlaybackRate = RATE;
  v.playbackRate = RATE;
};

// Who gets the pop-ups (owner, 28 Oct 2026: "for new users; when they've been on the site 3 or 4 times they
// won't get that pop-up"): a visit is counted once per tab session; pop-ups only during the first three, and
// each section's only once.
const VISITS = "ep-visits";
const COUNTED = "ep-visit-counted";
const SEEN = "ep-guides-seen";
function newVisitor() {
  try {
    if (!sessionStorage.getItem(COUNTED)) {
      sessionStorage.setItem(COUNTED, "1");
      localStorage.setItem(VISITS, String(Number(localStorage.getItem(VISITS) ?? 0) + 1));
    }
    return Number(localStorage.getItem(VISITS) ?? 1) <= 3;
  } catch {
    return false;
  }
}
const seenList = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? "[]") as string[];
  } catch {
    return [];
  }
};
const markSeen = (id: string) => {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...new Set([...seenList(), id])]));
  } catch {
    /* private mode: it may show again next visit */
  }
};
/** Someone said they've been here before: no more pop-ups for them. */
const settle = () => {
  try {
    localStorage.setItem(VISITS, "99");
  } catch {
    /* private mode */
  }
};
/** One pop-up at a time, across every section on the page. */
let showing: string | null = null;
/** The sections that ask by themselves (owner, 28 Oct 2026: "when they come on the rail, gift and shop"). */
const ASKS: GuideId[] = ["buy", "gift"];

/**
 * How a part of the store works, where that part is (owner, 28 Oct 2026: "put how it works on each section").
 * A small "How it works" button plays the film full screen for anyone. On the rail, the shop and gift, a new
 * visitor gets a small window in the corner (from the bottom on a phone) the first time the section comes into
 * view. It asks first: "First time here?", then "Want to see how it's done?", and only then plays the film,
 * all in that one window. Never in checkout, never while typing, one at a time.
 */
export function HowItWorks({ guide, tone = "light", className = "" }: { guide: GuideId; tone?: "light" | "dark"; className?: string }) {
  const g = GUIDES[guide];
  const btn = useRef<HTMLButtonElement>(null);
  const [pop, setPop] = useState(false);
  const [full, setFull] = useState<number | null>(null);
  const path = usePathname();

  useEffect(() => {
    const el = btn.current;
    if (!el || /^\/(checkout|bag|order|admin)/.test(path)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Automated browsers (tests, crawlers) don't get pop-ups; "ep-guides-try" in localStorage lets one see them.
    if (navigator.webdriver && !localStorage.getItem("ep-guides-try")) return;
    if (!ASKS.includes(guide) || !newVisitor() || seenList().includes(guide)) return;
    let t = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        window.clearTimeout(t);
        if (!e.isIntersecting) return;
        // A moment after the section settles in view, unless something else is showing or they're typing.
        t = window.setTimeout(() => {
          const typing = document.activeElement?.matches("input, textarea, select, [contenteditable=true]");
          if (showing || typing || seenList().includes(guide) || document.querySelector("[role=dialog][data-state=open]")) return;
          showing = guide;
          markSeen(guide);
          io.disconnect();
          setPop(true);
        }, 900);
      },
      { rootMargin: "0px 0px -30% 0px" },
    );
    io.observe(el);
    return () => {
      window.clearTimeout(t);
      io.disconnect();
    };
  }, [guide, path]);

  const close = () => {
    setPop(false);
    if (showing === guide) showing = null;
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => {
          close();
          setFull(0);
        }}
        className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${tone === "dark" ? "border-white/30 text-white hover:border-white" : "border-ink/15 text-ink hover:border-ink"} ${className}`}
      >
        <Play aria-hidden className="h-3 w-3 fill-current" />
        How it works <span className="font-normal opacity-60">· {clock(g.length / RATE)}</span>
      </button>
      {pop && (
        <Popup
          g={g}
          onClose={close}
          onFull={(t) => {
            close();
            setFull(t);
          }}
        />
      )}
      <Full g={g} from={full} onClose={() => setFull(null)} />
    </>
  );
}

/** The small window that pops up by itself: two quick questions, then the film, the step it's on, full screen. */
function Popup({ g, onClose, onFull }: { g: Guide; onClose: () => void; onFull: (t: number) => void }) {
  const still = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState<"first" | "show" | "film">("first");
  const [step, setStep] = useState(-1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const ask = (q: string, line: string, yes: string, no: string, onYes: () => void, onNo: () => void) => (
    <motion.div key={q} initial={still ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="px-4 pb-4 pt-1">
      <p className="text-[19px] font-semibold leading-tight tracking-[-0.01em]">{q}</p>
      <p className="mt-1 text-[13px] text-steel-dark">{line}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onYes} className="h-10 flex-1 cursor-pointer rounded-full bg-ink px-4 text-[13px] font-semibold text-paper hover:bg-ink/85">
          {yes}
        </button>
        <button type="button" onClick={onNo} className="h-10 flex-1 cursor-pointer rounded-full border border-ink/15 px-4 text-[13px] font-semibold hover:border-ink">
          {no}
        </button>
      </div>
    </motion.div>
  );
  return (
    <motion.aside
      aria-label={g.title}
      initial={still ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[80] overflow-hidden rounded-2xl bg-paper shadow-[0_30px_70px_-20px_rgba(0,0,0,0.5),0_0_0_1px_rgba(17,17,17,0.08)] lg:inset-x-auto lg:bottom-5 lg:right-5 lg:w-[380px]"
    >
      <div className="flex items-center gap-2 py-2 pl-4 pr-1.5">
        <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
          <span className="mr-2 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-steel-dark">{stage === "film" ? "How it works" : "Hi"}</span>
          {stage === "film" && g.title}
        </p>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-steel-dark hover:bg-mist hover:text-ink">
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
      {stage === "first" &&
        ask(
          "Is this your first time here?",
          "Easypick works a little differently from other shops.",
          "Yes, it is",
          "No, I've been here",
          () => setStage("show"),
          () => {
            settle();
            onClose();
          },
        )}
      {stage === "show" &&
        ask(
          `Want to see ${g.title.replace(/^How /, "how ").replace(/ works?$/, "")} works?`,
          `A short film of the real site, ${clock(g.length / RATE)} long, no sound.`,
          "Yes, show me",
          "Not now",
          () => setStage("film"),
          onClose,
        )}
      {stage === "film" && (
        <motion.div initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
          <button type="button" onClick={() => onFull(video.current?.currentTime ?? 0)} aria-label="Watch full screen" className="relative block w-full cursor-zoom-in bg-mist">
            <video
              ref={video}
              src={src(g)}
              poster={poster(g)}
              muted
              playsInline
              autoPlay
              onLoadedMetadata={(e) => fast(e.currentTarget)}
              onPlay={(e) => fast(e.currentTarget)}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                setStep(stepAt(g, v.currentTime));
                if (bar.current) bar.current.style.transform = `scaleX(${v.currentTime / (v.duration || g.length)})`;
              }}
              onEnded={() => window.setTimeout(onClose, 1500)}
              className="block aspect-[1120/700] w-full object-cover"
              aria-hidden
            />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-black/10">
              <span ref={bar} className="block h-full origin-left scale-x-0 bg-ink" />
            </span>
          </button>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <p className="min-w-0 flex-1 truncate text-[13px]" aria-live="polite">
              {step >= 0 && (
                <>
                  <span className="mr-2 font-mono text-[10.5px] text-steel-dark">
                    {String(step + 1).padStart(2, "0")}/{String(g.steps.length).padStart(2, "0")}
                  </span>
                  <span className="font-semibold">{g.steps[step][0]}</span>
                </>
              )}
            </p>
            <button type="button" onClick={() => onFull(video.current?.currentTime ?? 0)} className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 px-3 text-[12px] font-semibold hover:border-ink">
              <Maximize2 aria-hidden className="h-3 w-3" /> Full screen
            </button>
          </div>
        </motion.div>
      )}
    </motion.aside>
  );
}

/** The film full screen, with every step under it (tap one to go there). */
function Full({ g, from, onClose }: { g: Guide; from: number | null; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState(-1);
  return (
    <Dialog.Root open={from !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[#0a0a0a]/95" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-[91] flex flex-col items-center justify-center overflow-y-auto px-4 py-16 outline-none md:px-10">
          <Dialog.Title className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.3em] text-white/60">{g.title}</Dialog.Title>
          <Dialog.Close aria-label="Close" className="absolute right-3 top-3 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <X aria-hidden className="h-5 w-5" />
          </Dialog.Close>
          <div className="w-full max-w-[1200px]">
            <video
              ref={video}
              src={src(g)}
              poster={poster(g)}
              autoPlay
              muted
              playsInline
              controls
              onLoadedMetadata={(e) => {
                fast(e.currentTarget);
                if (from) e.currentTarget.currentTime = Math.max(0, from - 0.5);
              }}
              onTimeUpdate={(e) => setStep(stepAt(g, e.currentTarget.currentTime))}
              className="mx-auto block max-h-[70svh] w-full bg-black"
            />
            <ol aria-label="Steps" className="mx-auto mt-5 grid max-w-[720px] grid-cols-2 gap-x-6">
              {g.steps.map(([label, t], i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      const v = video.current;
                      if (!v) return;
                      v.currentTime = Math.max(0, t - 0.2);
                      void v.play().catch(() => {});
                    }}
                    aria-current={i === step ? "step" : undefined}
                    className={`flex min-h-8 w-full cursor-pointer items-baseline gap-2.5 py-1 text-left text-[13px] transition-colors hover:text-white ${i === step ? "font-semibold text-white" : i < step ? "text-white/60" : "text-white/40"}`}
                  >
                    <span className="w-5 shrink-0 font-mono text-[10px] opacity-70">{String(i + 1).padStart(2, "0")}</span>
                    {label}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
