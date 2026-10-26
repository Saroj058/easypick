"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSyncExternalStore } from "react";

// How customers know a row of cards slides (owner, 20 Oct 2026: "people get confused whether to
// slide the cards"): neighbouring cards peek in at the sides, and under it a short line says what to do
// (swipe on a phone, drag or arrows on a computer) with the arrows themselves and where you are.
// Once someone has moved it, the words go and only the arrows and the count stay. (The rows used to
// lean toward the next card on their own the first time; the owner had that removed on 26 Oct 2026.)

const coarse = () => window.matchMedia("(pointer: coarse)").matches;
const subscribe = (fn: () => void) => {
  const m = window.matchMedia("(pointer: coarse)");
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

export function SlideHint({ at, n, used, onPrev, onNext, canPrev = true, canNext = true, label }: { at: number; n: number; /** The customer has moved it: just the arrows and count. */ used: boolean; onPrev: () => void; onNext: () => void; canPrev?: boolean; canNext?: boolean; label: string }) {
  const touch = useSyncExternalStore(subscribe, coarse, () => false);
  if (n < 2) return null;
  const arrow = "grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-ink transition-[background-color,opacity] hover:bg-ink/[0.06] disabled:cursor-default disabled:opacity-20 disabled:hover:bg-transparent";
  // A thin line with a dark bar that moves as the row does, bare arrows at its ends, and where you
  // are in small numbers. The bar breathes until they first move it.
  const w = Math.max(100 / n, 8);
  const left = n > 1 ? (at / (n - 1)) * (100 - w) : 0;
  const pad = (x: number) => String(x).padStart(2, "0");
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <button type="button" onClick={onPrev} disabled={!canPrev} aria-label={`Previous in ${label}`} className={arrow}>
        <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
      </button>
      <div className="flex items-center gap-3">
        <span aria-hidden className="relative h-[2px] w-28 overflow-hidden rounded-full bg-ink/10 sm:w-36">
          <span className={`absolute inset-y-0 rounded-full bg-ink transition-[left] duration-500 ease-out ${used ? "" : "animate-pulse"}`} style={{ width: `${w}%`, left: `${left}%` }} />
        </span>
        <span className="font-mono text-[11px] tabular-nums tracking-[0.06em] text-steel-dark" aria-live="polite" title={touch ? "Swipe for more" : "Drag for more"}>
          <span className="text-ink">{pad(at + 1)}</span> / {pad(n)}
        </span>
      </div>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label={`Next in ${label}`} className={arrow}>
        <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
