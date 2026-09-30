"use client";

import { track } from "@vercel/analytics";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { pathPosition, stopIndexAt, type TourStopCopy } from "@/lib/tour-plan";
import type { TagInfo } from "./tour3d/build-store";

// The 3D store is its own chunk: three.js is only downloaded here, after the page has painted,
// and only on devices where it makes sense.
const TourCanvas = dynamic(() => import("./tour3d/tour-canvas"), { ssr: false });

export interface RackPick {
  slug: string;
  name: string;
  price: string;
  note: string;
}

type Mode = "checking" | "3d" | "ask" | "static";
const STILL_KEY = "ep-tour-still";

/** Whether this device should get the 3D walk: WebGL, enough memory, not on a data saver. */
function decideMode(): Mode {
  try {
    const c = document.createElement("canvas");
    if (!c.getContext("webgl2")) return "static";
  } catch {
    return "static";
  }
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  if (nav.connection?.saveData || /(^|-)2g|3g/.test(nav.connection?.effectiveType ?? "") || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2)) return "ask";
  return "3d";
}

/** Without 3D: the stop's zone sign, as it hangs in the store. */
function StaticStage({ stop }: { stop: TourStopCopy }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_35%,#2a2f3b,#101218_70%)] px-6">
      <div className="w-full max-w-md bg-volt px-6 py-5 text-ink shadow-[0_30px_80px_-30px_rgba(198,255,61,0.45)]">
        <p className="flex items-baseline gap-4">
          <span className="display text-[88px] leading-none">{stop.sign}</span>
          <span className="display text-[44px] leading-none">{stop.id === "street" ? "EASYPICK" : stop.title.replace(/\.$/, "")}</span>
        </p>
        <p lang="ne" className="mt-2 font-[family-name:var(--font-nepali)] text-lg font-semibold">
          {stop.ne}
        </p>
      </div>
    </div>
  );
}

