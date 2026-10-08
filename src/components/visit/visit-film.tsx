"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AlertSignup } from "@/components/alert-signup";
import { kathmanduClock } from "@/lib/kathmandu-sky";
import { fromRouting, MAX_LIVE_METRES, routingUrl } from "@/lib/map/live-route";
import { distance, lengthMeters, minutes, type LngLat, type TravelMode } from "@/lib/map/route";
import { AREA_CENTRE, FIXTURE_TILES_URL, STATIC_ROUTE, TILES_URL, TOUR_ENTER_URL } from "@/lib/map/tiles";
import { FILM_SECONDS, planFilm, SCENES, sceneStart, type SceneId } from "@/lib/visit/film";
import { guideLine } from "@/lib/visit/guide";
import { Directions, googleMapsUrl, walkMinutes, type DirectionsData, type Locate, type Snap, type StartChoice } from "./directions";

// The Visit page: one film, and the page's scroll is its clock. It opens on Kathmandu as a tilted
// city at night with the whole route to the store drawn in lime and the store lit at its end, and
// two ways to visit: In person and the Virtual tour. Scrolling (or pressing In person, which
// scrolls for you) drops to where the route begins, flies along it step by step, pushes in on the
// door, and ends on the directions. Scrolling back up runs it backwards. Every position of
// everything is a pure function of the film's second (lib/visit/film.ts); this component turns
// scroll into that second and hands it to the map (descent-map.tsx).
//
// Without WebGL, or on a data-saver or low-memory phone, there is no film: the first screen is a
// still, and In person opens the same directions over a still of the route.

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
const SCREENS = 7;
/** Playing by itself, the film runs a little faster than its own clock. */
const PLAY_RATE = 1.25;

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

/** Pick, the helper: a small black shutter with a face and the lime dot. */
function Pick() {
  return (
    <svg viewBox="0 0 48 48" className="pick-bob h-12 w-12 shrink-0 drop-shadow-[0_4px_14px_rgb(0_0_0/0.55)]" aria-hidden>
      <rect x="5" y="8" width="38" height="35" rx="12" className="fill-ink stroke-paper" strokeWidth="2" />
      <path d="M13 36h22" className="stroke-paper/25" strokeWidth="2" strokeLinecap="round" />
      <g className="pick-blink fill-paper">
        <ellipse cx="18" cy="22" rx="2.6" ry="3.6" />
        <ellipse cx="30" cy="22" rx="2.6" ry="3.6" />
      </g>
      <path d="M19.5 29.5q4.5 3.5 9 0" fill="none" className="stroke-paper" strokeWidth="2" strokeLinecap="round" />
      <circle cx="38" cy="11" r="5" className="fill-volt stroke-ink" strokeWidth="2" />
    </svg>
  );
}

/** Pick and the one thing it has to say right now. */
function Guide({ line, quiet }: { line: string; quiet?: boolean }) {
  return (
    <div data-guide className="flex items-end gap-3">
      <Pick />
      <p aria-hidden={quiet} className="max-w-[34ch] rounded-2xl rounded-bl-sm border border-paper/15 bg-black/60 px-4 py-3 text-[14px] leading-snug text-paper backdrop-blur-md md:text-[15px]">
        <span key={line} data-guide-line className="visit-in block">
          {line}
        </span>
      </p>
    </div>
  );
}

