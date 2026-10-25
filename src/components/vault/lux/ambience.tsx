"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { L } from "./tokens";

// The Vault's quiet extras (owner, 25 Oct 2026: luxury revamp): a fine film grain over the whole
// page, a slow strip of plain facts between sections, and a thin index of sections at the right
// edge on big screens. None of them carry anything the page needs; they only set the mood.

// A static noise tile, drawn by the browser from an inline SVG (no image file to load).
const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Film grain over the whole page. Sits above the content but under the site header; never moves. */
export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 opacity-[0.045] mix-blend-soft-light"
      style={{ backgroundImage: NOISE, backgroundSize: "180px 180px" }}
    />
  );
}

// The strip's own motion: one copy slides out as the twin slides in, so the loop has no seam.
const STRIP_CSS = `
@keyframes lx-facts-slide { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
.lx-facts-track { animation: lx-facts-slide 60s linear infinite; }
.lx-facts:hover .lx-facts-track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .lx-facts-track { animation: none; } }
`;

function FactList({ facts, copy = false }: { facts: string[]; copy?: boolean }) {
  return (
    <ul aria-label={copy ? undefined : "Good to know"} aria-hidden={copy || undefined} className="flex shrink-0 items-center">
      {facts.map((f, i) => (
        <li key={i} className="flex items-center whitespace-nowrap">
          <span className="px-6">{f}</span>
          <span aria-hidden className={L.brass}>·</span>
        </li>
      ))}
    </ul>
  );
}

/** A thin band of plain facts that drifts slowly sideways. Stops on hover; with less motion asked for, it's a still, wrapping row. */
export function FactsStrip({ facts }: { facts: string[] }) {
  const still = useReducedMotion();
  if (!facts.length) return null;

  const band = `border-y ${L.hair} ${L.dim} ${L.label} tabular-nums`;

  if (still) {
    return (
      <div className={band}>
        <ul aria-label="Good to know" className={`${L.wrap} flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4`}>
          {facts.map((f, i) => (
            <li key={i} className="flex items-center gap-6">
              {i > 0 && <span aria-hidden className={L.brass}>·</span>}
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={`lx-facts overflow-hidden py-4 ${band}`}>
      <style>{STRIP_CSS}</style>
      <div className="lx-facts-track flex w-max">
        <FactList facts={facts} />
        <FactList facts={facts} copy />
      </div>
    </div>
  );
}

/** A thin index of the page's sections at the right edge (wide screens only). The section in view is lit. */
export function SectionIndex({ sections }: { sections: { id: string; label: string }[] }) {
  const still = useReducedMotion();
  const [current, setCurrent] = useState<string | null>(null);
  const key = sections.map((s) => s.id).join("|");

  useEffect(() => {
    const els = key
      .split("|")
      .map((id) => (id ? document.getElementById(id) : null))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    // A section counts as "current" while it crosses the middle band of the screen.
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setCurrent(hit.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);

  if (!sections.length) return null;

  function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <nav aria-label="On this page" className="fixed right-0 top-1/2 z-30 hidden w-10 -translate-y-1/2 xl:block">
      <ul className="flex flex-col items-center gap-5">
        {sections.map((s) => {
          const on = current === s.id;
          return (
            <li key={s.id} className="flex flex-col items-center">
              <a
                href={`#${s.id}`}
                onClick={(e) => jump(e, s.id)}
                aria-current={on ? "location" : undefined}
                className={`group flex flex-col items-center gap-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] transition-colors duration-300 hover:text-[#ede8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df] ${on ? L.ivory : L.dim}`}
              >
                <span aria-hidden className={`block transition-all duration-500 ${on ? `h-3 w-[2px] ${L.brassBg}` : "h-6 w-px bg-[#ede8df]/[0.12]"}`} />
                <span className="rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">{s.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
