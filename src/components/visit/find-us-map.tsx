"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { AttributionControl, Map as MapLibre, Marker, addProtocol, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";

import { bounds, lengthMeters, pointAt, sliceTo, stepAt, type LngLat } from "@/lib/map/route";
import { mapPhases, placeAt, quart, type SeqMode } from "@/lib/map/sequence";
import { MAP_COLOURS, mapStyle } from "@/lib/map/style";
import { AREA_CENTRE, LAND_URL, VALLEY } from "@/lib/map/tiles";
import type { MapState } from "./visit-stage";

// The Find us map: MapLibre drawing our own Kathmandu tiles (a PMTiles file, read in pieces
// straight from storage) in the site's dark style, and the sequence that plays on it: out to the
// whole valley, a hold, in to the route, the route drawing itself in lime, the panel, the arrival.
// Every duration comes from lib/map/sequence.ts. Loaded only by visit-stage.tsx, and only after
// the 3D store's canvas has gone (one WebGL context at a time).

// Once for the page: the worker is our own copy (same origin, so the CSP needs no blob: workers),
// and "pmtiles://" requests are answered from the one file.
let prepared = false;
function prepare() {
  if (prepared) return;
  prepared = true;
  setWorkerUrl("/map/maplibre-gl-worker.mjs");
  addProtocol("pmtiles", new Protocol().tile);
}

/** "instant" is the reduced-motion entry: the map opens on the finished picture. */
export type MapEntry = SeqMode | "instant";

export interface FindUsMapProps {
  tilesUrl: string;
  /** The store. Null before opening day: the map then shows the area, with no pin and no route. */
  pin: { lat: number; lng: number } | null;
  /** The route to draw, ending at the pin. */
  route: LngLat[] | null;
  /** The receipt's steps, so each can light as the line reaches it. */
  steps: { minutes: number }[];
  /** Read out for the map region, e.g. "Map: route from Jhamsikhel Chowk to Easypick". */
  label: string;
  entry: MapEntry;
  /** 1 is normal; ?motion=fast uses 0.1. */
  speed: number;
  /** Buildings rise on arrival only on stronger devices. */
  tier: 2 | 3;
  /** A new number finishes the sequence at once (Skip, a tap, a key). */
  skip: number;
  /** A new number plays it again from the valley. */
  replay: number;
  /** Room the panel takes on the right (desktop) or bottom (phones), so the route stays clear of it. */
  inset: { right: number; bottom: number };
  /** Look at one receipt step's spot on the route; a new `n` asks again. */
  look?: { step: number; n: number } | null;
  /** Where to park, marked P. */
  parking?: { kind: "bike" | "car"; lng: number; lat: number }[];
  /** Where the visitor is (only after they asked): a dashed line from there to the door. Never leaves the page. */
  me?: LngLat | null;
  /** The map's graphics context was lost (the page then shows the still of the route). */
  onLost?: () => void;
  /** Where the camera is, for the caption: 0 Earth, 1 Nepal, 2 Kathmandu, 3 the neighbourhood, -1 none. */
  onPlace?: (place: -1 | 0 | 1 | 2 | 3) => void;
  onState: (state: MapState) => void;
  /** The receipt line the drawn line has reached (-1 before the first). */
  onStep: (index: number) => void;
  /** True once the panel should be in (the sequence has reached "settle", or was skipped or interrupted). */
  onPanel: (open: boolean) => void;
}

/** Where the globe starts (west of Nepal, so it turns into view), how far out, and where it turns to. */
const GLOBE_START: LngLat = [52, 16];
const GLOBE_ZOOM = 1.9;
const NEPAL: LngLat = [84.1, 28.3];
const VALLEY_CENTRE: LngLat = [(VALLEY[0][0] + VALLEY[1][0]) / 2, (VALLEY[0][1] + VALLEY[1][1]) / 2];
/** Once the sequence is over the map stays in and around the valley, where our tiles are. */
const HOME_BOUNDS: [LngLat, LngLat] = [
  [84.9, 27.4],
  [85.8, 28.0],
];
const HOME_MIN_ZOOM = 9;
/** Below this zoom only our own far view is drawn (the land, and the glow over Nepal). */
const FAR_ZOOM = 7;

