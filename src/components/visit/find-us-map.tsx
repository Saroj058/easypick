"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { AttributionControl, Map as MapLibre, Marker, addProtocol, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";

import { bounds, lengthMeters, pointAt, sliceTo, stepAt, type LngLat } from "@/lib/map/route";
import { mapPhases, quart, type SeqMode } from "@/lib/map/sequence";
import { MAP_COLOURS, mapStyle } from "@/lib/map/style";
import { AREA_CENTRE, START_ZOOM, VALLEY } from "@/lib/map/tiles";
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
  onState: (state: MapState) => void;
  /** The receipt line the drawn line has reached (-1 before the first). */
  onStep: (index: number) => void;
  /** True once the panel should be in (the sequence has reached "settle", or was skipped or interrupted). */
  onPanel: (open: boolean) => void;
}

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
  const { tilesUrl, pin, label, entry, speed, skip, replay, look } = props;
  const box = useRef<HTMLDivElement>(null);
  /** What the running sequence reads: always the latest props. */
  const live = useRef(props);
  /** The handles the later effects (skip, replay, a new route) use on the map made by the first. */
  const api = useRef<{ skip: () => void; play: (mode: MapEntry) => void; look: (step: number) => void } | null>(null);
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
    // It opens where the 3D camera left off: straight above the store, close in.
    const startsClose = entry === "first" || entry === "repeat" || entry === "soon";
    const map = new MapLibre({
      container: el,
      style: mapStyle(tilesUrl),
      center: here,
      zoom: startsClose ? START_ZOOM : 15,
      minZoom: 9,
      maxZoom: 20,
      maxBounds: [
        [84.9, 27.4],
        [85.8, 28.0],
      ],
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
    /** Changes whenever a sequence starts or stops, so an older one knows to give up. */
    let run = 0;
    let running = false;
    let frame = 0;
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
      if (moveCamera) map.easeTo({ ...routeView(true), pitch: 0, bearing: 0, duration: live.current.entry === "instant" ? 0 : 250 * Math.min(1, live.current.speed) });
      live.current.onState(state);
    };

    const play = async (mode: MapEntry) => {
      stopAll();
      if (mode === "instant") {
        map.jumpTo({ ...routeView(true), pitch: 0, bearing: 0 });
        finish("done", false);
        return;
      }
      const mine = (run += 1);
      running = true;
      const r = routeNow();
      const metres = r ? lengthMeters(r) : 0;
      live.current.onPanel(false);
      live.current.onState("flying");
      if (mode !== "chip") setDrawn(0);

      for (const phase of mapPhases(mode, metres, live.current.speed)) {
        const ms = phase.end - phase.start;
        if (mine !== run) return;
        switch (phase.name) {
          case "pullout": {
            const valley = map.cameraForBounds(VALLEY, { padding: 24 }) ?? { center: here, zoom: 11 };
            map.flyTo({ ...valley, pitch: 0, bearing: 0, duration: ms, curve: 1.42, easing: quart, essential: true });
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
      live.current.onState("done");
    };

    map.on("load", () => {
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
      live.current.onState("ready");
      void play(live.current.entry);
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

    api.current = { skip: () => running && finish("done", true), play: (mode) => void play(mode), look: lookAt };
    return () => {
      api.current = null;
      stopAll();
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
  const lookSeen = useRef(look?.n ?? 0);
  useEffect(() => {
    if (!look || look.n === lookSeen.current) return;
    lookSeen.current = look.n;
    api.current?.look(look.step);
  }, [look]);
  useEffect(() => {
    if (routeKey === firstRoute.current) return;
    firstRoute.current = routeKey;
    api.current?.play(entry === "instant" ? "instant" : "chip");
  }, [routeKey, entry]);

  // MapLibre's own stylesheet makes its container position: relative, so the box that fills the
  // stage is this outer one and the map takes all of it.
  return (
    <div role="region" aria-label={label} data-speed={speed} className="absolute inset-0">
      <div ref={box} className="h-full w-full" />
    </div>
  );
}
