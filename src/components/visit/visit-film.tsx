"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AlertSignup } from "@/components/alert-signup";
import { kathmanduClock, subsolarPoint } from "@/lib/kathmandu-sky";
import { distance, lengthMeters, minutes, type LngLat, type TravelMode } from "@/lib/map/route";
import { FIXTURE_TILES_URL, STATIC_ROUTE, TILES_URL, TOUR_ENTER_URL, VALLEY } from "@/lib/map/tiles";
import { altitudeLabel, altitudeMetres, cloudAt, FILM_SECONDS, HANDOVER, KATHMANDU, planFilm, sceneAt, SCENES, sceneStart, type SceneId } from "@/lib/visit/film";
import { Directions, googleMapsUrl, walkMinutes, type DirectionsData, type Locate, type Snap } from "./directions";

// The Visit page: one film, and the page's scroll is its clock. It opens on the Earth from orbit,
// lit as it really is at this moment, with two ways to visit: In person and the Virtual tour.
// Scrolling (or pressing In person, which scrolls for you) falls towards Nepal, through the
// clouds, into Kathmandu as a tilted city at night, along the route in lime, to the door, and
// ends on the directions. Scrolling back up runs it backwards. Every position of everything is a
// pure function of the film's second (lib/visit/film.ts); this component turns scroll into that
// second and hands it to the two pictures (earth.tsx above the clouds, descent-map.tsx below).
//
// Without WebGL, or on a data-saver or low-memory phone, there is no film: the first screen is a
// still, and In person opens the same directions over a still of the route.

const Earth = dynamic(() => import("./earth"), { ssr: false });
const DescentMap = dynamic(() => import("./descent-map"), { ssr: false });

export type Fallback = "none" | "reduced" | "lite" | "nowebgl";

/** Test switches, honoured only with ?preview=open or outside production (the page decides). */
export interface FilmSwitches {
  motion: "normal" | "fast";
  lite: boolean;
  gl: "on" | "off";
  tiles: "live" | "fixture";
  /** Open on this second of the film. */
  at: number | null;
}

const HASH = "#find-us";
/** How many screens of scroll the film is. */
const SCREENS = 9;
/** Playing by itself, the film runs a little faster than its own clock. */
const PLAY_RATE = 1.5;

type Nav = Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };

/** Save-Data, a 2G/3G connection or 2 GB of memory or less: the light version. */
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

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+_<>";

/** A line of type that resolves out of noise when it changes, like a read-out locking on. */
function Decode({ text, still }: { text: string; still: boolean }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (still) {
      node.textContent = text;
      return;
    }
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 520);
      const fixed = Math.floor(p * text.length);
      node.textContent = text
        .split("")
        .map((ch, i) => (i < fixed || ch === " " || ch === "." ? ch : GLYPHS[(i * 7 + Math.floor(now / 40)) % GLYPHS.length]))
        .join("");
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, still]);
  return (
    <span ref={el} aria-hidden>
      {text}
    </span>
  );
}