export function VisitFilm({
  switches,
  find,
  clock,
  liveClock,
  backdrop,
  status,
  short,
  open,
  personal,
  hoursToday,
}: {
  switches: FilmSwitches;
  /** What the map and the directions need. Before opening day there is no pin and no start point. */
  find: DirectionsData;
  /** "19:42" in Kathmandu as the page is made; kept running here. */
  clock: string;
  /** False when the clock is pinned (tests, demos): the time stays put. */
  liveClock: boolean;
  /** A still of the store, for the first screen where there is no film. */
  backdrop: string;
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
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  /** The film's second: where scroll points, and where the picture is (easing towards it). */
  const film = useRef({ target: 0, shown: 0 });
  /** The page scrolling itself, until the visitor takes over. */
  const auto = useRef({ on: false, y: 0 });
  const mapReady = useRef(false);
  /** The second to open on (a direct link to the directions, or a test), once the page is tall enough to scroll there. */
  const opening = useRef<number | null>(null);
  /** Set when the visitor asks to go back to the top: focus follows once the first screen is live again. */
  const refocus = useRef(false);

  const [fallback, setFallback] = useState<Fallback>("none");
  const [decided, setDecided] = useState(false);
  const [tier, setTier] = useState<2 | 3>(3);
  const [wide, setWide] = useState(true);
  const [tall, setTall] = useState(800);
  const [mapOn, setMapOn] = useState(false);
  const [mapLost, setMapLost] = useState(false);
  const [scene, setScene] = useState<SceneId>("open");
  const [panel, setPanel] = useState(false);
  const [lit, setLit] = useState(-1);
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
  /** The way from where the visitor is, along real streets (worked out by OpenStreetMap's routing service once they share their location). */
  const [mine, setMine] = useState<StartChoice | null>(null);

  const still = fallback === "reduced";
  const canFilm = decided && (fallback === "none" || fallback === "reduced") && !mapLost;
  const starts = useMemo(() => (mine ? [mine, ...find.starts] : find.starts), [mine, find.starts]);
  const start = starts.find((s) => s.id === startId) ?? starts[0] ?? null;
  const steps = start ? start.steps : find.steps;
  const here: LngLat = useMemo(() => (find.pin ? [find.pin.lng, find.pin.lat] : AREA_CENTRE), [find.pin]);
  const plan = useMemo(() => planFilm({ pin: here, route: start ? start.coords : null, steps, area: find.area, hasDoor: Boolean(find.pin) }), [here, start, steps, find.area, find.pin]);
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

  // Kathmandu's clock keeps time while the page is open.
  useEffect(() => {
    if (!liveClock) return;
    const tick = () => root.current?.querySelectorAll("[data-ktm-clock]").forEach((el) => (el.textContent = kathmanduClock(new Date())));
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
        // The real way from there, along the streets. Until it arrives (or if it can't be had), the nearest saved start point stands in.
        const pin = find.pin;
        if (!pin || distance(at, [pin.lng, pin.lat]) > MAX_LIVE_METRES) return;
        fetch(routingUrl(at, pin), { signal: AbortSignal.timeout(9000) })
          .then((r) => (r.ok ? r.json() : null))
          .then((answer) => {
            const route = fromRouting(answer, pin);
            if (!route) return;
            setMine({ id: "me", name: "Your location", coords: route.coords, steps: route.steps });
            setStartId("me");
          })
          .catch(() => {
            // offline, blocked or slow: the saved start point and the dashed line remain
          });
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
    refocus.current = true;
  }, [scrollToSecond, still, stopAuto]);

  // Back at the top (the first screen is usable again): the keyboard returns to the choice that started it.
  useEffect(() => {
    if (scene !== "open" || !refocus.current) return;
    refocus.current = false;
    root.current?.querySelector<HTMLElement>("[data-action=in-person]")?.focus({ preventScroll: true });
  }, [scene, plain]);

  // Opened part-way through: go there as soon as the film's scroll length exists.
  useEffect(() => {
    if (!canFilm || opening.current === null) return;
    const t = opening.current;
    opening.current = null;
    scrollToSecond(t, false);
    film.current.shown = t;
  }, [canFilm, scrollToSecond]);

  // The film's clock: scroll decides where it should be; each frame it eases there, and the map
  // and the words follow. Only what changes by the scene touches React.
  useEffect(() => {
    if (!canFilm) return;
    let frame = 0;
    let last = performance.now();
    const seen = { scene: "" as string, panel: false, step: -2 };
    const speed = switches.motion === "fast" ? 8 : 1;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const f = film.current;
      const a = auto.current;
      const top = root.current?.offsetTop ?? 0;
      if (a.on) {
        const max = top + reach();
        // It waits for the city to be drawn before it sets off.
        if (mapReady.current) a.y = Math.min(max, a.y + ((dt * reach()) / FILM_SECONDS) * PLAY_RATE * speed);
        window.scrollTo({ top: a.y, behavior: "instant" });
        if (a.y >= max) stopAuto();
      }
      f.target = Math.min(1, Math.max(0, (window.scrollY - top) / reach())) * FILM_SECONDS;
      const gap = f.target - f.shown;
      f.shown = still || Math.abs(gap) < 0.002 ? f.target : f.shown + gap * (1 - Math.exp(-dt * 6 * speed));
      const t = f.shown;

      const fr = planRef.current.frame(t);
      SCENES.forEach((s, i) => {
        const el = fills.current[i];
        if (!el) return;
        const end = SCENES[i + 1]?.from ?? FILM_SECONDS;
        el.style.transform = `scaleY(${Math.min(1, Math.max(0, (t - s.from) / (end - s.from)))})`;
      });
      if (fr.scene !== seen.scene) {
        seen.scene = fr.scene;
        setScene(fr.scene);
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
  const inFilm = canFilm && scene !== "open";
  const atEnd = scene === "arrive" && panel;
  const sceneIndex = SCENES.findIndex((s) => s.id === scene);
  /** Nothing starts until the page knows what this device gets and, with the film, the city is drawn. */
  const loaded = decided && (!canFilm || mapOn);
  const says = guideLine({ scene, soon: find.soon, area: find.area, from: start?.name ?? null, walk, steps, step: lit, panel, plain: plain || !canFilm, canLocate: locate === "idle" });
  const hello = guideLine({ scene: "open", soon: find.soon, area: find.area, from: start?.name ?? null, walk, steps, step: -1, panel: false, plain: false, canLocate: false });
  const pill = "flex h-14 items-center justify-center gap-3 rounded-full px-7 text-[14px] font-semibold uppercase tracking-[0.08em] transition-transform duration-150 active:scale-[0.98]";

  return (
    <div
      ref={root}
      data-film={canFilm ? "on" : "off"}
      data-fallback={fallback}
      data-scene={scene}
      data-map-state={!canFilm ? "idle" : mapOn ? (atEnd ? "done" : "ready") : "loading"}
      data-loaded={loaded}
      data-playing={playing}
      data-motion={switches.motion}
      data-tiles={switches.tiles}
      className="on-dark relative bg-[#0B0C0D] text-paper"
      style={{ height: canFilm ? `${SCREENS * 100}svh` : undefined }}
    >
      {/* The frame never scrolls inside itself: if a focus or a scroll-into-view nudges it, it goes straight back. */}
      <div className={`${canFilm ? "sticky top-0" : "relative"} h-svh min-h-[540px] overflow-hidden`}
        onScroll={(e) => {
          if (e.target !== e.currentTarget) return;
          e.currentTarget.scrollTop = 0;
          e.currentTarget.scrollLeft = 0;
        }}
      >
        {/* With no film: a still of the store behind the words. */}
        {decided && !canFilm && (
          // eslint-disable-next-line @next/next/no-img-element -- one small still, sized and compressed by hand
          <img src={backdrop} alt="" draggable={false} data-backdrop className="absolute inset-0 h-full w-full select-none object-cover opacity-55" />
        )}
        {canFilm && (
          <div data-map-box className={`absolute inset-0 bg-[#0B0C0D] transition-opacity duration-700 ${mapOn ? "opacity-100" : "opacity-0"}`} style={{ pointerEvents: atEnd ? "auto" : "none" }}>
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
        {/* The finish over the picture: a little grain, and shade under the words. */}
        <div className="visit-grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" aria-hidden />
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent via-40% to-black/85 transition-opacity duration-500 ${atEnd ? "opacity-0" : "opacity-100"}`} aria-hidden />
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 via-45% to-transparent transition-opacity duration-500 max-md:hidden ${inFilm ? "opacity-0" : "opacity-100"}`} aria-hidden />

        {/* The first screen: Pick's hello and the two ways to visit, over a clear picture. It steps aside once the film is under way. */}
        <div className={`absolute inset-x-0 bottom-0 transition-[opacity,translate] duration-500 ${inFilm ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100"}`} inert={inFilm}>
          <div className="container-ep pb-[max(22px,calc(env(safe-area-inset-bottom)+16px))] md:pb-14">
            <h1 id="visit-h" className="sr-only">
              Visit Easypick
            </h1>
            <p className="sr-only" data-status-line>
              {status}
            </p>
            {personal && <p className="mb-4 font-mono text-[12px] tracking-[0.1em] text-paper">{personal}</p>}
            <div key={loaded ? "in" : "wait"} className={loaded ? "visit-in" : undefined}>
              <Guide line={hello} />
            </div>
            <p key={loaded ? "status-in" : "status"} className="visit-in mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.16em] text-paper/80 [animation-delay:120ms] md:text-[11px]" data-visit-status>
              {!find.soon && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${open ? "bg-volt" : "border border-paper/80"}`} />}
              {short} <span className="text-paper/45">·</span> {find.area} <span className="text-paper/45">·</span>{" "}
              <span>
                <span data-ktm-clock className="tabular-nums">
                  {clock}
                </span>{" "}
                <span className="text-paper/55 max-md:hidden">in Kathmandu</span>
              </span>
              {walk !== null && !find.soon && (
                <>
                  {" "}
                  <span className="text-paper/45">·</span> {walk} min walk
                </>
              )}
            </p>
            <nav key={loaded ? "ways-in" : "ways"} aria-label="Ways to visit" className="visit-in mt-4 flex flex-col gap-3 [animation-delay:220ms] sm:flex-row md:mt-5">
              <a
                href={HASH}
                data-action="in-person"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  play();
                }}
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
                Or scroll to walk it
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

        {/* Through the film and on the directions, Pick says what is on screen and what to do next. */}
        {(inFilm || plain) && (wide || snap !== "full") && (
          <div
            data-guide-film
            className={`pointer-events-none absolute left-4 right-14 z-30 md:bottom-10 md:left-10 md:right-auto md:top-auto ${plain ? "top-[calc(env(safe-area-inset-top)+136px)]" : "top-[calc(env(safe-area-inset-top)+76px)]"}`}
          >
            <Guide line={says} quiet />
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
                      scrollToSecond(s.id === "arrive" ? FILM_SECONDS : sceneStart(s.id) + (s.id === "door" ? 1.6 : 0.4), !still);
                    }}
                    className="flex h-11 w-11 justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-paper"
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
              src={staticRoute ? STATIC_ROUTE.src : backdrop}
              alt={staticRoute ? `Map: the route from ${STATIC_ROUTE.from} to Easypick` : ""}
              className={`absolute inset-0 h-full w-full ${staticRoute ? "object-contain object-top md:object-left" : "object-cover opacity-40"}`}
            />
            <button type="button" onClick={toTop} className="absolute left-4 top-20 z-10 flex h-11 items-center gap-2 rounded-full border border-paper/40 bg-black/50 px-4 text-[13px] font-semibold uppercase tracking-[0.06em] backdrop-blur md:left-8">
              <span aria-hidden>←</span> Back
            </button>
          </div>
        )}

        {(canFilm || plain) && (
          <div className={`pointer-events-none absolute inset-0 [&>*]:pointer-events-auto ${plain ? "z-30" : "z-10"}`}>
            <Directions
              data={mine ? { ...find, starts } : find}
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
                  setMine(null);
                  setStartId(find.starts[0]?.id ?? null);
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

        {/* First, the Easypick mark while the page gets ready. Nothing starts under it. */}
        <div data-loader={loaded ? "done" : "on"} className={`visit-loader absolute inset-0 z-40 grid place-items-center bg-[#0B0C0D] transition-[opacity,visibility] duration-500 ${loaded ? "invisible opacity-0" : ""}`}>
          <div role="status" className="flex flex-col items-center gap-7">
            {/* eslint-disable-next-line @next/next/no-img-element -- the brand mark, already small */}
            <img src="/brand/mark-white.png" alt="" width={146} height={148} className="tour-spin block h-[72px] w-auto md:h-[88px]" />
            <span className="relative block h-px w-36 overflow-hidden bg-paper/20">
              <span className="visit-load absolute inset-0 bg-paper" />
            </span>
            <span className="sr-only">{loaded ? "" : "Loading Easypick"}</span>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {inFilm || plain ? says : ""}
        </p>
      </div>
    </div>
  );
}