const M_PER_DEG_LAT = 110_900;
const mPerDegLng = (lat: number) => Math.cos((lat * Math.PI) / 180) * 111_320;

/** The store's outline on the map: 5.4 m across the front, 11 m deep, the pin at the middle of the front. */
function footprint(pin: { lat: number; lng: number }): LngLat[] {
  const dx = 2.7 / mPerDegLng(pin.lat);
  const dy = 11 / M_PER_DEG_LAT;
  return [
    [pin.lng - dx, pin.lat],
    [pin.lng + dx, pin.lat],
    [pin.lng + dx, pin.lat + dy],
    [pin.lng - dx, pin.lat + dy],
    [pin.lng - dx, pin.lat],
  ];
}

function circle([lng, lat]: LngLat, metres: number): LngLat[] {
  return Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return [lng + (Math.cos(a) * metres) / mPerDegLng(lat), lat + (Math.sin(a) * metres) / M_PER_DEG_LAT] as LngLat;
  });
}

const line = (coords: LngLat[]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } });
const polygon = (ring: LngLat[]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [ring] } });

export default function FindUsMap(props: FindUsMapProps) {
  const { tilesUrl, pin, label, entry, speed, skip, replay, look, me } = props;
  const box = useRef<HTMLDivElement>(null);
  /** What the running sequence reads: always the latest props. */
  const live = useRef(props);
  /** The handles the later effects (skip, replay, a new route) use on the map made by the first. */
  const api = useRef<{ skip: () => void; play: (mode: MapEntry) => void; look: (step: number) => void; guide: (from: LngLat | null) => void; reroute: (mode: MapEntry) => void } | null>(null);
  const routeKey = props.route ? `${props.route.length}:${props.route[0].join(",")}:${props.route[props.route.length - 1].join(",")}` : "";
  const firstRoute = useRef(routeKey);

  useEffect(() => {
    live.current = props;
  });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    prepare();
    live.current.onState("loading");

    const here: LngLat = pin ? [pin.lng, pin.lat] : AREA_CENTRE;
    // A first visit opens far out, on the globe; a repeat visit on the valley; a direct link close in.
    const fromSpace = entry === "first" || entry === "soon";
    // The street map's own layers only come in near the valley: far out, its tiles would put other
    // people's borders and place names on our globe (and ask for fonts in scripts we don't host).
    // Set in the style itself, so even the very first tiles are read this way.
    const style = mapStyle(tilesUrl);
    style.layers = style.layers.map((l) => ("source" in l ? { ...l, minzoom: Math.max(l.minzoom ?? 0, l.type === "symbol" ? 10 : FAR_ZOOM) } : l));
    const map = new MapLibre({
      container: el,
      style,
      center: fromSpace ? GLOBE_START : entry === "repeat" ? VALLEY_CENTRE : here,
      zoom: fromSpace ? GLOBE_ZOOM : entry === "repeat" ? 11.2 : 15,
      minZoom: 0,
      maxZoom: 20,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      // Sharp enough, without drawing four times the pixels on dense phone screens.
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    });
    map.touchZoomRotate.disableRotation();
    // The credit stays in view, written out (not folded behind an "i").
    map.addControl(new AttributionControl({ compact: false }), "bottom-left");

    let marker: Marker | null = null;
    const parked: Marker[] = [];
    let meMarker: Marker | null = null;
    let alive = true;
    /** Changes whenever a sequence starts or stops, so an older one knows to give up. */
    let run = 0;
    let running = false;
    /** True once the running sequence has started on the route's line. */
    let drawing = false;
    let frame = 0;
    /** After the sequence the map keeps to the valley (where the tiles are); the globe opens it up again. */
    const lock = () => {
      if (map.getZoom() < HOME_MIN_ZOOM) return; // left far out by hand: don't snap the camera back
      map.setMinZoom(HOME_MIN_ZOOM);
      map.setMaxBounds(HOME_BOUNDS);
    };
    const unlock = () => {
      map.setMaxBounds(null);
      map.setMinZoom(0);
    };
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const routeNow = () => live.current.route;
    const padding = () => {
      const { right, bottom } = live.current.inset;
      return { top: 110, left: 40, right: 40 + right, bottom: 60 + bottom };
    };
    /** The view that holds the whole route (or the store, or the area), clear of the panel when `withPanel`. */
    const routeView = (withPanel: boolean) => {
      const r = routeNow();
      const pad = withPanel ? padding() : { top: 110, left: 40, right: 40, bottom: 60 };
      if (r && r.length > 1) return map.cameraForBounds(bounds(r), { padding: pad, maxZoom: 17.2 }) ?? { center: here, zoom: 16 };
      if (pin) return { center: here, zoom: 16.5 };
      return map.cameraForBounds(bounds(circle(AREA_CENTRE, 400)), { padding: pad }) ?? { center: here, zoom: 15 };
    };
    const setDrawn = (f: number) => {
      const r = routeNow();
      const src = map.getSource("route") as GeoJSONSource | undefined;
      if (!src) return;
      src.setData(line(r && r.length > 1 && f > 0 ? sliceTo(r, f) : []));
      live.current.onStep(r && f > 0 ? stepAt(live.current.steps, f) : -1);
    };
    const wait = (ms: number, mine: number) =>
      new Promise<boolean>((done) => {
        const t = setTimeout(() => {
          timers.delete(t);
          done(mine === run);
        }, ms);
        timers.add(t);
      });
    const stopAll = () => {
      run += 1;
      running = false;
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      timers.clear();
      map.stop();
    };

    /** The finished picture: whole route, panel in. Used by Skip, by a drag, and by reduced motion. */
    const finish = (state: "done" | "interrupted", moveCamera: boolean) => {
      stopAll();
      setDrawn(1);
      if (map.getLayer("soon-fill")) map.setLayoutProperty("soon-fill", "visibility", "visible");
      if (map.getLayer("soon-line")) map.setLayoutProperty("soon-line", "visibility", "visible");
      live.current.onPanel(true);
      live.current.onPlace?.(-1);
      if (moveCamera) {
        const ms = live.current.entry === "instant" ? 0 : 250 * Math.min(1, live.current.speed);
        map.easeTo({ ...routeView(true), pitch: 0, bearing: 0, duration: ms });
        const mine = run;
        const t = setTimeout(() => {
          timers.delete(t);
          if (mine === run) lock();
        }, ms + 60);
        timers.add(t);
      }
      live.current.onState(state);
    };

    const play = async (mode: MapEntry) => {
      stopAll();
      if (mode === "instant") {
        map.jumpTo({ ...routeView(true), pitch: 0, bearing: 0 });
        finish("done", false);
        lock();
        return;
      }
      const mine = (run += 1);
      running = true;
      drawing = false;
      const metres = lengthMeters(routeNow() ?? []);
      live.current.onPanel(false);
      live.current.onState("flying");
      if (mode !== "chip") setDrawn(0);
      // From the globe (and on Replay): the whole Earth is open to the camera again.
      if (mode === "first" || mode === "soon") {
        unlock();
        map.jumpTo({ center: GLOBE_START, zoom: GLOBE_ZOOM, pitch: 0, bearing: 0 });
      } else if (mode === "repeat") {
        unlock();
        map.jumpTo({ center: VALLEY_CENTRE, zoom: 11.2, pitch: 0, bearing: 0 });
      }

      for (const phase of mapPhases(mode, metres, live.current.speed)) {
        const ms = phase.end - phase.start;
        if (mine !== run) return;
        live.current.onPlace?.(placeAt(phase.name));
        switch (phase.name) {
          case "globe":
            // The Earth turns until Nepal faces the camera.
            map.easeTo({ center: NEPAL, zoom: 2.4, duration: ms, easing: phase.ease, essential: true });
            if (!(await wait(ms, mine))) return;
            break;
          case "nepal":
            map.flyTo({ center: NEPAL, zoom: 5.6, duration: ms, curve: 1.2, easing: quart, essential: true });
            if (!(await wait(ms, mine))) return;
            break;
          case "pullout": {
            map.flyTo({ center: VALLEY_CENTRE, zoom: 10.6, pitch: 0, bearing: 0, duration: ms, curve: 1.42, easing: quart, essential: true });
            if (!(await wait(ms, mine))) return;
            break;
          }
          case "hold":
            if (!(await wait(ms, mine))) return;
            break;
          case "fly":
            map.flyTo({ ...routeView(false), pitch: 0, bearing: 0, duration: ms, easing: quart, essential: true });
            if (!(await wait(ms, mine))) return;
            break;
          case "circle":
            map.setLayoutProperty("soon-fill", "visibility", "visible");
            map.setLayoutProperty("soon-line", "visibility", "visible");
            map.flyTo({ ...routeView(true), duration: ms, easing: quart, essential: true });
            if (!(await wait(ms, mine))) return;
            break;
          case "signup":
            live.current.onPanel(true);
            if (!(await wait(ms, mine))) return;
            break;
          case "retract":
          case "draw": {
            const back = phase.name === "retract";
            if (!back) {
              if (mode === "deeplink" || mode === "chip") map.easeTo({ ...routeView(false), duration: Math.min(ms, 400 * live.current.speed + 1), essential: true });
              drawing = true;
              live.current.onState("drawing");
            }
            const ok = await new Promise<boolean>((done) => {
              const t0 = performance.now();
              const tick = (now: number) => {
                if (mine !== run) return done(false);
                const p = ms <= 0 ? 1 : Math.min(1, (now - t0) / ms);
                const f = phase.ease(p);
                setDrawn(back ? 1 - f : f);
                if (p < 1) frame = requestAnimationFrame(tick);
                else done(true);
              };
              frame = requestAnimationFrame(tick);
            });
            if (!ok) return;
            break;
          }
          case "settle":
            live.current.onPanel(true);
            map.easeTo({ ...routeView(true), duration: ms, essential: true });
            if (!(await wait(ms, mine))) return;
            break;
          case "arrival": {
            // The pin sends one ring; on stronger devices the store stands up and the view tips towards its front.
            marker?.getElement().classList.add("pin-arrived");
            if (live.current.tier === 3 && map.getLayer("store-3d")) {
              const t0 = performance.now();
              const rise = (now: number) => {
                if (mine !== run) return;
                const p = ms <= 0 ? 1 : Math.min(1, (now - t0) / ms);
                map.setPaintProperty("store-3d", "fill-extrusion-height", 8 * phase.ease(p));
                if (p < 1) frame = requestAnimationFrame(rise);
              };
              frame = requestAnimationFrame(rise);
              map.easeTo({ pitch: 40, duration: ms, essential: true });
            }
            try {
              navigator.vibrate?.(12);
            } catch {
              // not allowed, or not there: nothing to do
            }
            if (!(await wait(ms, mine))) return;
            break;
          }
        }
      }
      if (mine !== run) return;
      running = false;
      live.current.onPlace?.(-1);
      lock();
      live.current.onState("done");
    };

    map.on("load", () => {
      // The far view: the Earth as a ball, the land in one flat tone (our own small file: the map
      // tiles only cover the valley), and a soft lime glow over Nepal. No borders are drawn. All of it fades as the valley's
      // streets take over.
      map.setProjection({ type: "globe" });
      try {
        map.setSky({ "sky-color": "#0a0e13", "horizon-color": "#1b2633", "fog-color": "#0b0c0d", "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.85, 5, 0.5, 7, 0] });
      } catch {
        // no atmosphere on this device: the globe is drawn without its glow
      }
      const layers = map.getStyle().layers;
      const ground = layers.find((l) => l.type === "background")?.id;
      const above = layers.find((l) => l.type !== "background")?.id;
      if (ground) map.setPaintProperty(ground, "background-color", ["interpolate", ["linear"], ["zoom"], 4, "#0e141b", 8, MAP_COLOURS.ground]);
      map.addSource("land", { type: "geojson", data: LAND_URL });
      map.addLayer({ id: "land", type: "fill", source: "land", maxzoom: 9, paint: { "fill-color": "#1c2126", "fill-opacity": ["interpolate", ["linear"], ["zoom"], FAR_ZOOM, 1, 8.8, 0] } }, above);
      map.addSource("nepal", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: NEPAL } } });
      map.addLayer({ id: "nepal-glow", type: "circle", source: "nepal", maxzoom: 9, paint: { "circle-color": MAP_COLOURS.route, "circle-blur": 0.9, "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 1, 9, 5.6, 190, 8, 700], "circle-opacity": ["interpolate", ["linear"], ["zoom"], 1, 0.9, 4, 0.35, 7.5, 0] } }, above);

      map.addSource("guide", { type: "geojson", data: line([]) });
      map.addLayer({ id: "guide", type: "line", source: "guide", layout: { "line-cap": "round" }, paint: { "line-color": "#F5F4EF", "line-opacity": 0.7, "line-width": 2, "line-dasharray": [1, 2.5] } });
      map.addSource("route", { type: "geojson", data: line([]) });
      map.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MAP_COLOURS.ground, "line-width": 8 } });
      map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MAP_COLOURS.route, "line-width": 4 } });
      if (pin) {
        // The store itself: flat at first (the outline the 3D camera was looking down on), standing on arrival.
        map.addSource("store", { type: "geojson", data: polygon(footprint(pin)) });
        map.addLayer({ id: "store-flat", type: "fill", source: "store", paint: { "fill-color": "#1d1e21", "fill-outline-color": MAP_COLOURS.route } }, "route-casing");
        map.addLayer({ id: "store-3d", type: "fill-extrusion", source: "store", paint: { "fill-extrusion-color": "#2a2b2f", "fill-extrusion-height": 0, "fill-extrusion-opacity": 0.92 } });
        const dot = document.createElement("span");
        dot.className = "map-pin block h-4 w-4 rounded-full border-2 border-ink bg-volt";
        dot.setAttribute("data-map-pin", "");
        marker = new Marker({ element: dot }).setLngLat([pin.lng, pin.lat]).addTo(map);
      } else {
        // Before opening day: the area, not the address.
        map.addSource("soon", { type: "geojson", data: polygon(circle(AREA_CENTRE, 400)) });
        map.addLayer({ id: "soon-fill", type: "fill", source: "soon", layout: { visibility: "none" }, paint: { "fill-color": MAP_COLOURS.route, "fill-opacity": 0.07 } });
        map.addLayer({ id: "soon-line", type: "line", source: "soon", layout: { visibility: "none" }, paint: { "line-color": MAP_COLOURS.route, "line-width": 2, "line-dasharray": [2, 2] } });
      }
      for (const p of live.current.parking ?? []) {
        const el = document.createElement("span");
        el.className = "flex h-5 w-5 items-center justify-center rounded-[4px] border border-paper/70 bg-[#0B0C0D] font-mono text-[11px] font-semibold text-paper";
        el.textContent = "P";
        el.setAttribute("data-map-parking", p.kind);
        el.setAttribute("aria-label", p.kind === "bike" ? "Bike parking" : "Car parking");
        parked.push(new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map));
      }
      // Parking only means something close in.
      const nearOnly = () => parked.forEach((m) => (m.getElement().style.visibility = map.getZoom() >= 14 ? "" : "hidden"));
      map.on("zoom", nearOnly);
      nearOnly();
      live.current.onState("ready");
      void play(live.current.entry);
      if (live.current.me) guide(live.current.me);
    });

    // A drag, a pinch or the wheel stops the camera where the visitor put it, but they still get
    // the whole route and the panel. (A tap finishes the sequence instead.)
    const byHand = (e: { originalEvent?: unknown }) => {
      if (running && e.originalEvent) finish("interrupted", false);
    };
    map.on("dragstart", byHand);
    map.on("zoomstart", byHand);
    map.on("click", () => {
      if (running) finish("done", true);
    });

    /** A tapped receipt line: the camera goes to where that step ends on the route (600 ms). */
    const lookAt = (step: number) => {
      const r = routeNow();
      const steps = live.current.steps;
      if (!r || r.length < 2 || !steps[step]) return;
      if (running) finish("done", false);
      const last = steps[steps.length - 1].minutes;
      const f = last > 0 ? steps[step].minutes / last : (step + 1) / steps.length;
      map.easeTo({ center: pointAt(r, f), zoom: Math.max(map.getZoom(), 17), pitch: 0, padding: padding(), duration: live.current.entry === "instant" ? 0 : 600 * live.current.speed, essential: true });
      el.parentElement?.setAttribute("data-look", String(step));
    };

    /**
     * Where the visitor is: a dot, and a dashed straight line from there to where the drawn route
     * begins (or to the door when there's no route). While the sequence is still playing it only
     * marks the map; afterwards the camera moves to hold both ends.
     */
    const guide = (from: LngLat | null) => {
      const src = map.getSource("guide") as GeoJSONSource | undefined;
      if (!src) return;
      meMarker?.remove();
      meMarker = null;
      const r = routeNow();
      src.setData(line(from ? [from, r && r.length > 1 ? r[0] : here] : []));
      if (!from) return;
      const dot = document.createElement("span");
      dot.className = "block h-3 w-3 rounded-full border-2 border-ink bg-paper";
      dot.setAttribute("data-map-me", "");
      meMarker = new Marker({ element: dot }).setLngLat(from).addTo(map);
      if (running) return;
      map.fitBounds(bounds([from, here, ...(r ?? [])]), { padding: padding(), maxZoom: 17, pitch: 0, duration: live.current.entry === "instant" ? 0 : 600 * live.current.speed, essential: true });
    };

    /** A different start point. Before the line has started drawing, the running sequence simply uses it. */
    const reroute = (mode: MapEntry) => {
      if (live.current.me) guide(live.current.me);
      if (running && !drawing) return;
      void play(mode);
    };

    // If the graphics context goes (a phone under memory pressure), the page falls back to the still.
    const canvas = map.getCanvas();
    const lostNow = () => alive && live.current.onLost?.();
    canvas.addEventListener("webglcontextlost", lostNow);

    api.current = { skip: () => running && finish("done", true), play: (mode) => void play(mode), look: lookAt, guide, reroute };
    return () => {
      alive = false;
      canvas.removeEventListener("webglcontextlost", lostNow);
      api.current = null;
      stopAll();
      meMarker?.remove();
      marker?.remove();
      parked.forEach((m) => m.remove());
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is made once per tile set and pin; everything else is read live
  }, [tilesUrl, pin?.lat, pin?.lng]);

  // Skip, Replay and a change of start point act on the map that's there.
  const skipSeen = useRef(skip);
  useEffect(() => {
    if (skip === skipSeen.current) return;
    skipSeen.current = skip;
    api.current?.skip();
  }, [skip]);
  const replaySeen = useRef(replay);
  useEffect(() => {
    if (replay === replaySeen.current) return;
    replaySeen.current = replay;
    api.current?.play(entry === "instant" ? "instant" : pin ? "first" : "soon");
  }, [replay, entry, pin]);
  const meKey = me ? me.join(",") : "";
  const meSeen = useRef(meKey);
  useEffect(() => {
    if (meKey === meSeen.current) return;
    meSeen.current = meKey;
    api.current?.guide(live.current.me ?? null);
  }, [meKey]);
  const lookSeen = useRef(look?.n ?? 0);
  useEffect(() => {
    if (!look || look.n === lookSeen.current) return;
    lookSeen.current = look.n;
    api.current?.look(look.step);
  }, [look]);
  useEffect(() => {
    if (routeKey === firstRoute.current) return;
    firstRoute.current = routeKey;
    api.current?.reroute(entry === "instant" ? "instant" : "chip");
  }, [routeKey, entry]);

  // MapLibre's own stylesheet makes its container position: relative, so the box that fills the
  // stage is this outer one and the map takes all of it.
  return (
    <div role="region" aria-label={label} data-speed={speed} className="absolute inset-0">
      <div ref={box} className="h-full w-full" />
    </div>
  );
}
