"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { KioskBill, TagInfo } from "@/components/tour3d/build-store";
import type { LngLat } from "@/lib/map/route";
import { FIXTURE_TILES_URL, TILES_URL } from "@/lib/map/tiles";
import type { Lights } from "@/lib/visit-status";
import type { HeroPreview } from "./store-night";

// The Visit page's stage (docs/VISIT_PAGE_PLAN.md): the hero with the 3D store at night, the Find
// us map, and (from Phase 4) the motion between them. It's the only place that loads those on the
// client. The hero itself is server-rendered HTML passed in as children, so the status, the
// heading and both links work with no JavaScript at all; the 3D store is drawn into a slot the
// hero leaves for it ([data-hero-canvas]), over the poster.
//
// Only one WebGL context exists at a time: going to the map, the 3D store hands over its last
// frame as a picture, its canvas is taken away, and only then is the map made.

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

/** What the map needs. Before opening day the page sends no pin and no route. */
export interface FindUs {
  pin: { lat: number; lng: number } | null;
  route: LngLat[] | null;
  /** Where the route starts, for the map's label: "Jhamsikhel Chowk". */
  from: string | null;
}

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
  /** On the way to the map: the 3D store is asked for its last frame, then that picture stands in for it. */
  const [leaving, setLeaving] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);

  /** The map needs WebGL; without it (or in the light version) Find us is a plain link to the section below. */
  const canMap = fallback === "none" || fallback === "reduced";

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
    setSlot(root.current?.querySelector("[data-hero-canvas]") ?? null);
    if (f === "nowebgl" || f === "lite") return;
    // Opened on /visit#find-us (a QR code, a link from Instagram): straight to the map, no 3D first.
    if (location.hash === HASH) {
      setStage("map");
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
  }, [switches.gl, switches.lite]);

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

  /** Hero → map. With the 3D store on screen, its last frame is taken first and its canvas goes before the map is made. */
  const toMap = useCallback(() => {
    if (location.hash !== HASH) {
      history.pushState(null, "", HASH);
      pushed.current = true;
    }
    setPreview(null);
    if (load3d && drawn && !lost) setLeaving(true);
    else setStage("map");
  }, [load3d, drawn, lost]);

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

  // Back and forward follow the address: #find-us is the map, anything else is the hero.
  useEffect(() => {
    if (!canMap) return;
    const sync = () => {
      if (location.hash === HASH) setStage((s) => (s === "map" ? s : "map"));
      else if (stage === "map") {
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
  }, [canMap, stage, toHero]);

  // The page behind the map doesn't scroll; Escape goes back to the store.
  useEffect(() => {
    if (stage !== "map") return;
    const before = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && leaveMap();
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [stage, leaveMap]);

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
  const still = fallback === "reduced";
  const tilesUrl = switches.tiles === "fixture" ? FIXTURE_TILES_URL : TILES_URL;
  const mapLabel = find.from ? `Map: route from ${find.from} to Easypick` : "Map: where Easypick is";

  return (
    <div ref={root} data-stage={stage} data-map-state={mapState} data-lights={lights} data-fallback={fallback} data-motion={switches.motion} data-tiles={switches.tiles} data-3d={show3d && drawn ? "on" : "off"}>
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
              capture={leaving}
              onCapture={onCapture}
            />
            {/* The pin above the roof: it drops in when Find us is pointed at. One element, so it can stay put when the map takes over (Phase 4). */}
            <span ref={pin} aria-hidden data-pin className="pointer-events-none absolute left-0 top-0 block">
              <span
                className={`block h-4 w-4 -translate-x-1/2 rounded-full border-2 border-ink bg-volt shadow-[0_0_0_4px_rgba(198,255,61,0.25)] transition-[opacity,translate] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                  still ? "duration-0" : "duration-[280ms]"
                } ${preview === "find" ? "translate-y-[-8px] opacity-100" : "translate-y-[-34px] opacity-0"}`}
              />
            </span>
          </div>,
          slot,
        )}

      {/* The map, over the whole window. The 3D store's last frame sits under it until the map has drawn. */}
      {stage === "map" && (
        <div data-find-us className="on-dark fixed inset-0 z-[70] bg-[#0B0C0D] text-paper">
          {/* eslint-disable-next-line @next/next/no-img-element -- a frame of the 3D store, handed over as a data URL */}
          {frame && <img src={frame} alt="" aria-hidden className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${mapState === "idle" || mapState === "loading" ? "opacity-100" : "opacity-0"}`} />}
          <div className={`absolute inset-0 transition-opacity duration-300 ${mapState === "idle" || mapState === "loading" ? "opacity-0" : "opacity-100"}`}>
            <FindUsMap tilesUrl={tilesUrl} pin={find.pin} route={find.route} label={mapLabel} onState={setMapState} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4 pb-12 md:p-8 md:pb-16">
            <button type="button" onClick={leaveMap} className="pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-paper/40 bg-black/50 px-4 text-[13px] font-semibold uppercase tracking-[0.06em] backdrop-blur">
              <span aria-hidden>←</span> The store
            </button>
            <h2 className="display text-[40px] leading-[0.9] md:text-[64px]">Find us.</h2>
          </div>
          <a href="#find-h" onClick={leaveMap} className="sr-only focus:not-sr-only focus:absolute focus:bottom-4 focus:left-4 focus:z-10 focus:bg-paper focus:px-4 focus:py-3 focus:text-ink">
            Skip map, read directions
          </a>
        </div>
      )}
    </div>
  );
}