export function WalkTour({ stops, tag, rack, end }: { stops: TourStopCopy[]; tag: TagInfo; rack: RackPick[]; end: React.ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const pathRef = useRef(0);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<Mode>("checking");
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const seen = useRef(new Set<string>());
  const started = useRef(false);
  const t0 = useRef(0);

  // Device checks after first paint, so the page itself never waits for them.
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage once mounted
      setPaused(localStorage.getItem(STILL_KEY) === "1");
    } catch {}
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const go = () => setMode(decideMode());
    if (idle) idle(go);
    else setTimeout(go, 300);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Scroll → where you are on the walk. Native scroll only; nothing is hijacked.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = section.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // The stop whose caption band holds the middle of the screen.
      const p = Math.min(1, Math.max(0, (vh / 2 - r.top) / r.height));
      pathRef.current = pathPosition(p, stops);
      setProgress(p);
      setActive(stopIndexAt(p, stops.length));
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
  }, [stops]);

  // Analytics (Vercel custom events) and a shareable #zone in the address bar.
  useEffect(() => {
    const id = stops[active].id;
    if (progress > 0.02 && !started.current) {
      started.current = true;
      t0.current = Date.now();
      track("tour_start", { mode });
    }
    if (started.current && !seen.current.has(id)) {
      seen.current.add(id);
      track("tour_zone", { zone: id });
      if (active === stops.length - 1) track("tour_complete", { secs: Math.round((Date.now() - t0.current) / 1000) });
    }
    if (started.current && location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
  }, [active, progress, stops, mode]);

  const jump = useCallback(
    (i: number) => {
      const el = items.current[Math.max(0, Math.min(stops.length - 1, i))];
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      // Land where the camera has stopped and the caption is up.
      window.scrollTo({ top: top + el.offsetHeight * 0.18 - window.innerHeight / 2, behavior: reduced || paused ? "auto" : "smooth" });
      el.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    },
    [stops.length, reduced, paused],
  );

  const togglePause = () => {
    setPaused((p) => {
      try {
        localStorage.setItem(STILL_KEY, p ? "0" : "1");
      } catch {}
      return !p;
    });
  };

  const still = reduced || paused;
  const show3d = mode === "3d";

  return (
    <>
      <div className="container-ep flex flex-wrap items-center gap-x-6 gap-y-2 pb-4">
        <a href="#tour-end" className="inline-flex min-h-11 items-center text-[15px] font-semibold underline underline-offset-4">
          Skip the tour
        </a>
        {mode === "ask" && (
          <button type="button" onClick={() => setMode("3d")} className="btn btn-outline">
            Load the 3D walk (about 300 KB)
          </button>
        )}
      </div>

      <section ref={section} aria-label="Virtual tour" className="relative">
        {/* Controls: their own zero-height sticky layer, so they sit above the scrolling captions */}
        <div className="pointer-events-none sticky top-0 z-30 h-0">
          <nav aria-label="Tour" className="pointer-events-auto absolute inset-x-0 top-[76px] md:top-[96px]">
            <div className="container-ep flex items-center justify-between gap-3">
              <p className="bg-ink/80 px-3 py-2 font-mono text-[12px] tracking-[0.12em] text-paper">
                {String(active + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")}
                <span className="hidden sm:inline"> · {stops[active].title.toUpperCase().replace(/\.$/, "")}</span>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => jump(active - 1)} disabled={active === 0} className="flex h-11 min-w-11 items-center justify-center bg-paper px-3 text-[14px] font-semibold text-ink disabled:opacity-50" aria-label="Previous stop">
                  ←
                </button>
                <button type="button" onClick={() => jump(active + 1)} disabled={active === stops.length - 1} className="flex h-11 min-w-11 items-center justify-center bg-paper px-3 text-[14px] font-semibold text-ink disabled:opacity-50" aria-label="Next stop">
                  →
                </button>
                {show3d && !reduced && (
                  <button type="button" onClick={togglePause} aria-pressed={paused} className="flex h-11 items-center whitespace-nowrap bg-paper px-3 text-[13px] font-semibold text-ink">
                    {paused ? "Play motion" : "Pause motion"}
                  </button>
                )}
              </div>
            </div>
          </nav>
        </div>

        {/* The stage: pinned while the captions scroll past */}
        <div className="sticky top-0 h-[100svh] overflow-hidden bg-[#1a1f2b]">
          {!(show3d && ready) && (
            <div className="absolute inset-0" aria-hidden>
              <StaticStage stop={stops[active]} />
            </div>
          )}
          {show3d && (
            <div className={`absolute inset-0 transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} aria-hidden>
              <TourCanvas pathRef={pathRef} still={still} tag={tag} onReady={() => setReady(true)} />
            </div>
          )}
          {/* A soft vignette so captions and controls read over the scene */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />

          {/* Walk progress along the bottom */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex gap-1 px-4 pb-[max(10px,env(safe-area-inset-bottom))]" aria-hidden>
            {stops.map((s, i) => (
              <span key={s.id} className="h-1 flex-1 bg-paper/25">
                <span
                  className="block h-full bg-volt"
                  style={{ width: `${Math.min(100, Math.max(0, (progress * stops.length - i) * 100))}%` }}
                />
              </span>
            ))}
          </div>
        </div>

        {/* The captions: the real content, in reading order. The scene above is decoration. */}
        <ol className="pointer-events-none relative z-10 -mt-[100svh]">
          {stops.map((s, i) => (
            <li
              key={s.id}
              id={s.id}
              ref={(el) => {
                items.current[i] = el;
              }}
              className="pointer-events-none flex min-h-[150svh] scroll-mt-0 flex-col pt-[42svh]"
            >
              <article aria-labelledby={`${s.id}-h`} className="container-ep">
                <div className="pointer-events-auto max-w-md bg-paper/95 p-5 text-ink shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur md:p-7">
                  <p className="font-mono text-[12px] tracking-[0.12em] text-steel-dark">
                    {s.sign === "00" ? "EASYPICK" : `${s.sign} · ${s.id.toUpperCase()}`}
                  </p>
                  <h2 id={`${s.id}-h`} tabIndex={-1} className="display mt-2 text-[40px] leading-[0.95] outline-none md:text-[56px]">
                    {s.title}
                  </h2>
                  <p lang="ne" className="mt-1 font-[family-name:var(--font-nepali)] text-[17px] font-semibold text-steel-dark">
                    {s.ne}
                  </p>
                  <p className="mt-3 text-[16px] leading-relaxed">{s.body}</p>

                  {s.id === "pick" && rack.length > 0 && (
                    <div className="mt-4 border-t border-mist pt-3">
                      <p className="text-[13px] font-semibold text-steel-dark">On the rack now</p>
                      <ul className="mt-1">
                        {rack.map((p) => (
                          <li key={p.slug}>
                            <Link
                              href={`/product/${p.slug}`}
                              onClick={() => track("tour_hotspot", { zone: "pick", slug: p.slug })}
                              className="flex min-h-11 items-center justify-between gap-3 text-[15px] hover:underline"
                            >
                              <span>
                                {p.name} <span className="text-[12px] text-steel-dark">· {p.note}</span>
                              </span>
                              <span className="shrink-0 font-mono">{p.price}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {s.worry && (
                    <details className="group mt-4 border-t border-mist pt-3" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && track("tour_hotspot", { zone: s.id, kind: "worry" })}>
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold">
                        {s.worry.q}
                        <span className="text-xl leading-none transition-transform group-open:rotate-45" aria-hidden>
                          +
                        </span>
                      </summary>
                      <p className="pb-1 text-[15px] text-steel-dark">{s.worry.a}</p>
                    </details>
                  )}

                  {i === 0 && <p className="mt-4 font-mono text-[12px] tracking-[0.12em] text-steel-dark">SCROLL ↓ TO WALK IN</p>}
                </div>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <div
        id="tour-end"
        className="scroll-mt-24"
        onClick={(e) => {
          const cta = (e.target as HTMLElement).closest<HTMLElement>("[data-cta]");
          if (cta) track("tour_cta", { cta: cta.dataset.cta ?? "" });
        }}
      >
        {end}
      </div>
    </>
  );
}
