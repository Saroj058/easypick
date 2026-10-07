"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { KioskBill, TagInfo } from "@/components/tour3d/build-store";
import { lengthMeters, minutes, type TravelMode } from "@/lib/map/route";
import { riseMs } from "@/lib/map/sequence";
import { FIXTURE_TILES_URL, SEEN_KEY, SEEN_MS, START_ZOOM, TILES_URL } from "@/lib/map/tiles";
import type { Lights } from "@/lib/visit-status";
import { Directions, googleMapsUrl, walkMinutes, type DirectionsData, type Snap } from "./directions";
import type { MapEntry } from "./find-us-map";
import type { HeroPreview } from "./store-night";

// The Visit page's stage (docs/VISIT_PAGE_PLAN.md): the hero with the 3D store at night, the Find
// us map, and the motion between them. It's the only place that loads those on the client. The
// hero itself is server-rendered HTML passed in as children, so the status, the heading and both
// links work with no JavaScript at all; the 3D store is drawn into a slot the hero leaves for it
// ([data-hero-canvas]), over the poster.
//
// Find us, in order: the 3D camera rises to look straight down on the roof; its last frame is
// kept as a picture and its canvas is taken away (only one WebGL context at a time); the map is
// made at the same spot and fades in over the picture; then the map plays its own sequence
// (find-us-map.tsx). Skip, a tap or a key jumps to the end at any moment.

const StoreNight = dynamic(() => import("./store-night"), { ssr: false });
const FindUsMap = dynamic(() => import("./find-us-map"), { ssr: false });

export type Stage = "hero" | "inside" | "map";
export type MapState = "idle" | "loading" | "ready" | "flying" | "drawing" | "done" | "interrupted";
export type Fallback = "none" | "reduced" | "lite" | "nowebgl";

/** Test switches, honoured only with ?preview=open or outside production (the page decides). */
export interface StageSwitches {
  motion: "normal" | "fast";
  lite: boolean;
  gl: "on" | "off";
  tiles: "live" | "fixture";
}

/** What the map and the directions need. Before opening day the page sends no pin and no start points. */
export type FindUs = DirectionsData;

const HASH = "#find-us";

type Nav = Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };

/** Save-Data, a 2G/3G connection or 2 GB of memory or less: the light version (same check as the tour). */
function wantsLite(): boolean {
  const nav = navigator as Nav;
  return Boolean(nav.connection?.saveData || /(^|-)2g|3g/.test(nav.connection?.effectiveType ?? "") || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2));
}

