"use client";

import { track } from "@vercel/analytics";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { dip, DURATION, stopIndexAt, type TourStop } from "@/lib/tour-plan";
import type { KioskBill, TagInfo } from "./tour3d/build-store";
import type { TourClock } from "./tour3d/tour-canvas";

// The virtual tour as a short film: it plays by itself, with one line of caption, a play button
// and seven chapter buttons along the bottom. Nothing else is on the page.
//
// The 3D store is its own chunk: three.js is only downloaded here, after the page has painted,
// and only on devices where it makes sense.
const TourCanvas = dynamic(() => import("./tour3d/tour-canvas"), { ssr: false });

type Mode = "checking" | "3d" | "ask" | "static";

/** Whether this device should get the 3D film: WebGL, enough memory, not on a data saver. */
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

export function WalkTour({ stops, tag, bill }: { stops: TourStop[]; tag: TagInfo; bill: KioskBill }) {
  const clock = useRef<TourClock>({ t: 0, playing: false });
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const dipEl = useRef<HTMLDivElement>(null);
  const chapterRef = useRef(0);
  const started = useRef(false);
  const seen = useRef(new Set<string>());
  const t0 = useRef(0);
  /** Opened with ?t=12.5: start on that second and stay paused (for sharing a moment, and for tests). */
  const pinned = useRef(false);

  const [mode, setMode] = useState<Mode>("checking");
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlayingState] = useState(false);
  const [ended, setEnded] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [seek, setSeek] = useState(0);

  const show3d = mode === "3d";

  /** Moves the progress along the chapter buttons and the dip to black, without re-rendering. */
  const paint = useCallback(
    (t: number) => {
      stops.forEach((s, i) => {
        const el = fills.current[i];
        if (!el) return;
        const end = stops[i + 1]?.from ?? DURATION;
        el.style.width = `${Math.min(100, Math.max(0, ((t - s.from) / (end - s.from)) * 100))}%`;
      });
      if (dipEl.current) dipEl.current.style.opacity = String(dip(t));
      const i = stopIndexAt(t, stops);
      if (i !== chapterRef.current) {
        chapterRef.current = i;
        setChapter(i);
      }
    },
    [stops],
  );

  const setPlaying = useCallback((p: boolean) => {
    clock.current.playing = p;
    setPlayingState(p);
  }, []);

  const play = useCallback(() => {
    if (clock.current.t >= DURATION) {
      clock.current.t = 0;
      paint(0);
      setSeek((n) => n + 1);
    }
    setEnded(false);
    setPlaying(true);
    if (!started.current) {
      started.current = true;
      t0.current = Date.now();
      track("tour_start", { mode: "3d" });
    }
  }, [paint, setPlaying]);

  /** Jump to a chapter. The film carries on from there (or shows it at rest, with motion off). */
  const jump = useCallback(
    (i: number, still = reduced || !show3d) => {
      const n = Math.max(0, Math.min(stops.length - 1, i));
      clock.current.t = still ? stops[n].still : stops[n].from;
      paint(clock.current.t);
      setSeek((k) => k + 1);
      setEnded(false);
      if (!still) play();
    },
    [paint, play, reduced, show3d, stops],
  );

  // Device checks after first paint, so the page itself never waits for them.
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    const at = Number(new URLSearchParams(location.search).get("t"));
    if (Number.isFinite(at) && location.search.includes("t=")) {
      pinned.current = true;
      clock.current.t = Math.min(DURATION, Math.max(0, at));
    }
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const go = () => setMode(decideMode());
    if (idle) idle(go);
    else setTimeout(go, 300);
    return () => mq.removeEventListener("change", update);
  }, []);

  // The film starts by itself once the first frame is drawn, unless motion is off or a moment was pinned.
  useEffect(() => {
    if (!ready || !show3d) return;
    paint(clock.current.t);
    if (!reduced && !pinned.current) play();
  }, [ready, show3d, reduced, paint, play]);

  // With motion off (or no 3D), each chapter is shown at rest.
  useEffect(() => {
    if (mode === "checking" || pinned.current) return;
    if (reduced || !show3d) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- settle on a still frame when motion is turned off
      setPlaying(false);
      clock.current.t = stops[chapterRef.current].still;
      paint(clock.current.t);
      setSeek((k) => k + 1);
    }
  }, [reduced, show3d, mode, stops, paint, setPlaying]);

  // A tab left in the background stops the film; it doesn't start again on its own.
  useEffect(() => {
    const onHide = () => document.hidden && setPlaying(false);
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [setPlaying]);

  // Analytics (Vercel custom events): which chapters were reached.
  useEffect(() => {
    const id = stops[chapter].id;
    if (started.current && !seen.current.has(id)) {
      seen.current.add(id);
      track("tour_zone", { zone: id });
    }
  }, [chapter, stops]);

  const onEnd = useCallback(() => {
    setPlaying(false);
    setEnded(true);
    track("tour_complete", { secs: Math.round((Date.now() - t0.current) / 1000) });
  }, [setPlaying]);

  /** Called by the canvas every frame: moves the clock on while the film runs, and returns the current second. */
  const tick = useCallback(
    (dt: number) => {
      const c = clock.current;
      if (c.playing) {
        c.t = Math.min(DURATION, c.t + dt);
        if (c.t >= DURATION) onEnd();
      }
      paint(c.t);
      return c.t;
    },
    [onEnd, paint],
  );

  const toggle = () => (playing ? setPlaying(false) : play());
  const stop = stops[chapter];
  const state = mode === "checking" || (show3d && !ready) ? "loading" : ended ? "ended" : playing ? "playing" : "paused";

  return (
    <section
      aria-label="Virtual tour"
      data-tour-state={state}
      data-chapter={stop.id}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget && (e.key === " " || e.key === "Enter")) return; // a focused button handles its own press
        if ((e.key === " " || e.key === "k") && show3d && !reduced) {
          e.preventDefault();
          toggle();
        } else if (e.key === "ArrowRight") jump(chapter + 1);
        else if (e.key === "ArrowLeft") jump(chapter - 1);
        else if (e.key === "Home") jump(0);
      }}
      className="on-dark relative h-[calc(100svh-72px)] min-h-[460px] touch-pan-y overflow-hidden bg-ink text-paper outline-none md:h-[calc(100svh-88px)]"
    >
      <h1 className="sr-only">Walk the store</h1>

      {/* Before the film is on screen (and where there is no 3D): the name, and the chapter in plain type. */}
      {!(show3d && ready) && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          {mode === "static" ? (
            <div>
              <p className="font-mono text-[13px] tracking-[0.2em] text-paper/60">
                {String(chapter + 1).padStart(2, "0")} / {String(stops.length).padStart(2, "0")}
              </p>
              <p className="display mt-4 text-[64px] leading-[0.9] md:text-[112px]">{stop.name}</p>
            </div>
          ) : (
            <div>
              <p className="display text-[56px] leading-none md:text-[88px]">EASYPICK</p>
              {mode === "ask" && (
                <button type="button" onClick={() => setMode("3d")} className="mt-8 inline-flex h-12 items-center rounded-full bg-paper px-7 text-[14px] font-semibold uppercase tracking-[0.06em] text-ink">
                  Play in 3D
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {show3d && (
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} aria-hidden>
          <TourCanvas tick={tick} playing={playing} seek={seek} tag={tag} bill={bill} onReady={() => setReady(true)} />
        </div>
      )}

      {/* Tap anywhere on the film to pause or play (the button below does the same, for keyboards and screen readers). */}
      {show3d && ready && !reduced && <button type="button" tabIndex={-1} aria-hidden onClick={toggle} className="absolute inset-0 z-10 cursor-default" />}

      {/* The one cut dips through black. */}
      <div ref={dipEl} className="pointer-events-none absolute inset-0 z-10 bg-black opacity-0" aria-hidden />
      {/* A vignette, and a scrim under the caption so white type reads over any frame. */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_50%_45%,transparent_55%,rgba(0,0,0,0.45)_100%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-56 bg-gradient-to-t from-black/85 via-black/45 to-transparent" aria-hidden />

      <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-[max(12px,env(safe-area-inset-bottom))] md:px-8 md:pb-5">
        <div className="flex items-end justify-between gap-4">
          <p key={stop.id} className="display animate-fade-up text-[30px] leading-[0.95] [text-shadow:0_1px_12px_rgb(0_0_0/0.8)] md:text-[44px]">
            {stop.caption}
          </p>
          {show3d && !reduced ? (
            <button type="button" onClick={toggle} disabled={!ready} aria-label={ended ? "Play again" : playing ? "Pause" : "Play"} className={round}>
              {ended ? <Icon d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /> : playing ? <Icon d="M7 5h3v14H7zM14 5h3v14h-3z" fill /> : <Icon d="M8 5l11 7-11 7z" fill />}
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

        {/* The seven chapters: each is a button, and fills as the film passes through it. */}
        <ol className="mt-2 flex gap-1">
          {stops.map((s, i) => (
            <li key={s.id} className="flex-1">
              <button
                type="button"
                onClick={() => jump(i)}
                aria-label={`Stop ${i + 1}: ${s.name}`}
                aria-current={i === chapter ? "step" : undefined}
                className="flex h-11 w-full items-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-paper"
              >
                <span className="block h-[3px] w-full bg-paper/30">
                  <span
                    ref={(el) => {
                      fills.current[i] = el;
                    }}
                    className="block h-full w-0 bg-paper"
                  />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* What the scene shows, for people who can't see it. */}
      <p aria-live="polite" className="sr-only">
        Stop {chapter + 1} of {stops.length}. {stop.caption} {stop.says}
      </p>
    </section>
  );
}
