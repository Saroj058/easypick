"use client";

import { useRef } from "react";

// A Vault shelf: the soft grey band the pieces stand on, like one row of the wall in the store,
// with a quiet light that follows the pointer (written straight to CSS variables, so nothing
// re-renders). On touch screens, and for people who ask for less motion, the light simply rests
// over the middle of the shelf.

export function VaultShelf({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const band = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={band}
      onPointerMove={(e) => {
        const el = band.current;
        if (!el || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--x", `${e.clientX - r.left}px`);
        el.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
      className={`group/shelf relative isolate overflow-hidden bg-[#ededeb] px-4 pb-8 pt-10 md:px-8 md:pb-10 md:pt-12 ${className}`}
    >
      {/* The light: resting in the middle, or following the pointer */}
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_15%,rgba(255,255,255,0.75),transparent_70%)] [@media(hover:hover)]:motion-safe:opacity-60" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden bg-[radial-gradient(340px_260px_at_var(--x,50%)_var(--y,20%),rgba(255,255,255,0.9),transparent_70%)] opacity-0 transition-opacity duration-700 group-hover/shelf:opacity-100 [@media(hover:hover)]:motion-safe:block"
      />
      {/* The shelf's edge */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-ink/10" />
      {children}
    </div>
  );
}