export function VisitFilm({
  switches,
  find,
  sun: sunAtLoad,
  clock,
  liveClock,
  daylight,
  status,
  short,
  open,
  personal,
  hoursToday,
}: {
  switches: FilmSwitches;
  /** What the map and the directions need. Before opening day there is no pin and no start point. */
  find: DirectionsData;
  /** Where the sun is overhead as the page is made. */
  sun: { lat: number; lng: number };
  /** "19:42" in Kathmandu as the page is made; kept running here. */
  clock: string;
  /** False when the clock is pinned (tests, demos): the sun and the time stay put. */
  liveClock: boolean;
  /** True while it's day in Kathmandu: picks the still that stands in for the Earth. */
  daylight: boolean;
  /** The whole status for screen readers, and the few words shown. */
  status: string;
  short: string;
  /** Lights on: open, or drop day. */
  open: boolean;
  personal: string | null;
  /** Today's hours in a few words, for the page without JavaScript. */
  hoursToday: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const earthBox = useRef<HTMLDivElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const altEl = useRef<HTMLSpanElement>(null);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  /** The film's second: where scroll points, and where the picture is (easing towards it). */
  const film = useRef({ target: 0, shown: 0 });
  /** The page scrolling itself, until the visitor takes over. */
  const auto = useRef({ on: false, y: 0 });
  const mapReady = useRef(false);
  /** The second to open on (a direct link to the directions, or a test), once the page is tall enough to scroll there. */
  const opening = useRef<number | null>(null);

  const [fallback, setFallback] = useState<Fallback>("none");
  const [decided, setDecided] = useState(false);
  const [tier, setTier] = useState<2 | 3>(3);
  const [wide, setWide] = useState(true);
  const [tall, setTall] = useState(800);
  const [sun, setSun] = useState(sunAtLoad);
  const [loaded, setLoaded] = useState(0);
  const [earthOn, setEarthOn] = useState(false);
  const [earthLost, setEarthLost] = useState(false);
  const [wantMap, setWantMap] = useState(false);
  const [mapOn, setMapOn] = useState(false);
  const [mapLost, setMapLost] = useState(false);
  const [scene, setScene] = useState<SceneId>("orbit");
  const [caption, setCaption] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [lit, setLit] = useState(-1);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** In person with no film: the directions over a still. */
  const [plain, setPlain] = useState(false);
  const [startId, setStartId] = useState<string | null>(find.starts[0]?.id ?? null);
  const [mode, setMode] = useState<TravelMode>("walk");
  const [snap, setSnap] = useState<Snap>("half");
  const [look, setLook] = useState<{ step: number; n: number } | null>(null);
  /** The visitor's spot lives here and nowhere else (not the address, storage, the server or analytics). */
  const [locate, setLocate] = useState<Locate>("off");
  const [me, setMe] = useState<LngLat | null>(null);

  const still = fallback === "reduced";
  const canFilm = decided && (fallback === "none" || fallback === "reduced") && !earthLost && !mapLost;
  const start = find.starts.find((s) => s.id === startId) ?? find.starts[0] ?? null;
  const steps = start ? start.steps : find.steps;
  const here: LngLat = useMemo(() => (find.pin ? [find.pin.lng, find.pin.lat] : [KATHMANDU.lng, KATHMANDU.lat]), [find.pin]);
  const plan = useMemo(
    () => planFilm({ pin: here, valley: [(VALLEY[0][0] + VALLEY[1][0]) / 2, (VALLEY[0][1] + VALLEY[1][1]) / 2], route: start ? start.coords : null, steps, area: find.area, hasDoor: Boolean(find.pin) }),
    [here, start, steps, find.area, find.pin],
  );
  const planRef = useRef(plan);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  /** How far the page can scroll through the film, in pixels. */
  const reach = useCallback(() => Math.max(1, (root.current?.offsetHeight ?? 0) - window.innerHeight), []);
  const scrollToSecond = useCallback(
    (t: number, smooth: boolean) => {
      const top = (root.current?.offsetTop ?? 0) + (Math.min(FILM_SECONDS, Math.max(0, t)) / FILM_SECONDS) * reach();
      window.scrollTo({ top, behavior: smooth ? "smooth" : "instant" });
    },
    [reach],
  );

  // What this device gets, decided after the first paint (asking for a WebGL context can take a moment).
  useEffect(() => {
    let later = 0;
    const frame = requestAnimationFrame(() => {
      later = window.setTimeout(() => {
        const f: Fallback = switches.gl === "off" ? "nowebgl" : switches.lite || wantsLite() ? "lite" : !hasWebGL() ? "nowebgl" : matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "none";
        setFallback(f);
        setTier(matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 ? 2 : 3);
        setWide(window.innerWidth >= 768);
        setTall(window.innerHeight);
        setDecided(true);
        const policy = (document as Document & { featurePolicy?: { allowsFeature(name: string): boolean } }).featurePolicy;
        if (find.pin && "geolocation" in navigator && policy?.allowsFeature("geolocation") !== false) setLocate("idle");
        const plainOnly = f === "lite" || f === "nowebgl";
        // Opened on /visit#find-us (a QR code, a link): straight to the directions.
        if (location.hash === HASH) {
          if (plainOnly) setPlain(true);
          else opening.current = FILM_SECONDS;
        } else if (switches.at !== null && !plainOnly) opening.current = switches.at;
        if (opening.current !== null) {
          setWantMap(true);
          setStarted(true);
        }
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(later);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once on arrival
  }, []);

  useEffect(() => {
    const onResize = () => {
      setWide(window.innerWidth >= 768);
      setTall(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Kathmandu's clock and the sun keep time while the page is open.
  useEffect(() => {
    if (!liveClock) return;
    const tick = () => {
      const now = new Date();
      const s = subsolarPoint(now);
      setSun((was) => (Math.abs(was.lng - s.lng) > 0.2 ? s : was));
      root.current?.querySelectorAll("[data-ktm-clock]").forEach((el) => (el.textContent = kathmanduClock(now)));
    };
    tick();
    const timer = setInterval(tick, 20_000);
    return () => clearInterval(timer);
  }, [liveClock]);

  const stopAuto = useCallback(() => {
    if (!auto.current.on) return;
    auto.current.on = false;
    setPlaying(false);
  }, []);

  /** Where the visitor is: one coarse reading, asked for only by a tap. The route then starts from the start point nearest them. */
  const askWhere = (quiet: boolean) => {
    setLocate("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at: LngLat = [pos.coords.longitude, pos.coords.latitude];
        setMe(at);
        setLocate("shown");
        const near = find.starts.reduce<{ id: string; d: number } | null>((best, s) => {
          const d = distance(at, s.coords[0]);
          return !best || d < best.d ? { id: s.id, d } : best;
        }, null);
        if (near && near.d < 60_000) setStartId(near.id);
      },
      () => setLocate(quiet ? "idle" : "failed"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  /** In person: the film plays itself from wherever it is (from the top, if it had ended). */
  const play = () => {
    if (!canFilm) {
      setPlain(true);
      return;
    }
    setWantMap(true);
    setStarted(true);
    if (locate === "idle") askWhere(true);
    if (still) {
      // Reduced motion: no flight, straight to the end.
      scrollToSecond(FILM_SECONDS, false);
      return;
    }
    const top = root.current?.offsetTop ?? 0;
    if (window.scrollY - top >= reach() - 2) scrollToSecond(0, false);
    auto.current = { on: true, y: Math.max(top, window.scrollY) };
    setPlaying(true);
  };

  const toTop = useCallback(() => {
    stopAuto();
    setPlain(false);
    scrollToSecond(0, !still);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>("[data-action=in-person]")?.focus({ preventScroll: true }));
  }, [scrollToSecond, still, stopAuto]);

  // Opened part-way through: go there as soon as the film's scroll length exists.
  useEffect(() => {
    if (!canFilm || opening.current === null) return;
    const t = opening.current;
    opening.current = null;
    scrollToSecond(t, false);
    film.current.shown = t;
  }, [canFilm, scrollToSecond]);

  // The film's clock: scroll decides where it should be; each frame it eases there, and the
  // pictures and the words follow. Only what changes by the scene touches React.
  useEffect(() => {
    if (!canFilm) return;
    let frame = 0;
    let last = performance.now();
    const seen = { scene: "" as string, caption: "" as string | null, panel: false, step: -2 };
    const speed = switches.motion === "fast" ? 8 : 1;
    const read = () => {
      const top = root.current?.offsetTop ?? 0;
      film.current.target = Math.min(1, Math.max(0, (window.scrollY - top) / reach())) * FILM_SECONDS;
    };
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const f = film.current;
      const a = auto.current;
      if (a.on) {
        const top = root.current?.offsetTop ?? 0;
        const max = top + reach();
        // In the thick of the cloud it waits for the city to be drawn, then carries on.
        const waiting = f.target >= HANDOVER - 0.15 && f.target < HANDOVER + 0.4 && !mapReady.current;
        if (!waiting) a.y = Math.min(max, a.y + ((dt * reach()) / FILM_SECONDS) * PLAY_RATE * speed);
        window.scrollTo({ top: a.y, behavior: "instant" });
        if (a.y >= max) stopAuto();
      }
      read();
      const gap = f.target - f.shown;
      f.shown = still || Math.abs(gap) < 0.002 ? f.target : f.shown + gap * (1 - Math.exp(-dt * 6 * speed));
      const t = f.shown;

      // The cloud, and which picture is under it.
      const below = t >= HANDOVER;
      const cloud = below && !mapReady.current ? 1 : cloudAt(t);
      if (veil.current) veil.current.style.opacity = String(cloud);
      if (earthBox.current) earthBox.current.style.opacity = below ? "0" : "1";
      if (mapBox.current) mapBox.current.style.opacity = below ? "1" : "0";

      const fr = planRef.current.frame(t);
      if (altEl.current) altEl.current.textContent = altitudeLabel(altitudeMetres(t, fr.map.zoom, fr.map.center[1]));
      SCENES.forEach((s, i) => {
        const el = fills.current[i];
        if (!el) return;
        const end = SCENES[i + 1]?.from ?? FILM_SECONDS;
        el.style.transform = `scaleY(${Math.min(1, Math.max(0, (t - s.from) / (end - s.from)))})`;
      });
      if (fr.scene !== seen.scene) {
        seen.scene = fr.scene;
        setScene(fr.scene);
        if (t > 0.6) {
          setWantMap(true);
          setStarted(true);
        }
      }
      if (fr.caption !== seen.caption) {
        seen.caption = fr.caption;
        setCaption(fr.caption);
      }
      if (fr.panel !== seen.panel) {
        seen.panel = fr.panel;
        setPanel(fr.panel);
      }
      if (fr.step !== seen.step) {
        seen.step = fr.step;
        setLit(fr.step);
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [canFilm, reach, still, stopAuto, switches.motion]);

  // The moment the visitor scrolls for themselves, the page stops scrolling by itself.
  useEffect(() => {
    const onControl = (e: Event) => !(e.target instanceof Element && e.target.closest("button, a, [data-panel]")) && stopAuto();
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) onControl(e);
      if (e.key === "Escape" && (film.current.target > 0.5 || plain)) toTop();
    };
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
  }, [stopAuto, toTop, plain]);

  const time = useCallback(() => film.current.shown, []);
  const away = me && find.pin ? distance(me, [find.pin.lng, find.pin.lat]) : null;
  const tilesUrl = switches.tiles === "fixture" ? FIXTURE_TILES_URL : TILES_URL;
  const mapsUrl = find.pin ? googleMapsUrl(find.pin, mode) : null;
  const walk = start ? minutes(lengthMeters(start.coords), "walk") : walkMinutes(steps);
  const mapLabel = start ? `Map: route from ${start.name} to Easypick` : find.pin ? "Map: where Easypick is" : "Map: the area Easypick is opening in";
  const inset = wide ? { right: 384, bottom: 0 } : { right: 0, bottom: Math.min(Math.round(tall * 0.5), Math.max(0, tall - 330)) };
  const staticRoute = Boolean(find.pin && Math.abs(find.pin.lat - STATIC_ROUTE.pin.lat) < 0.0005 && Math.abs(find.pin.lng - STATIC_ROUTE.pin.lng) < 0.0005);
  const inFilm = canFilm && started && scene !== "orbit";
  const atEnd = scene === "arrive" && panel;
  const sceneIndex = SCENES.findIndex((s) => s.id === scene);
  const still3d = `/visit/earth-${daylight ? "day" : "night"}`;
  const pill = "flex h-14 items-center justify-center gap-3 rounded-full px-7 text-[14px] font-semibold uppercase tracking-[0.08em] transition-transform duration-150 active:scale-[0.98]";

  return (
    <div
      ref={root}
      data-film={canFilm ? "on" : "off"}
      data-fallback={fallback}
      data-scene={scene}
      data-earth={earthOn ? "on" : "off"}
      data-map-state={!wantMap ? "idle" : mapOn ? (atEnd ? "done" : "ready") : "loading"}
      data-playing={playing}
      data-motion={switches.motion}
      data-tiles={switches.tiles}
      className="on-dark relative bg-[#020308] text-paper"
      style={{ height: canFilm ? `${SCREENS * 100}svh` : undefined }}
    >
      <div className={`${canFilm ? "sticky top-0" : "relative"} h-svh min-h-[540px] overflow-hidden`}>
        {/* A still of the Earth: what's on screen before (and without) the live one. */}
        <picture>
          <source media="(max-aspect-ratio: 4/5)" srcSet={`${still3d}-tall.avif`} />
          {/* eslint-disable-next-line @next/next/no-img-element -- the LCP image, sized and compressed by hand */}
          <img src={`${still3d}.avif`} alt="The Earth from orbit, with South Asia in view" width={1656} height={1104} fetchPriority="high" draggable={false} data-poster className={`absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-700 ${earthOn ? "opacity-0" : "opacity-100"}`} />
        </picture>

        {canFilm && (
          <div ref={earthBox} className={`absolute inset-0 transition-opacity duration-700 ${earthOn ? "" : "!opacity-0"}`}>
            <Earth time={time} sun={sun} active={scene === "orbit" || scene === "approach" || scene === "clouds"} tier={tier} still={still} onProgress={setLoaded} onReady={() => setEarthOn(true)} onLost={() => setEarthLost(true)} />
          </div>
        )}
        {canFilm && wantMap && (
          <div ref={mapBox} data-map-box className="absolute inset-0 bg-[#0B0C0D] opacity-0" style={{ pointerEvents: atEnd ? "auto" : "none" }}>
            <DescentMap
              tilesUrl={tilesUrl}
              pin={find.pin}
              route={start ? start.coords : null}
              plan={plan}
              time={time}
              label={mapLabel}
              inset={inset}
              look={look}
              steps={steps}
              parking={find.parkingSpots}
              me={away !== null && away < 60_000 ? me : null}
              tier={tier}
              onReady={() => {
                mapReady.current = true;
                setMapOn(true);
              }}
              onLost={() => setMapLost(true)}
            />
          </div>
        )}
        {/* The cloud between the two worlds: it thickens as the camera reaches it and clears over the city. */}
        <div ref={veil} aria-hidden className="visit-cloud pointer-events-none absolute inset-0 opacity-0" />
        {/* The finish over every picture: a little grain, darker corners, and shade under the words. */}
        <div className="visit-grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" aria-hidden />
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent via-45% to-black/80 transition-opacity duration-500 ${atEnd ? "opacity-0" : "opacity-100"}`} aria-hidden />

        {/* The read-out: the hour in Kathmandu, and how high the camera is. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+74px)] md:justify-end md:px-10 md:pt-9">
          <p className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper/80 md:text-[11px]">
            <span>
              <span className="text-paper/50">Kathmandu</span> <span data-ktm-clock className="tabular-nums">{clock}</span>
            </span>
            {inFilm && !atEnd && (
              <span className="tabular-nums">
                <span className="text-paper/50">Alt</span> <span ref={altEl} data-altitude />
              </span>
            )}
            {canFilm && !earthOn && loaded < 1 && <span className="tabular-nums text-paper/60">Loading {Math.round(loaded * 100)}%</span>}
          </p>
        </div>

        {/* The first screen: the headline and the two ways to visit. It steps aside once the film is under way. */}
        <div className={`absolute inset-x-0 bottom-0 transition-[opacity,translate] duration-500 ${inFilm ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100"}`} inert={inFilm}>
          <div className="container-ep pb-[max(22px,calc(env(safe-area-inset-bottom)+16px))] md:pb-14">
            <h1 id="visit-h" className="sr-only">
              Visit Easypick
            </h1>
            <p className="sr-only" data-status-line>
              {status}
            </p>
            {personal && <p className="mb-4 font-mono text-[12px] tracking-[0.1em] text-paper">{personal}</p>}
            <p className="visit-in flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-paper/80 [animation-delay:120ms] md:text-[11px]" data-status>
              {!find.soon && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${open ? "bg-volt" : "border border-paper/80"}`} />}
              {short} <span className="text-paper/45">·</span> {find.area}
            </p>
            <p aria-hidden className="visit-in display mt-3 text-[clamp(54px,15.5vw,84px)] leading-[0.84] [animation-delay:200ms] md:text-[clamp(96px,11vw,188px)]">
              One planet.
              <br />
              One door.
            </p>
            <nav aria-label="Ways to visit" className="visit-in mt-7 flex flex-col gap-3 [animation-delay:300ms] sm:flex-row md:mt-9">
              <a
                href={HASH}
                data-action="in-person"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  play();
                }}
                onPointerEnter={() => canFilm && setWantMap(true)}
                onFocus={() => canFilm && setWantMap(true)}
                className={`${pill} bg-paper text-ink`}
              >
                In person
                <span aria-hidden className="text-[18px] leading-none">
                  ↓
                </span>
              </a>
              <Link href={TOUR_ENTER_URL} data-action="tour" className={`${pill} border border-paper/60 bg-black/30 text-paper backdrop-blur-sm hover:border-paper`}>
                Virtual tour
                <span aria-hidden className="text-[18px] leading-none">
                  →
                </span>
              </Link>
            </nav>
            {canFilm && !find.soon && (
              <p aria-hidden className="visit-in mt-5 hidden items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper/60 [animation-delay:420ms] sm:flex">
                <span className="relative block h-7 w-px overflow-hidden bg-paper/25">
                  <span className="tour-hint absolute inset-0 bg-paper" />
                </span>
                Or scroll to fall in
              </p>
            )}
            {find.soon && (
              <div className="mt-7 max-w-md">
                <p className="font-semibold">Join the opening list</p>
                <p className="mt-1 text-[14px] text-paper/70">One message on WhatsApp or by email when the shutter goes up. Nothing else.</p>
                <div className="mt-4">
                  <AlertSignup dark source="opening" />
                </div>
              </div>
            )}
            {/* Without JavaScript there is no film: the essentials, in words. */}
            <noscript>
              <div id="find-us" className="mt-6 max-w-md border-t border-paper/25 pt-4 text-[15px]">
                <p className="font-semibold">{find.place}</p>
                {find.landmark && <p className="text-paper/70">{find.landmark}</p>}
                <p className="mt-1 font-mono text-[13px]">{hoursToday}</p>
                {mapsUrl && (
                  <p className="mt-2">
                    <a href={mapsUrl} className="font-semibold underline underline-offset-4">
                      Open in Google Maps
                    </a>
                  </p>
                )}
              </div>
            </noscript>
          </div>
        </div>

        {/* The film's words: one line of big type per moment, locking on as it changes. */}
        {canFilm && (
          <div aria-hidden data-caption className={`pointer-events-none absolute inset-x-0 bottom-0 transition-opacity duration-300 ${inFilm && caption && !atEnd ? "opacity-100" : "opacity-0"}`}>
            <div className="container-ep pb-[max(92px,calc(env(safe-area-inset-bottom)+86px))] md:pb-16">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-paper/65 md:text-[11px]">
                {String(Math.max(1, sceneIndex)).padStart(2, "0")} / {String(SCENES.length - 2).padStart(2, "0")} · {SCENES[Math.max(0, sceneIndex)].name}
              </p>
              <p className="display mt-2 max-w-[14ch] text-[clamp(44px,12vw,72px)] leading-[0.88] [text-shadow:0_2px_24px_rgb(0_0_0/0.6)] md:max-w-[62%] md:text-[clamp(64px,7vw,124px)]">
                <Decode text={caption ?? ""} still={still} />
              </p>
            </div>
          </div>
        )}

        {/* The scenes down the right edge: each fills as the film passes through it, and goes there when pressed. */}
        {canFilm && (
          <ol className={`absolute right-1 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 transition-opacity duration-500 md:right-6 ${inFilm && !atEnd ? "opacity-100" : "pointer-events-none opacity-0"}`} inert={!inFilm || atEnd}>
            {SCENES.slice(1).map((s, k) => {
              const i = k + 1;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    title={s.name}
                    aria-label={`Go to ${s.name}`}
                    aria-current={i === sceneIndex ? "step" : undefined}
                    onClick={() => {
                      stopAuto();
                      scrollToSecond(sceneStart(s.id) + (s.id === "arrive" ? 1 : 0.4), !still);
                    }}
                    className="flex h-9 w-11 justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-paper md:h-10"
                  >
                    <span className="relative block h-full w-[3px] bg-paper/30">
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
              );
            })}
          </ol>
        )}

        {/* While the film runs: pause or play, straight to the directions, and the way back up. */}
        {canFilm && inFilm && !atEnd && (
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 px-4 pb-[max(18px,calc(env(safe-area-inset-bottom)+12px))] md:justify-end md:px-10 md:pb-9">
            <button type="button" onClick={toTop} className="flex h-11 items-center gap-2 rounded-full border border-paper/35 bg-black/45 px-4 text-[12px] font-semibold uppercase tracking-[0.08em] backdrop-blur">
              <span aria-hidden>↑</span> Top
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-skip
                onClick={() => {
                  stopAuto();
                  scrollToSecond(FILM_SECONDS, false);
                }}
                className="flex h-11 items-center gap-1 rounded-full border border-paper/35 bg-black/45 px-4 text-[12px] font-semibold uppercase tracking-[0.08em] backdrop-blur"
              >
                Directions <span aria-hidden>›</span>
              </button>
              {!still && (
                <button type="button" onClick={() => (playing ? stopAuto() : play())} aria-label={playing ? "Pause" : "Play"} className="grid h-11 w-11 place-items-center rounded-full bg-paper text-ink">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={playing ? "M7 5h3v14H7zM14 5h3v14h-3z" : "M8 5l11 7-11 7z"} />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* In person with no film (no WebGL, the light version, or the graphics were lost): the directions over a still. */}
        {plain && (
          <div data-plain className="absolute inset-0 z-20 bg-[#0B0C0D]">
            {/* eslint-disable-next-line @next/next/no-img-element -- one small still, sized and compressed by hand */}
            <img
              data-route-static={staticRoute ? "" : undefined}
              src={staticRoute ? STATIC_ROUTE.src : "/visit/store-night-open.avif"}
              alt={staticRoute ? `Map: the route from ${STATIC_ROUTE.from} to Easypick` : ""}
              className={`absolute inset-0 h-full w-full ${staticRoute ? "object-contain object-top md:object-left" : "object-cover opacity-40"}`}
            />
            <button type="button" onClick={toTop} className="absolute left-4 top-20 z-10 flex h-11 items-center gap-2 rounded-full border border-paper/40 bg-black/50 px-4 text-[13px] font-semibold uppercase tracking-[0.06em] backdrop-blur md:left-8">
              <span aria-hidden>←</span> Back
            </button>
          </div>
        )}

        {(canFilm || plain) && (
          <div className={plain ? "absolute inset-0 z-30 pointer-events-none [&>*]:pointer-events-auto" : "pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto"}>
            <Directions
              data={find}
              plain={plain || !canFilm}
              startId={startId}
              mode={mode}
              lit={plain ? 99 : lit}
              open={plain || panel}
              still={still}
              wide={wide}
              snap={snap}
              onSnap={setSnap}
              onStart={setStartId}
              onMode={setMode}
              locate={locate}
              away={away}
              onLocate={() => {
                if (locate === "shown") {
                  setMe(null);
                  setLocate("idle");
                } else askWhere(false);
              }}
              onLook={(step) => {
                if (!wide && snap === "full") setSnap("half");
                setLook((l) => ({ step, n: (l?.n ?? 0) + 1 }));
              }}
              onReplay={() => {
                scrollToSecond(0, false);
                requestAnimationFrame(play);
              }}
              onLeave={toTop}
            />
          </div>
        )}

        <p aria-live="polite" className="sr-only">
          {plain || atEnd ? (find.soon ? "The map shows the area Easypick is opening in." : `Directions to Easypick${walk !== null ? `: about ${walk} minutes on foot` : ""}.`) : inFilm && caption ? caption : ""}
        </p>
      </div>
    </div>
  );
}
