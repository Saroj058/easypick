"use client";

import { useEffect, useSyncExternalStore } from "react";

// "My size" on the home rail: pick a size once and the rail only shows pieces in stock in it.
// Remembered in this browser only.

const KEY = "ep-rail-size-v1";
const SIZES = ["S", "M", "L", "XL"];

function apply(size: string | null, limit: number) {
  const items = Array.from(document.querySelectorAll<HTMLLIElement>("#rail-grid > li"));
  let shown = 0;
  for (const li of items) {
    const has = (li.dataset.sizes ?? "").split(" ");
    const fits = !size || has.includes(size) || has.includes("ONE"); // one-size pieces fit everyone
    li.hidden = !fits || shown >= limit;
    if (!li.hidden) shown++;
  }
  const empty = document.getElementById("rail-empty");
  if (empty) empty.hidden = shown > 0;
}

const EVENT = "ep-rail-size";

function read(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && SIZES.includes(v) ? v : null;
  } catch {
    return null; // storage blocked
  }
}

function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

export function MySize({ limit }: { limit: number }) {
  const size = useSyncExternalStore(subscribe, read, () => null);

  // Show or hide rail cards to match (the grid is server-rendered).
  useEffect(() => apply(size, limit), [size, limit]);

  function choose(next: string | null) {
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      // storage blocked
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div role="group" aria-label="My size" className="flex h-11 items-center border border-ink">
      <span className="whitespace-nowrap px-3 text-sm font-semibold">My size</span>
      {SIZES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={size === s}
          onClick={() => choose(size === s ? null : s)}
          className={`h-full min-w-10 border-l border-mist px-2 font-mono text-[13px] font-semibold ${size === s ? "bg-ink text-paper" : "hover:bg-photo"}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
