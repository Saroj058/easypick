"use client";

import { useEffect, useRef } from "react";

// The arrow keys move the strip you're looking at (owner, 18 Oct 2026): no click or focus first.
// Every strip and carousel registers here; one listener on the window sends ← and → to whichever
// is most in view. Typing in a field, a pop-up that's open, or a key with Ctrl/Alt/⌘ is left alone,
// and a strip that already handled the key itself (it had focus) isn't moved twice.

type Entry = { el: HTMLElement; move: (dir: -1 | 1) => void };
const entries = new Set<Entry>();
let listening = false;

function typing(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el || !el.closest) return false;
  return Boolean(el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='dialog'], [role='slider'], [role='tablist']"));
}

/** How much of an element is on screen, weighted toward the middle of the window. */
function score(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const seen = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
  const across = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
  if (seen < Math.min(120, r.height / 3) || across < Math.min(120, r.width / 3)) return 0;
  // Strips side by side (the offers): the one nearest the middle of the window wins.
  const middle = Math.abs((r.top + r.bottom) / 2 - vh / 2) + Math.abs((r.left + r.right) / 2 - vw / 2) * 0.5;
  return seen - middle * 0.25;
}

function onKey(e: KeyboardEvent) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (typing(e.target) || document.querySelector("[role='dialog'][data-state='open'], [aria-modal='true']")) return;
  let best: Entry | null = null;
  let top = 0;
  for (const entry of entries) {
    const s = score(entry.el);
    if (s > top) {
      top = s;
      best = entry;
    }
  }
  if (!best) return;
  e.preventDefault();
  best.move(e.key === "ArrowLeft" ? -1 : 1);
}

/** Lets ← and → move this strip whenever it's the one most in view. */
export function useArrowKeys(ref: React.RefObject<HTMLElement | null>, move: (dir: -1 | 1) => void) {
  const latest = useRef(move);
  useEffect(() => {
    latest.current = move;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const entry: Entry = { el, move: (d) => latest.current(d) };
    entries.add(entry);
    if (!listening) {
      window.addEventListener("keydown", onKey);
      listening = true;
    }
    return () => {
      entries.delete(entry);
      if (!entries.size && listening) {
        window.removeEventListener("keydown", onKey);
        listening = false;
      }
    };
  }, [ref]);
}
