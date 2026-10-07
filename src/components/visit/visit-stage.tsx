"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { KioskBill, TagInfo } from "@/components/tour3d/build-store";
import type { Lights } from "@/lib/visit-status";
import type { HeroPreview } from "./store-night";

// The Visit page's stage (docs/VISIT_PAGE_PLAN.md): the hero with the 3D store at night now, then
// the Find us map (Phase 3b) and the motion between them (Phase 4). It's the only place that
// loads those on the client. The hero itself is server-rendered HTML passed in as children, so
// the status, the heading and both links work with no JavaScript at all; the 3D store is drawn
// into a slot the hero leaves for it ([data-hero-canvas]), over the poster.

const StoreNight = dynamic(() => import("./store-night"), { ssr: false });

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

export function VisitStage({ lights, switches, tour, children }: { lights: Lights; switches: StageSwitches; tour: { tag: TagInfo; bill: KioskBill }; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLSpanElement>(null);
  const [stage] = useState<Stage>("hero");
  const [mapState] = useState<MapState>("idle");
  // Until the browser has been asked, assume the full version (the server can't know).
  const [fallback, setFallback] = useState<Fallback>("none");
  /** The place in the hero where the 3D store is drawn; found once mounted. */
  const [slot, setSlot] = useState<Element | null>(null);
  const [tier, setTier] = useState<2 | 3>(3);
  /** Whether to load the 3D store at all: decided after the poster has painted and the browser is idle. */
  const [load3d, setLoad3d] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [lost, setLost] = useState(false);
  /** A new number remounts the canvas after the graphics context comes back. */
  const [life, setLife] = useState(0);
  const [onScreen, setOnScreen] = useState(true);
  const [preview, setPreview] = useState<HeroPreview>(null);

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
    // The poster is the picture until then; 3D only where it can run well.
    if (f === "nowebgl" || f === "lite") return;
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

  // Pointing at (or tabbing to, or pressing) either button previews what it does.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const which = (t: EventTarget | null): HeroPreview => {
      const a = t instanceof Element ? t.closest("[data-hero-action]") : null;
      return a ? (a.getAttribute("data-hero-action") as HeroPreview) : null;
    };
    const on = (e: Event) => setPreview(which(e.target));
    const off = (e: Event) => which(e.target) && setPreview(null);
    el.addEventListener("pointerover", on);
    el.addEventListener("pointerout", off);
    el.addEventListener("focusin", on);
    el.addEventListener("focusout", off);
    el.addEventListener("pointerdown", on);
    return () => {
      el.removeEventListener("pointerover", on);
      el.removeEventListener("pointerout", off);
      el.removeEventListener("focusin", on);
      el.removeEventListener("focusout", off);
      el.removeEventListener("pointerdown", on);
    };
  }, []);

  /** The lime pin sits above the roof wherever the camera puts it. */
  const onAnchor = useCallback((x: number, y: number) => {
    if (pin.current) pin.current.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  const show3d = load3d && !lost;
  const still = fallback === "reduced";

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
    </div>
  );
}
