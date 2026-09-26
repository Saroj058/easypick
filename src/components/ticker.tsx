"use client";

import { useState } from "react";

/**
 * The home page's store ticker: one line that scrolls slowly. Hover or focus pauses it;
 * on touch, tapping the line (or the pause button) toggles it. Static under reduced motion.
 */
export function Ticker({ items }: { items: string[] }) {
  const [paused, setPaused] = useState(false);
  return (
    <section aria-label="Store updates" data-paused={paused || undefined} className="ticker relative overflow-hidden border-y border-paper/10 bg-graphite py-3 text-paper">
      <div className="ticker-track" onClick={() => setPaused((p) => !p)}>
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1 || undefined} className={`flex shrink-0 ${copy === 1 ? "ticker-dup" : ""}`}>
            {items.map((t) => (
              <li key={t} className="index flex items-center gap-6 whitespace-nowrap pr-6 text-paper/80">
                {t}
                <span className="h-1 w-1 bg-volt" aria-hidden />
              </li>
            ))}
          </ul>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label="Pause store updates"
        className="ticker-pause absolute inset-y-0 right-0 flex min-w-11 items-center justify-center bg-graphite px-3 text-paper/80 hover:text-paper"
      >
        <span aria-hidden className="font-mono text-[13px]">
          {paused ? "▶" : "❚❚"}
        </span>
      </button>
    </section>
  );
}
