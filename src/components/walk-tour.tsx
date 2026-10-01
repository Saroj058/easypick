"use client";

import { track } from "@vercel/analytics";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { dip, DURATION, stopIndexAt, type TourStop } from "@/lib/tour-plan";
import type { KioskBill, TagInfo } from "./tour3d/build-store";

// The virtual tour as a full-screen scroll: the store fills the window and the page's scroll is
// the walk. Scroll down and you go in, round and out; scroll up and you walk back. The walk is a
// pure function of one number (the second of the film, see lib/tour-plan.ts), and that number
// follows the scroll position with a little easing, so a wheel notch becomes a step, not a jump.
//
// The 3D store is its own chunk: three.js is only downloaded here, after the page has painted,
// and only on devices where it makes sense.
const TourCanvas = dynamic(() => import("./tour3d/tour-canvas"), { ssr: false });

type Mode = "checking" | "3d" | "ask" | "static";

/** Whether this device should get the 3D store: WebGL, enough memory, not on a data saver. */
function decideMode(): Mode {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return "static";
    gl.getExtension("WEBGL_lose_context")?.loseContext(); // only a probe: give the context back
  } catch {
    return "static";
  }
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  if (nav.connection?.saveData || /(^|-)2g|3g/.test(nav.connection?.effectiveType ?? "") || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2)) return "ask";
  return "3d";
}

