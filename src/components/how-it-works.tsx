"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** The films play a little faster than life. */
const RATE = 1.25;

type Guide = {
  title: string;
  /** Its name in the list: "Buying". */
  short: string;
  film: string;
  /** Its length at life speed (s). */
  length: number;
  /** Each step's caption, as burnt into the film, and when it shows (s). */
  steps: [string, number][];
  /** Where it's done on the site. */
  go: { href: string; label: string };
};

// The films of the real site in use, each a whole process (public/story/video, made on a test copy with
// scripts/record-story.mjs, which prints each film's step times). They all live on /how-it-works now (owner, 29 Oct
// 2026: "remove How it works from the system and make a page for it").
export const GUIDES = {
  buy: { title: "How buying works", short: "Buying", film: "shop", length: 40.8, go: { href: "/shop", label: "Go to the shop" }, steps: [["Find the rail", 1.6], ["Swipe to browse", 3.2], ["Pick your size", 7.6], ["Tap Buy now", 10.4], ["Enter your number", 13.6], ["Pickup is free", 17.6], ["Tap Pay", 18.8], ["Log in to eSewa", 22.4], ["Enter the code", 27.6], ["Confirm the payment", 32.4], ["Paid. Your order is in", 38]] },
  pick: { title: "How Pick works", short: "Ask Pick", film: "ask-pick", length: 31.1, go: { href: "/shop", label: "Ask Pick on the shop" }, steps: [["Tap Ask Pick", 2.3], ["Tap Pick to chat", 7.6], ["Ask in your own words", 11.1], ["Tap Send", 18], ["Real pieces, in your size", 22.4], ["Add one to your bag", 24.7]] },
  gift: { title: "How sending a gift works", short: "Sending a gift", film: "gift", length: 59.2, go: { href: "/gift", label: "Send a gift" }, steps: [["Send a piece", 1.6], ["Send it as a gift", 5.2], ["Let them pick the size", 9.2], ["Write their name", 15.2], ["Pick the occasion", 21.6], ["Add their email", 28.4], ["Your mobile number", 32.8], ["Tap Pay", 36.8], ["Log in to eSewa", 40.4], ["Enter the code", 46], ["Confirm the payment", 50.8], ["Sent. They pick their size", 56.4]] },
  giftcards: { title: "How gift cards work", short: "Gift cards", film: "giftcards", length: 38.6, go: { href: "/gift#buy", label: "Buy a gift card" }, steps: [["Pick an amount", 2], ["Write their name", 5.2], ["Add their email", 8], ["Add your name", 12], ["Your mobile number", 14], ["Tap Buy gift card", 17.6], ["Log in to eSewa", 20], ["Enter the code", 25.2], ["Confirm the payment", 30.4], ["Sent, with its code", 36]] },
  fits: { title: "How Designer Fits work", short: "Designer Fits", film: "outfits", length: 47.7, go: { href: "/fits", label: "See the fits" }, steps: [["Choose an occasion", 1.6], ["Browse the fits", 6.4], ["Pick each size", 10.4], ["Tap Quick buy", 15.6], ["Enter your number", 20], ["Tap Pay", 24.8], ["Log in to eSewa", 28.4], ["Enter the code", 34.4], ["Confirm the payment", 39.2], ["Paid. Your order is in", 44.8]] },
  size: { title: "How finding your size works", short: "Your size", film: "size", length: 25.4, go: { href: "/size-guide", label: "Find my size" }, steps: [["Tap Find my size", 1.6], ["Use height and weight", 4.8], ["Set your height", 7.6], ["Tap Next", 11.2], ["See your size", 14], ["Save your size", 17.2], ["Your size, already picked", 20.4]] },
  vault: { title: "How the Vault works", short: "The Vault", film: "vault", length: 23.4, go: { href: "/vault", label: "Enter the Vault" }, steps: [["Choose a brand", 2], ["See every piece", 3.6], ["Open a piece", 4.8], ["Pick your size", 13.6], ["Tap Buy now", 16.8]] },
  drops: { title: "How drops work", short: "Drops", film: "drops", length: 15.8, go: { href: "/drops", label: "See the drop" }, steps: [["Leave your email", 1.6], ["Tap Notify me", 5.6], ["Shop the drop", 9.6]] },
} satisfies Record<string, Guide>;
export type GuideId = keyof typeof GUIDES;

