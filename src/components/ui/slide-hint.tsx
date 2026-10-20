"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

// How customers know a row of cards slides (owner, 20 Oct 2026: "people get confused whether to
// slide the cards"): neighbouring cards peek in at the sides; the first time a row comes into view
// it nudges sideways a little and springs back, once; and under it a short line says what to do
// (swipe on a phone, drag or arrows on a computer) with the arrows themselves and where you are.
// Once someone has moved it, the words go and only the arrows and the count stay.

const coarse = () => window.matchMedia("(pointer: coarse)").matches;
const subscribe = (fn: () => void) => {
  const m = window.matchMedia("(pointer: coarse)");
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

/** Calls `fn` once, the first time half of `ref` is on screen. */
export function useFirstView(ref: React.RefObject<HTMLElement | null>, fn: () => void) {
  const done = useRef(false);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || done.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (done.current || !entries.some((e) => e.isIntersecting)) return;
        done.current = true;
        io.disconnect();
        // A beat after it settles into view, so the eye is on it.
        setTimeout(() => latest.current(), 450);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
}

/**
 * The nudge: moves a position a little ahead and back (about 0.9 s), painting each frame. Not for
 * people who asked for less motion. `stop` reports when the customer has taken over meanwhile.
 */
export function playNudge(set: (offset: number) => void, stop: () => boolean, by = 0.4) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const t0 = performance.now();
  const D = 900;
  const step = (now: number) => {
    if (stop()) return;
    const t = Math.min(1, (now - t0) / D);
    // Out and back on one smooth curve.
    set(by * Math.sin(Math.PI * t) * (1 - 0.15 * t));
    if (t < 1) requestAnimationFrame(step);
    else set(0);
  };
  requestAnimationFrame(step);
}

export function SlideHint({ at, n, used, onPrev, onNext, canPrev = true, canNext = true, label }: { at: number; n: number; /** The customer has moved it: just the arrows and count. */ used: boolean; onPrev: () => void; onNext: () => void; canPrev?: boolean; canNext?: boolean; label: string }) {
  const touch = useSyncExternalStore(subscribe, coarse, () => false);
  if (n < 2) return null;
  const arrow = "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-ink/15 bg-paper text-ink transition-[border-color,opacity,scale] hover:border-ink active:scale-95 disabled:cursor-default disabled:opacity-30";
  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <button type="button" onClick={onPrev} disabled={!canPrev} aria-label={`Previous in ${label}`} className={arrow}>
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <p className="min-w-[120px] text-center text-[12.5px] text-steel-dark" aria-live="polite">
        {!used && (
          <span className="flex items-center justify-center gap-1.5 font-semibold text-ink">
            <span aria-hidden className="slide-hint-l">
              ←
            </span>
            {touch ? "Swipe for more" : "Drag, or use the arrows"}
            <span aria-hidden className="slide-hint-r">
              →
            </span>
          </span>
        )}
        <span className="font-mono tabular-nums">
          {at + 1} / {n}
        </span>
      </p>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label={`Next in ${label}`} className={arrow}>
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