const Icon = ({ d, fill = false }: { d: string; fill?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={fill ? 0 : 2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const round = "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper disabled:opacity-40";
const glass = "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-paper/35 bg-black/40 text-paper backdrop-blur focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper";

const two = (n: number) => String(n).padStart(2, "0");

export function WalkTour({ stops, tag, bill }: { stops: TourStop[]; tag: TagInfo; bill: KioskBill }) {
  /** The tall, empty element whose height is the length of the walk in scroll. */
  const trackEl = useRef<HTMLDivElement>(null);
  /** `target` is the second the scroll position points at; `now` is the second on screen, easing towards it. */
  const time = useRef({ target: 0, now: 0, painted: -1 });
  /** The page scrolling itself, at the pace of a film, until the visitor takes over. */
  const auto = useRef({ on: false, y: 0 });
  /** True when the store is shown at rest, stop by stop: motion turned off, or no 3D. */
  const atRest = useRef(true);
  /** True once the canvas is drawing, and so moving `now` along every frame. */
  const drawing = useRef(false);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const dipEl = useRef<HTMLDivElement>(null);
  const hintEl = useRef<HTMLParagraphElement>(null);
  const chapterRef = useRef(0);
  const endedRef = useRef(false);
  const started = useRef(false);
  const seen = useRef(new Set<string>());
  const t0 = useRef(0);

  const [mode, setMode] = useState<Mode>("checking");
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [chapter, setChapter] = useState(0);

  const show3d = mode === "3d";

  /** How far the page can scroll, in pixels: the whole walk. */
  const reach = useCallback(() => Math.max(1, (trackEl.current?.offsetHeight ?? 0) - window.innerHeight), []);
  /** The second at which this stop is shown at rest. */
  const restAt = useCallback((t: number) => stops[stopIndexAt(t, stops)].still, [stops]);

  /** Writes a second to the screen's furniture (the rail, the dip to black, the hint) without re-rendering. */
  const paint = useCallback(
    (t: number) => {
      const c = time.current;
      if (hintEl.current) hintEl.current.style.opacity = String(Math.max(0, 1 - c.target / 1.6));
      if (t === c.painted) return;
      c.painted = t;
      stops.forEach((s, i) => {
        const el = fills.current[i];
        if (!el) return;
        const end = stops[i + 1]?.from ?? DURATION;
        el.style.transform = `scaleY(${Math.min(1, Math.max(0, (t - s.from) / (end - s.from)))})`;
      });
      if (dipEl.current) dipEl.current.style.opacity = String(dip(t));
      const i = stopIndexAt(t, stops);
      if (i !== chapterRef.current) {
        chapterRef.current = i;
        setChapter(i);
      }
      const end = t >= DURATION - 0.05;
      if (end !== endedRef.current) {
        endedRef.current = end;
        setEnded(end);
        if (end && started.current) track("tour_complete", { secs: Math.round((Date.now() - t0.current) / 1000) });
      }
    },
    [stops],
  );

  const begin = useCallback(() => {
    if (started.current) return;
    started.current = true;
    t0.current = Date.now();
    track("tour_start", { mode: atRest.current ? "stops" : "scroll" });
  }, []);

  const stopAuto = useCallback(() => {
    if (!auto.current.on) return;
    auto.current.on = false;
    setPlaying(false);
  }, []);

  /** Let the page walk itself. From the end, it starts again at the street. */
  const play = useCallback(() => {
    if (window.scrollY >= reach() - 2) {
      window.scrollTo({ top: 0, behavior: "instant" });
      time.current.target = 0;
      time.current.now = 0;
    }
    auto.current = { on: true, y: window.scrollY };
    setPlaying(true);
    begin();
  }, [begin, reach]);

  /** Go to a stop: the page scrolls there and the camera walks (quickly) to it. */
  const jump = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(stops.length - 1, i));
      stopAuto();
      begin();
      window.scrollTo({ top: n === 0 ? 0 : (stops[n].still / DURATION) * reach(), behavior: atRest.current ? "instant" : "smooth" });
    },
    [begin, reach, stopAuto, stops],
  );

  /** Called by the canvas every frame: moves the second on screen towards the scroll position and returns it. */
  const tick = useCallback(
    (dt: number) => {
      const c = time.current;
      const a = auto.current;
      if (a.on) {
        const max = reach();
        a.y = Math.min(max, a.y + (dt * max) / DURATION);
        window.scrollTo({ top: a.y, behavior: "instant" });
        c.target = (a.y / max) * DURATION;
        if (a.y >= max) stopAuto();
      }
      if (atRest.current) c.now = restAt(c.target);
      else {
        const gap = c.target - c.now;
        c.now = Math.abs(gap) < 0.003 ? c.target : c.now + gap * (1 - Math.exp(-Math.min(dt, 0.1) * 7));
      }
      paint(c.now);
      return c.now;
    },
    [paint, reach, restAt, stopAuto],
  );

  // Device checks after first paint, so the page itself never waits for them.
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const go = () => setMode(decideMode());
    if (idle) idle(go);
    else setTimeout(go, 300);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    atRest.current = reduced || !show3d;
    drawing.current = show3d && ready;
    // The first frame shows where the page already is (a reload keeps its place): no walk to get there.
    const c = time.current;
    c.now = atRest.current ? restAt(c.target) : c.target;
    paint(c.now);
  }, [reduced, show3d, ready, restAt, paint]);

  // The scroll position is the second of the walk.
  useEffect(() => {
    const read = () => {
      const c = time.current;
      const t = Math.min(1, Math.max(0, window.scrollY / reach())) * DURATION;
      if (!auto.current.on) c.target = t;
      if (t > 0.4) begin();
      // Until the canvas draws (and where there is none), the stops change straight from here.
      if (!drawing.current) {
        c.now = restAt(c.target);
        paint(c.now);
      } else paint(c.now);
    };
    // Opened with ?t=12.5: start on that second (for sharing a moment, and for tests).
    const at = Number(new URLSearchParams(location.search).get("t"));
    if (Number.isFinite(at) && location.search.includes("t=")) {
      window.scrollTo({ top: (Math.min(DURATION, Math.max(0, at)) / DURATION) * reach(), behavior: "instant" });
    }
    read();
    time.current.now = atRest.current ? restAt(time.current.target) : time.current.target;
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [begin, paint, reach, restAt]);

  // The moment the visitor scrolls for themselves, the page stops walking by itself.
  useEffect(() => {
    const onControl = (e: Event) => !(e.target instanceof Element && e.target.closest("button, a")) && stopAuto();
    const onKey = (e: KeyboardEvent) => ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key) && onControl(e);
    const onHide = () => document.hidden && stopAuto();
    window.addEventListener("wheel", onControl, { passive: true });
    window.addEventListener("touchstart", onControl, { passive: true });
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("wheel", onControl);
      window.removeEventListener("touchstart", onControl);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [stopAuto]);

  // Analytics (Vercel custom events): which stops were reached.
  useEffect(() => {
    const id = stops[chapter].id;
    if (started.current && !seen.current.has(id)) {
      seen.current.add(id);
      track("tour_zone", { zone: id });
    }
  }, [chapter, stops]);

  const stop = stops[chapter];
  const lines = stop.caption.match(/[^.?!]+[.?!]+/g) ?? [stop.caption];
  const state = mode === "checking" || (show3d && !ready) ? "loading" : playing ? "playing" : ended ? "ended" : "ready";

  return (
    <section aria-label="Virtual tour" data-tour-state={state} data-chapter={stop.id} className="on-dark relative bg-ink text-paper">
      <h1 className="sr-only">Walk the store</h1>
      {/* The length of the walk: ten screens of scroll. Nothing is drawn here; the stage below stays put. */}
      <div ref={trackEl} className="h-[1000svh]" aria-hidden />

      <div className="fixed inset-0 overflow-hidden bg-ink">
        {/* Before the store is on screen (and where there is no 3D): the stop in plain type. */}
        {!(show3d && ready) && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center">
            {mode === "static" ? (
              <p className="display text-[72px] leading-[0.9] text-paper/20 md:text-[160px]">{stop.name}</p>
            ) : mode === "ask" ? (
              <button type="button" onClick={() => setMode("3d")} className="inline-flex h-12 items-center rounded-full bg-paper px-7 text-[14px] font-semibold uppercase tracking-[0.06em] text-ink">
                Load the 3D store
              </button>
            ) : (
              <p className="animate-pulse font-mono text-[11px] uppercase tracking-[0.2em] text-paper/60">Opening the store</p>
            )}
          </div>
        )}

        {/* The canvas takes no pointer or touch, so the wheel and the finger always scroll the page. */}
        {show3d && (
          <div className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} aria-hidden>
            <TourCanvas tick={tick} lively={!reduced} tag={tag} bill={bill} onReady={() => setReady(true)} />
          </div>
        )}

        {/* The one cut dips through black. */}
        <div ref={dipEl} className="pointer-events-none absolute inset-0 bg-black opacity-0" aria-hidden />
        {/* A vignette, and scrims top and bottom so white type reads over any frame. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_55%,rgba(0,0,0,0.45)_100%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/35 to-transparent" aria-hidden />

        {/* The page has no header: the name leads home, the cross leads back to the visit page. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] md:px-10 md:pt-6">
          <Link href="/" aria-label="Easypick, home" className="display flex h-11 items-center text-[26px] leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper md:text-[30px]">
            Easypick
          </Link>
          <Link href="/visit" aria-label="Close the tour" className={glass}>
            <Icon d="M6 6l12 12M18 6L6 18" />
          </Link>
        </div>

        {/* The seven stops down the right edge: each is a button, and fills as the walk passes through it. */}
        <ol className="absolute right-0 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 md:right-6">
          {stops.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => jump(i)}
                title={s.name}
                aria-label={`Stop ${i + 1}: ${s.name}`}
                aria-current={i === chapter ? "step" : undefined}
                className="flex h-10 w-11 justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-paper md:h-11"
              >
                <span className="relative block h-full w-[3px] bg-paper/35">
                  <span
                    ref={(el) => {
                      fills.current[i] = el;
                    }}
                    style={{ transform: "scaleY(0)" }}
                    className="absolute inset-0 origin-top bg-paper"
                  />
                </span>
              </button>
            </li>
          ))}
        </ol>

        {/* The row spans the window but only its two ends take a tap: the stops' buttons sit above its empty middle. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] md:px-10 md:pb-9 [&>*]:pointer-events-auto">
          <div className="min-w-0">
            <p ref={hintEl} className="mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/85" aria-hidden>
              <span className="relative block h-9 w-px overflow-hidden bg-paper/30">
                <span className="tour-hint absolute inset-0 bg-paper" />
              </span>
              Scroll to walk in
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper/70">
              {two(chapter + 1)} / {two(stops.length)} · {stop.name}
            </p>
            {/* The stop's one line, a sentence to a row, each rising into place as the stop begins. */}
            <p key={stop.id} className="display mt-2 text-[clamp(2.6rem,1.2rem+3.2vw,4rem)] leading-[0.92] [text-shadow:0_1px_14px_rgb(0_0_0/0.7)]">
              {lines.map((line, i) => (
                <span key={line} className="tour-line">
                  <span style={{ animationDelay: `${i * 90}ms` }}>{line.trim()}</span>
                </span>
              ))}
            </p>
            {/* At the end of the walk: where to go next. */}
            {ended && (
              <div className="mt-5 flex animate-fade-up flex-wrap gap-2 md:gap-3">
                <Link href="/visit" className="inline-flex h-12 items-center rounded-full bg-paper px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink md:px-6 md:text-[13px]">
                  Visit the store
                </Link>
                <Link href="/shop" className="inline-flex h-12 items-center rounded-full border border-paper/60 bg-black/40 px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-paper hover:bg-paper hover:text-ink md:px-6 md:text-[13px]">
                  Shop the drop
                </Link>
              </div>
            )}
          </div>

          {show3d && !reduced ? (
            <button type="button" onClick={() => (playing ? stopAuto() : play())} disabled={!ready} aria-label={playing ? "Pause" : ended ? "Walk it again" : "Walk it for me"} className={round}>
              {playing ? <Icon d="M7 5h3v14H7zM14 5h3v14h-3z" fill /> : ended ? <Icon d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /> : <Icon d="M8 5l11 7-11 7z" fill />}
            </button>
          ) : (
            mode !== "checking" &&
            mode !== "ask" && (
              <div className="flex gap-2">
                <button type="button" onClick={() => jump(chapter - 1)} disabled={chapter === 0} aria-label="Previous stop" className={round}>
                  <Icon d="M19 12H5M11 6l-6 6 6 6" />
                </button>
                <button type="button" onClick={() => jump(chapter + 1)} disabled={chapter === stops.length - 1} aria-label="Next stop" className={round}>
                  <Icon d="M5 12h14M13 6l6 6-6 6" />
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* What the scene shows, for people who can't see it. */}
      <p aria-live="polite" className="sr-only">
        Stop {chapter + 1} of {stops.length}. {stop.caption} {stop.says}
      </p>
    </section>
  );
}