const IDS = Object.keys(GUIDES) as GuideId[];
const src = (g: Guide) => `/story/video/${g.film}.webm`;
const poster = (g: Guide) => `/story/video/${g.film}.webp`;
const two = (n: number) => String(n).padStart(2, "0");
const clock = (s: number) => {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${two(r % 60)}`;
};
const stepAt = (g: Guide, t: number) => g.steps.reduce((i, [, s], k) => (t >= s - 0.25 ? k : i), -1);
const fast = (v: HTMLVideoElement) => {
  v.defaultPlaybackRate = RATE;
  v.playbackRate = RATE;
};

/**
 * Everything to know about how the site works, as one screen like Designer Fits (owner, 29 Oct 2026): the guides
 * listed on the left, the film of the real site in the middle, its steps on the right (tap one to go there) with a
 * way to do it. A film plays through and the next one starts; pause stops that.
 */
export function GuideShowcase() {
  const [id, setId] = useState<GuideId>(IDS[0]);
  const [step, setStep] = useState(-1);
  const [paused, setPaused] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const g: Guide = GUIDES[id];
  const n = IDS.indexOf(id);
  const go = (k: number) => {
    setId(IDS[(k + IDS.length) % IDS.length]);
    setStep(-1);
  };

  // Start the film in view; reduced motion starts paused on its first frame.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a stored preference, read once the page is in the browser
      setPaused(true);
      return;
    }
    if (!paused) void v.play().catch(() => setPaused(true));
  }, [id, paused]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <section aria-labelledby="guides-title" className="bg-[#efeeea]">
      <div className="mx-auto grid max-w-[1520px] gap-8 px-4 py-8 md:px-8 lg:h-[calc(100svh-88px)] lg:min-h-[680px] lg:grid-cols-[230px_minmax(0,1fr)_minmax(300px,380px)] lg:gap-10 lg:py-10">
        {/* Left: the guides */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-steel-dark">
            {IDS.length} films · the real site
          </p>
          <h1 id="guides-title" className="display mt-2 text-[44px] leading-[0.9] lg:text-[52px]">
            How it works
          </h1>
          <ol className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
            {IDS.map((k, i) => (
              <li key={k} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={k === id}
                  className={`flex w-full items-center gap-3 rounded-full border px-4 py-2 text-left transition-colors lg:rounded-none lg:border-0 lg:border-l-2 lg:px-4 lg:py-2.5 ${k === id ? "border-ink bg-ink text-paper lg:bg-transparent lg:text-ink" : "border-ink/15 text-ink/60 hover:text-ink lg:border-transparent"}`}
                >
                  <span className="hidden font-mono text-[11px] lg:inline">{two(i + 1)}</span>
                  <span className="whitespace-nowrap text-[14px] font-medium lg:text-[17px]">{GUIDES[k].short}</span>
                </button>
              </li>
            ))}
          </ol>
          <a href="#questions" className="mt-auto hidden items-center gap-2 pt-6 text-[13px] font-semibold uppercase tracking-[0.08em] lg:inline-flex">
            In the store <ArrowRight aria-hidden className="h-4 w-4" />
          </a>
        </div>

        {/* Middle: the film */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            <p aria-hidden className="display pointer-events-none absolute inset-x-0 top-0 hidden select-none text-center text-[clamp(80px,9vw,150px)] leading-[0.85] text-ink/[0.05] lg:block">
              {g.short}
            </p>
            <div className="relative w-full overflow-hidden rounded-[6px] bg-mist shadow-[0_30px_70px_-35px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.06)]">
              <video
                key={id}
                ref={video}
                src={src(g)}
                poster={poster(g)}
                muted
                playsInline
                onLoadedMetadata={(e) => fast(e.currentTarget)}
                onPlay={(e) => fast(e.currentTarget)}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  setStep(stepAt(g, v.currentTime));
                  if (bar.current) bar.current.style.transform = `scaleX(${v.currentTime / (v.duration || g.length)})`;
                }}
                onEnded={() => !paused && go(n + 1)}
                className="block aspect-[1120/700] w-full object-cover"
                aria-label={`${g.title}: a film of the site`}
              />
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-black/10">
                <span ref={bar} className="block h-full origin-left scale-x-0 bg-ink" />
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 border-t border-ink/15 pt-3">
            <p className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-steel-dark">
              {g.steps.length} steps · {clock(g.length / RATE)} · no sound
            </p>
            <button type="button" onClick={toggle} aria-label={paused ? "Play" : "Pause"} className="grid h-9 w-9 place-items-center rounded-full border border-ink/40 hover:border-ink">
              {paused ? <Play aria-hidden className="h-3.5 w-3.5 fill-current" /> : <Pause aria-hidden className="h-3.5 w-3.5" />}
            </button>
            <span className="font-mono text-[12px] tabular-nums">
              <b>{two(n + 1)}</b> / {two(IDS.length)}
            </span>
            <button type="button" onClick={() => go(n - 1)} aria-label="Previous film" className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink/5">
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => go(n + 1)} aria-label="Next film" className="grid h-9 w-9 place-items-center rounded-full hover:bg-ink/5">
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right: its steps */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-steel-dark">
            Guide {two(n + 1)} · {clock(g.length / RATE)}
          </p>
          <h2 className="display mt-2 text-[34px] leading-[0.92] lg:text-[40px]">{g.title}</h2>
          <ol className="mt-5 min-h-0 flex-1 overflow-y-auto border-t border-ink/15" aria-label="Steps">
            {g.steps.map(([label, at], i) => (
              <li key={label + i} className="border-b border-ink/10">
                <button
                  type="button"
                  onClick={() => {
                    const v = video.current;
                    if (v) {
                      v.currentTime = at;
                      void v.play();
                      setPaused(false);
                    }
                  }}
                  aria-current={i === step ? "step" : undefined}
                  className={`flex w-full items-center gap-4 py-2.5 text-left transition-colors ${i === step ? "text-ink" : "text-ink/55 hover:text-ink"}`}
                >
                  <span className="w-6 font-mono text-[11px] tabular-nums">{two(i + 1)}</span>
                  <span className={`flex-1 text-[14.5px] ${i === step ? "font-semibold" : ""}`}>{label}</span>
                  {i === step && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-volt ring-1 ring-ink/30" />}
                </button>
              </li>
            ))}
          </ol>
          <Link href={g.go.href} className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold uppercase tracking-[0.06em] text-paper hover:bg-[#2b2b2b]">
            {g.go.label} <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-[12.5px] text-steel-dark">Fixed prices · Same price online and in store · Pay with eSewa</p>
        </div>
      </div>
    </section>
  );
}
