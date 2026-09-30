"use client";

import { useEffect, useRef, useState } from "react";

export interface TourStop {
  id: string;
  /** Where the stop is on the floor plan (viewBox 240 × 320). */
  at: [number, number];
  /** The zone to light up on the plan. */
  zone: string;
  kicker: string;
  title: string;
  body: string;
  scene: React.ReactNode;
}

// The floor plan's zones (viewBox 0 0 240 320). Drawn to show the idea, not to scale.
const ZONES: { id: string; x: number; y: number; w: number; h: number; label: string }[] = [
  { id: "fitting", x: 24, y: 24, w: 76, h: 80, label: "Fitting" },
  { id: "kiosk", x: 150, y: 24, w: 66, h: 60, label: "Kiosk" },
  { id: "racks", x: 24, y: 150, w: 76, h: 110, label: "Racks" },
  { id: "floor", x: 106, y: 118, w: 40, h: 60, label: "Helper" },
  { id: "counter", x: 164, y: 128, w: 52, h: 76, label: "Pickup" },
  { id: "door", x: 100, y: 292, w: 40, h: 16, label: "Door" },
  { id: "exit", x: 168, y: 292, w: 44, h: 16, label: "Exit" },
];

/**
 * Scroll to walk the store. A floor plan stays in view with a lime "you" dot that follows the
 * route stop by stop as you scroll; each stop has a drawn scene and a caption.
 */
export function StoreTour({ stops }: { stops: TourStop[] }) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  /** Continuous position along the route: 0 = first stop, stops.length - 1 = last. */
  const [pos, setPos] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const mid = window.innerHeight * 0.5;
      const centres = refs.current.map((el) => {
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      let p = 0;
      if (mid <= centres[0]) p = 0;
      else if (mid >= centres[centres.length - 1]) p = centres.length - 1;
      else {
        const i = centres.findIndex((c, k) => mid >= c && mid < centres[k + 1]);
        p = i + (mid - centres[i]) / (centres[i + 1] - centres[i]);
      }
      setPos(p);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const active = Math.round(pos);
  const i = Math.min(Math.floor(pos), stops.length - 2);
  const f = pos - i;
  const [x0, y0] = stops[i].at;
  const [x1, y1] = stops[i + 1].at;
  const you = { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f };
  const route = stops.map((s) => s.at.join(",")).join(" ");
  const walked = [...stops.slice(0, i + 1).map((s) => s.at), [you.x, you.y]].map((p) => p.join(",")).join(" ");
  const go = (k: number) => refs.current[k]?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });

  const plan = (
    <svg viewBox="0 0 240 320" className="h-full w-full" role="img" aria-label={`Floor plan. You are at: ${stops[active].title}`}>
      {/* walls, with gaps for the door and the exit */}
      <path d="M100 308 H12 V12 H228 V308 H212 M168 308 H140" fill="none" stroke="currentColor" strokeWidth="3" />
      {ZONES.map((z) => {
        const on = stops[active].zone === z.id;
        return (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={on ? "#c6ff3d" : "transparent"} stroke="currentColor" strokeOpacity={on ? 1 : 0.35} strokeWidth="1.2" strokeDasharray={on ? undefined : "3 3"} className="transition-[fill] duration-300" />
            <text x={z.x + z.w / 2} y={z.h < 30 ? z.y + z.h / 2 + 3 : z.y + 12} textAnchor="middle" className="font-mono" fontSize="9" letterSpacing="0.5" fill={on ? "#0a0a0a" : "currentColor"} fillOpacity={on ? 1 : 0.6}>
              {z.label.toUpperCase()}
            </text>
          </g>
        );
      })}
      {/* rails inside the racks zone */}
      {[172, 198, 224].map((y) => (
        <line key={y} x1="32" x2="92" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      ))}
      {/* the route, and the part already walked */}
      <polyline points={route} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" />
      <polyline points={walked} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {stops.map((s, k) => (
        <circle key={s.id} cx={s.at[0]} cy={s.at[1]} r="3" fill={k <= active ? "currentColor" : "transparent"} stroke="currentColor" strokeWidth="1.2" />
      ))}
      {/* you */}
      <circle cx={you.x} cy={you.y} r="11" fill="#c6ff3d" fillOpacity="0.35" />
      <circle cx={you.x} cy={you.y} r="6" fill="#c6ff3d" stroke="#0a0a0a" strokeWidth="2" />
    </svg>
  );

  return (
    <div className="relative lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      {/* The plan: a strip pinned under the header on phones, a column on large screens. */}
      <aside className="sticky top-0 z-20 -mx-4 border-b border-mist bg-paper/95 px-4 pb-3 pt-[76px] backdrop-blur md:pt-[96px] lg:top-28 lg:mx-0 lg:h-[calc(100svh-9rem)] lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="flex items-center gap-4 lg:h-full lg:flex-col lg:items-stretch">
          <div className="h-28 w-[88px] shrink-0 text-ink lg:h-auto lg:min-h-0 lg:w-full lg:flex-1">{plan}</div>
          <div className="min-w-0 flex-1 lg:flex-none">
            <p className="font-mono text-[11px] tracking-[0.12em] text-steel-dark">
              STOP {String(active + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")}
            </p>
            <p className="display mt-1 truncate text-[24px] leading-none lg:text-[32px]" aria-live="polite">
              {stops[active].title}
            </p>
            {/* Jump to any stop */}
            <ol className="mt-3 flex gap-1.5" aria-label="Tour stops">
              {stops.map((s, k) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => go(k)}
                    aria-label={`Go to stop ${k + 1}: ${s.title}`}
                    aria-current={k === active ? "step" : undefined}
                    className="flex h-11 w-7 items-center justify-center"
                  >
                    <span className={`block h-1.5 w-full rounded-full ${k === active ? "bg-ink" : k < active ? "bg-steel" : "bg-mist"}`} />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>

      <ol className="mt-6 lg:mt-0">
        {stops.map((s, k) => (
          <li
            key={s.id}
            id={s.id}
            ref={(el) => {
              refs.current[k] = el;
            }}
            className="flex min-h-[78svh] scroll-mt-64 flex-col justify-center py-10 lg:min-h-[88svh]"
          >
            <div className={`transition-[opacity,transform] duration-500 ${k === active ? "opacity-100" : "opacity-40 lg:translate-y-2"}`}>
              <div className="overflow-hidden rounded-[2px]">{s.scene}</div>
              <p className="mt-6 font-mono text-[12px] tracking-[0.12em] text-steel-dark">
                {String(k + 1).padStart(2, "0")} · {s.kicker.toUpperCase()}
              </p>
              <h2 className="display mt-2 text-[40px] leading-[0.95] md:text-[56px]">{s.title}</h2>
              <p className="mt-3 max-w-[48ch] text-lg text-steel-dark">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