function hasWebGL(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext(); // only a probe: give the context back
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Phones and tablets draw at 1× with no antialiasing; everything else gets the full picture. */
const gpuTier = (): 2 | 3 => (matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 ? 2 : 3);

/** Whether this browser has watched the full sequence in the last 30 days (then it gets the short one). */
function seenBefore(): boolean {
  try {
    const at = Number(localStorage.getItem(SEEN_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SEEN_MS;
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    // private mode or blocked storage: they get the full sequence again next time
  }
}

const RUNNING: MapState[] = ["loading", "ready", "flying", "drawing"];

export function VisitStage({
  lights,
  switches,
  tour,
  find,
  children,
}: {
  lights: Lights;
  switches: StageSwitches;
  tour: { tag: TagInfo; bill: KioskBill };
  find: FindUs;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLSpanElement>(null);
  /** True while #find-us in the address was put there by this page (so Back returns to the hero). */
  const pushed = useRef(false);
  const [stage, setStage] = useState<Stage>("hero");
  const [mapState, setMapState] = useState<MapState>("idle");
  // Until the browser has been asked, assume the full version (the server can't know).
  const [fallback, setFallback] = useState<Fallback>("none");
  /** The place in the hero where the 3D store is drawn; found once mounted. */
  const [slot, setSlot] = useState<Element | null>(null);
  const [tier, setTier] = useState<2 | 3>(3);
  /** Whether to load the 3D store at all: decided after the poster has painted and the browser is idle. */
  const [load3d, setLoad3d] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [lost, setLost] = useState(false);
  /** A new number remounts the canvas after the graphics context comes back, or on the way back from the map. */
  const [life, setLife] = useState(0);
  const [onScreen, setOnScreen] = useState(true);
  const [preview, setPreview] = useState<HeroPreview>(null);
  /** Which sequence plays: decided at the tap. */
  const [entry, setEntry] = useState<MapEntry>("first");
  /** The rise's length in ms while the 3D camera is lifting; null otherwise. */
  const [rise, setRise] = useState<number | null>(null);
  /** After the rise: the 3D store is asked for its last frame, then that picture stands in for it. */
  const [leaving, setLeaving] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [replay, setReplay] = useState(0);
  const [panel, setPanel] = useState(false);
  const [lit, setLit] = useState(-1);
  /** Phones: the short bar of what matters (walk time, open or not, Google Maps), a second after the tap. */
  const [bar, setBar] = useState(false);
  const [wide, setWide] = useState(true);
  const [tall, setTall] = useState(800);
  /** Where they're coming from, how, the sheet's height on a phone, and the receipt line being looked at. */
  const [startId, setStartId] = useState<string | null>(find.starts[0]?.id ?? null);
  const [mode, setMode] = useState<TravelMode>("walk");
  const [snap, setSnap] = useState<Snap>("half");
  const [look, setLook] = useState<{ step: number; n: number } | null>(null);

  const speed = switches.motion === "fast" ? 0.1 : 1;
  const still = fallback === "reduced";
  /** The map needs WebGL; without it (or in the light version) Find us is a plain link to the section below. */
  const canMap = fallback === "none" || fallback === "reduced";
  const playing = rise !== null || leaving || (stage === "map" && RUNNING.includes(mapState));

  useEffect(() => {
    const decide = (): Fallback => {
      if (switches.gl === "off" || !hasWebGL()) return "nowebgl";
      if (switches.lite || wantsLite()) return "lite";
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced";
      return "none";
    };
    const f = decide();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device can only be read once mounted
    setFallback(f);
    setTier(gpuTier());
    setWide(window.innerWidth >= 768);
    setTall(window.innerHeight);
    setSlot(root.current?.querySelector("[data-hero-canvas]") ?? null);
    if (f === "nowebgl" || f === "lite") return;
    // Opened on /visit#find-us (a QR code, a link from Instagram): straight to the map, no 3D first.
    if (location.hash === HASH) {
      setEntry(f === "reduced" ? "instant" : find.pin ? "deeplink" : "soon");
      setStage("map");
      setBar(true);
      return;
    }
    // The poster is the picture until then; 3D only where it can run well.
    const win = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };
    const go = () => setLoad3d(true);
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(go, { timeout: 2500 });
      return () => win.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(go, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once on arrival
  }, [switches.gl, switches.lite]);

  useEffect(() => {
    const onResize = () => {
      setWide(window.innerWidth >= 768);
      setTall(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Nothing is drawn while the hero is off screen or the tab is in the background.
  useEffect(() => {
    if (!slot) return;
    let seen = true;
    const update = () => setOnScreen(seen && !document.hidden);
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      update();
    });
    io.observe(slot);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [slot]);

  /** Hero → map. With the 3D store on screen the camera rises first; then its last frame is taken and its canvas goes before the map is made. */
  const toMap = useCallback(() => {
    if (location.hash !== HASH) {
      history.pushState(null, "", HASH);
      pushed.current = true;
    }
    const mode: MapEntry = still ? "instant" : !find.pin ? "soon" : seenBefore() ? "repeat" : "first";
    setEntry(mode);
    setPreview(null);
    setPanel(false);
    setLit(-1);
    setBar(false);
    setSnap("half");
    const with3d = load3d && drawn && !lost;
    if (with3d && mode !== "instant") setRise(riseMs(mode === "repeat" ? "repeat" : mode === "soon" ? "soon" : "first", speed));
    else if (with3d) setLeaving(true);
    else setStage("map");
  }, [still, find.pin, load3d, drawn, lost, speed]);

  // The phone bar: on screen about a second after the tap, whatever the map is doing.
  useEffect(() => {
    if (bar || !(rise !== null || leaving || stage === "map")) return;
    const t = setTimeout(() => setBar(true), entry === "instant" ? 0 : 1000 * speed);
    return () => clearTimeout(t);
  }, [bar, rise, leaving, stage, entry, speed]);

  const onRisen = useCallback(() => {
    setRise(null);
    setLeaving(true);
  }, []);

  const onCapture = useCallback((dataUrl: string) => {
    setFrame(dataUrl);
    setLeaving(false);
    setStage("map");
  }, []);

  /** Map → hero: the map is removed, then the 3D store is made again. */
  const toHero = useCallback(() => {
    setStage("hero");
    setMapState("idle");
    setFrame(null);
    setRise(null);
    setLeaving(false);
    setPanel(false);
    setBar(false);
    setLit(-1);
    setDrawn(false);
    setLost(false);
    setLoad3d(true);
    setLife((n) => n + 1);
  }, []);

  /** The way out of the map: Back if this page put #find-us in the address, else just drop it (a direct link has nowhere to go back to). */
  const leaveMap = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      history.back();
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      toHero();
    }
  }, [toHero]);

  /** Skip: jump to the finished picture, from wherever the sequence is. */
  const skipNow = useCallback(() => {
    if (rise !== null) {
      // Still in 3D: no more rising, and the map opens finished.
      setEntry("instant");
      setRise(0);
    } else if (stage !== "map" || mapState === "idle" || mapState === "loading") setEntry("instant");
    setSkip((n) => n + 1);
  }, [rise, stage, mapState]);

  // Back and forward follow the address: #find-us is the map, anything else is the hero.
  useEffect(() => {
    if (!canMap) return;
    const sync = () => {
      if (location.hash === HASH) {
        if (stage !== "map" && rise === null && !leaving) toMap();
      } else if (stage === "map" || rise !== null || leaving) {
        pushed.current = false;
        toHero();
      }
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [canMap, stage, rise, leaving, toHero, toMap]);

  // While the sequence plays, Space, Enter or Escape finish it; afterwards Escape goes back to the store.
  // The page behind the map doesn't scroll.
  useEffect(() => {
    if (!(stage === "map" || rise !== null || leaving)) return;
    const before = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (playing && (e.key === " " || e.key === "Enter" || e.key === "Escape")) {
        // A focused button or link keeps its own Enter and Space.
        if (e.key !== "Escape" && e.target instanceof Element && e.target.closest("button, a")) return;
        e.preventDefault();
        skipNow();
      } else if (e.key === "Escape") leaveMap();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [stage, rise, leaving, playing, skipNow, leaveMap]);

  // Once someone has watched it through, the next visit gets the shorter sequence.
  useEffect(() => {
    if (mapState === "done" && (entry === "first" || entry === "repeat")) markSeen();
  }, [mapState, entry]);

  // Pointing at (or tabbing to, or pressing) either button previews what it does; Find us opens the map.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const which = (t: EventTarget | null): HeroPreview => {
      const a = t instanceof Element ? t.closest("[data-hero-action]") : null;
      return a ? (a.getAttribute("data-hero-action") as HeroPreview) : null;
    };
    const on = (e: Event) => setPreview(which(e.target));
    const off = (e: Event) => which(e.target) && setPreview(null);
    const click = (e: MouseEvent) => {
      if (which(e.target) !== "find" || !canMap || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      toMap();
    };
    el.addEventListener("pointerover", on);
    el.addEventListener("pointerout", off);
    el.addEventListener("focusin", on);
    el.addEventListener("focusout", off);
    el.addEventListener("pointerdown", on);
    el.addEventListener("click", click);
    return () => {
      el.removeEventListener("pointerover", on);
      el.removeEventListener("pointerout", off);
      el.removeEventListener("focusin", on);
      el.removeEventListener("focusout", off);
      el.removeEventListener("pointerdown", on);
      el.removeEventListener("click", click);
    };
  }, [canMap, toMap]);

  /** The lime pin sits above the roof wherever the camera puts it. */
  const onAnchor = useCallback((x: number, y: number) => {
    if (pin.current) pin.current.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  const show3d = load3d && !lost && stage === "hero";
  const tilesUrl = switches.tiles === "fixture" ? FIXTURE_TILES_URL : TILES_URL;
  const start = find.starts.find((s) => s.id === startId) ?? find.starts[0] ?? null;
  const steps = start ? start.steps : find.steps;
  const mapsUrl = find.pin ? googleMapsUrl(find.pin, mode) : null;
  const mapLabel = start ? `Map: route from ${start.name} to Easypick` : find.pin ? "Map: where Easypick is" : "Map: the area Easypick is opening in";
  const mapShown = stage === "map" && mapState !== "idle" && mapState !== "loading";
  const walk = start ? minutes(lengthMeters(start.coords), "walk") : walkMinutes(steps);
  /** The room the panel takes, so the map keeps the route clear of it. */
  const inset = wide ? { right: 384, bottom: 0 } : { right: 0, bottom: Math.min(Math.round(tall * 0.5), Math.max(0, tall - 330)) };
  const fade = still ? "duration-150" : speed < 1 ? "duration-[40ms]" : "duration-[240ms]";

  return (
    <div
      ref={root}
      data-stage={stage}
      data-map-state={mapState}
      data-lights={lights}
      data-fallback={fallback}
      data-motion={switches.motion}
      data-tiles={switches.tiles}
      data-3d={show3d && drawn ? "on" : "off"}
      data-entry={stage === "map" || rise !== null ? entry : undefined}
      // During the rise the hero's words step aside (visit-hero.tsx), so only the store and the pin are on screen.
      data-rising={rise !== null || leaving ? "true" : undefined}
    >
      {children}
      {slot &&
        show3d &&
        createPortal(
          <div className={`absolute inset-0 transition-opacity duration-700 ${drawn ? "opacity-100" : "opacity-0"}`}>
            <StoreNight
              key={life}
              lights={lights}
              preview={preview}
              tier={tier}
              still={still}
              active={onScreen}
              tag={tour.tag}
              bill={tour.bill}
              onReady={() => setDrawn(true)}
              onLost={() => {
                setLost(true);
                setDrawn(false);
              }}
              onRestored={() => {
                setLost(false);
                setLife((n) => n + 1);
              }}
              onAnchor={onAnchor}
              rise={rise}
              riseZoom={START_ZOOM}
              onRisen={onRisen}
              capture={leaving}
              onCapture={onCapture}
            />
            {/* The pin above the roof: it drops in when Find us is pointed at and stays through the rise, where the map's own pin takes its place. */}
            <span ref={pin} aria-hidden data-pin className="pointer-events-none absolute left-0 top-0 block">
              <span
                className={`block h-4 w-4 -translate-x-1/2 rounded-full border-2 border-ink bg-volt shadow-[0_0_0_4px_rgba(198,255,61,0.25)] transition-[opacity,translate] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  still ? "duration-0" : "duration-[280ms]"
                } ${preview === "find" || rise !== null || leaving ? "translate-y-[-8px] opacity-100" : "translate-y-[-34px] opacity-0"}`}
              />
            </span>
          </div>,
          slot,
        )}

      {/* The map, over the whole window. The 3D store's last frame sits under it until the map has drawn (and drifts back a little, so the screen is never still or blank while it loads). */}
      {stage === "map" && (
        <div data-find-us className="on-dark fixed inset-0 z-[70] overflow-hidden bg-[#0B0C0D] text-paper">
          {/* eslint-disable-next-line @next/next/no-img-element -- a frame of the 3D store, handed over as a data URL */}
          {frame && <img src={frame} alt="" aria-hidden className={`find-rise-hold absolute inset-0 h-full w-full object-cover transition-opacity ${fade} ${mapShown ? "opacity-0" : "opacity-100"}`} />}
          <div className={`absolute inset-0 transition-opacity ${fade} ${mapShown ? "opacity-100" : "opacity-0"}`}>
            <FindUsMap
              tilesUrl={tilesUrl}
              pin={find.pin}
              route={start ? start.coords : null}
              steps={steps}
              label={mapLabel}
              entry={entry}
              speed={speed}
              tier={tier}
              skip={skip}
              replay={replay}
              inset={inset}
              look={look}
              parking={find.parkingSpots}
              onState={setMapState}
              onStep={setLit}
              onPanel={setPanel}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4 pb-12 md:p-8 md:pb-16">
            <button type="button" onClick={leaveMap} hidden={!wide && panel && snap !== "peek"} className="pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-paper/40 bg-black/50 px-4 text-[13px] font-semibold uppercase tracking-[0.06em] backdrop-blur">
              <span aria-hidden>←</span> The store
            </button>
            <h2 className={`display text-[40px] leading-[0.9] transition-opacity duration-[400ms] md:text-[64px] ${panel && wide ? "opacity-0" : "opacity-100"}`}>Find us.</h2>
          </div>

          <Directions
            data={find}
            startId={startId}
            mode={mode}
            lit={lit}
            open={panel}
            still={still}
            wide={wide}
            snap={snap}
            onSnap={setSnap}
            onStart={(id) => {
              // The map retracts the old line and draws the new one (the "chip" sequence).
              setLit(-1);
              setStartId(id);
            }}
            onMode={setMode}
            onLook={(step) => {
              // On a phone the sheet steps down so the spot can be seen.
              if (!wide && snap === "full") setSnap("half");
              setLook((l) => ({ step, n: (l?.n ?? 0) + 1 }));
            }}
            onReplay={() => {
              setPanel(false);
              setLit(-1);
              setReplay((n) => n + 1);
            }}
            onLeave={leaveMap}
          />

          {/* Phones: what matters, a second after the tap, until the full panel is in. */}
          {bar && !panel && (
            <div data-find-bar className="absolute inset-x-0 bottom-0 z-10 flex h-16 items-center justify-between gap-3 bg-paper px-4 font-mono text-[12px] font-semibold tracking-[0.06em] text-ink md:hidden">
              <span className="min-w-0 truncate">
                {walk !== null && !find.soon ? `${walk} MIN WALK · ` : ""}
                {find.status}
              </span>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener" className="flex h-11 shrink-0 items-center underline underline-offset-4">
                  Google Maps
                </a>
              )}
            </div>
          )}

          <a href="#find-h" onClick={leaveMap} className="sr-only focus:not-sr-only focus:absolute focus:bottom-20 focus:left-4 focus:z-20 focus:bg-paper focus:px-4 focus:py-3 focus:text-ink">
            Skip map, read directions
          </a>
          <p aria-live="polite" className="sr-only">
            {mapState === "done" || mapState === "interrupted" ? (find.soon ? "The map shows the area Easypick is opening in." : `The route is on the map${walk !== null ? `: about ${walk} minutes on foot` : ""}.`) : ""}
          </p>
        </div>
      )}

      {/* Skip: there from the first moment, through the rise and the map's sequence. */}
      {playing && (
        <button type="button" data-skip onClick={skipNow} className="on-dark fixed bottom-20 right-4 z-[80] flex h-11 items-center gap-1 rounded-full border border-paper/40 bg-black/60 px-5 text-[13px] font-semibold uppercase tracking-[0.06em] text-paper backdrop-blur md:bottom-6 md:right-6">
          Skip <span aria-hidden>›</span>
        </button>
      )}
    </div>
  );
}
