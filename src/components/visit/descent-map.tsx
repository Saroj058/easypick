"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { AttributionControl, Map as MapLibre, Marker, addProtocol, setWorkerUrl, type GeoJSONSource, type LayerSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";

import { bounds, pointAt, sliceTo, type LngLat } from "@/lib/map/route";
import { MAP_COLOURS, mapStyle } from "@/lib/map/style";
import { AREA_CENTRE } from "@/lib/map/tiles";
import { FILM_SECONDS, type FilmPlan } from "@/lib/visit/film";

// The picture of the Visit page's film: Kathmandu as a tilted city at night, drawn by MapLibre
// from our own tiles (a PMTiles file read in pieces), with its buildings standing up, the route
// glowing in lime and the store lit as the one bright building. This component decides nothing
// about time: every frame it asks for the film's second, asks the plan (lib/visit/film.ts) where
// the camera is at that second, and puts it there. So scrolling up runs it backwards, and holding
// still holds it. Once the film has reached its end the map is the visitor's to move.

// Once for the page: the worker is our own copy (same origin, so the CSP needs no blob: workers),
// and "pmtiles://" requests are answered from the one file.
let prepared = false;
function prepare() {
  if (prepared) return;
  prepared = true;
  setWorkerUrl("/map/maplibre-gl-worker.mjs");
  addProtocol("pmtiles", new Protocol().tile);
}

export interface DescentMapProps {
  tilesUrl: string;
  /** The store. Null before opening day: the map then shows the area, with no pin and no route. */
  pin: { lat: number; lng: number } | null;
  /** The route to draw, ending at the pin. */
  route: LngLat[] | null;
  /** The film for this pin and route. */
  plan: FilmPlan;
  /** The film's second, read every frame. */
  time: () => number;
  /** Read out for the map region, e.g. "Map: route from Jhamsikhel Chowk to Easypick". */
  label: string;
  /** Room the panel takes on the right (desktop) or bottom (phones), so the finished view keeps the route clear of it. */
  inset: { right: number; bottom: number };
  /** Look at one receipt step's spot on the route; a new `n` asks again. */
  look?: { step: number; n: number } | null;
  steps: { minutes: number }[];
  /** Where to park, marked P. */
  parking?: { kind: "bike" | "car"; lng: number; lat: number }[];
  /** Where the visitor is (only after they asked): a dot, and a dashed line to the route's start. Never leaves the page. */
  me?: LngLat | null;
  /** 3 = buildings stand up; 2 (phones) = they stay flat until the street. */
  tier: 2 | 3;
  /** The map has drawn its first frame (the cloud can clear). */
  onReady: () => void;
  /** The map's graphics context was lost. */
  onLost: () => void;
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
const point = (at: LngLat) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: at } });
const polygon = (ring: LngLat[]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [ring] } });
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

export default function DescentMap(props: DescentMapProps) {
  const { tilesUrl, pin, label, look, me } = props;
  const box = useRef<HTMLDivElement>(null);
  /** What the frame loop reads: always the latest props. */
  const live = useRef(props);
  const api = useRef<{ look: (step: number) => void; guide: (from: LngLat | null) => void; redraw: () => void } | null>(null);

  useEffect(() => {
    live.current = props;
  });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    prepare();
    const here: LngLat = pin ? [pin.lng, pin.lat] : AREA_CENTRE;

    // The street map's own layers, restyled for a tilted night view: nothing below the valley's
    // zoom, names only close in (wide tiles carry far-off names in scripts we don't host fonts for).
    const style = mapStyle(tilesUrl);
    style.layers = style.layers.map((l) => ("source" in l ? { ...l, minzoom: Math.max(l.minzoom ?? 0, l.type === "symbol" ? 11.5 : 8) } : l)) as LayerSpecification[];
    const map = new MapLibre({
      container: el,
      style,
      center: here,
      zoom: 15,
      pitch: 38,
      minZoom: 8,
      maxZoom: 20,
      maxPitch: 70,
      attributionControl: false,
      fadeDuration: 150,
      // The film moves the camera every frame: tiles asked for on the way must be allowed to arrive.
      cancelPendingTileRequestsWhileZooming: false,
      // Sharp enough, without drawing four times the pixels on dense phone screens.
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    });
    // The film owns the camera until its end: nothing answers to the hand before then.
    const handlers = [map.dragPan, map.scrollZoom, map.touchZoomRotate, map.doubleClickZoom, map.keyboard, map.dragRotate, map.touchPitch, map.boxZoom];
    handlers.forEach((h) => h.disable());
    map.addControl(new AttributionControl({ compact: false }), "bottom-left");

    let marker: Marker | null = null;
    let beam: HTMLElement | null = null;
    let meMarker: Marker | null = null;
    const parked: Marker[] = [];
    let alive = true;
    let loaded = false;
    let frame = 0;
    /** What was last put on the map, so nothing is set twice. */
    const shown = { t: -1, drawn: -1, arrived: -1, free: false };

    const routeNow = () => live.current.route;
    const padding = () => {
      const { right, bottom } = live.current.inset;
      return { top: 110, left: 40, right: 40 + right, bottom: 60 + bottom };
    };
    /** On the first screen the words sit bottom-left (below, on a phone): the route keeps to the rest of the picture. */
    const heroPadding = () => {
      const { clientWidth: w, clientHeight: h } = el;
      return w >= 768 ? { top: 130, left: Math.round(w * 0.46), right: 70, bottom: 110 } : { top: 120, left: 36, right: 36, bottom: Math.round(h * 0.5) };
    };
    /** The view that holds the whole route (or the store, or the area): beside the words at the start, clear of the panel at the end. */
    const overview = (hero: boolean) => {
      const r = routeNow();
      const pad = hero ? heroPadding() : padding();
      if (r && r.length > 1) return map.cameraForBounds(bounds(r), { padding: pad, maxZoom: 17.2 }) ?? { center: here, zoom: 16 };
      return map.cameraForBounds(bounds(circle(here, pin ? 220 : 400)), { padding: pad, maxZoom: 16.8 }) ?? { center: here, zoom: 15 };
    };

    const apply = () => {
      frame = requestAnimationFrame(apply);
      if (!loaded) return;
      const t = live.current.time();
      const atEnd = t >= FILM_SECONDS - 0.02;
      // At the end the map is handed to the visitor; as soon as the film moves again it's taken back.
      if (atEnd !== shown.free) {
        shown.free = atEnd;
        handlers.forEach((h) => (atEnd ? h.enable() : h.disable()));
        if (atEnd) map.touchZoomRotate.disableRotation();
        el.parentElement?.setAttribute("data-free", String(atEnd));
      }
      if (t === shown.t) return;
      shown.t = t;
      const f = live.current.plan.frame(t);
      let { center, zoom, pitch, bearing } = f.map;
      if (f.overview > 0) {
        // Pulled back to the whole route: beside the words on the first screen, beside the directions at the end.
        const o = overview(f.scene === "open" || f.scene === "street");
        const oc = (Array.isArray(o.center) ? o.center : here) as LngLat;
        center = [lerp(center[0], oc[0], f.overview), lerp(center[1], oc[1], f.overview)];
        zoom = lerp(zoom, o.zoom ?? 16, f.overview);
        pitch = lerp(pitch, 38, f.overview);
        bearing = lerp(bearing, Math.round(bearing / 360) * 360, f.overview);
      }
      map.jumpTo({ center, zoom, pitch, bearing });

      if (Math.abs(f.drawn - shown.drawn) > 0.0015 || (f.drawn === 1) !== (shown.drawn === 1) || (f.drawn === 0) !== (shown.drawn === 0)) {
        shown.drawn = f.drawn;
        const r = routeNow();
        const drawn = r && r.length > 1 && f.drawn > 0 ? sliceTo(r, f.drawn) : [];
        (map.getSource("route") as GeoJSONSource | undefined)?.setData(line(drawn));
        // The bright head of the line, while it's being drawn.
        (map.getSource("head") as GeoJSONSource | undefined)?.setData(r && f.drawn > 0 && f.drawn < 1 ? point(pointAt(r, f.drawn)) : line([]));
      }
      if (Math.abs(f.arrived - shown.arrived) > 0.004) {
        shown.arrived = f.arrived;
        if (map.getLayer("store-3d")) map.setPaintProperty("store-3d", "fill-extrusion-height", 9 * f.arrived);
        if (map.getLayer("store-glow")) map.setPaintProperty("store-glow", "circle-opacity", 0.5 * f.arrived);
        // Everything else steps back as the store lights.
        if (map.getLayer("city-3d")) map.setPaintProperty("city-3d", "fill-extrusion-opacity", lerp(0.9, 0.5, f.arrived));
        if (beam) beam.style.opacity = String(f.arrived);
        marker?.getElement().classList.toggle("pin-arrived", f.arrived > 0.98);
        if (map.getLayer("soon-fill")) {
          map.setPaintProperty("soon-fill", "fill-opacity", 0.08 * f.arrived);
          map.setPaintProperty("soon-line", "line-opacity", f.arrived);
        }
      }
      parked.forEach((m) => (m.getElement().style.visibility = zoom >= 15 ? "" : "hidden"));
    };

    map.on("load", () => {
      const tier = live.current.tier;
      // Buildings standing up: dark blocks with a little light on their tops, so the tilt has depth.
      const source = Object.keys(map.getStyle().sources)[0];
      const under = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
      map.addLayer(
        {
          id: "city-3d",
          type: "fill-extrusion",
          source,
          "source-layer": "buildings",
          minzoom: tier === 3 ? 13.5 : 14.5,
          paint: {
            "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "height"], 7], 0, "#15171b", 30, "#22262c"],
            "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 15, ["coalesce", ["get", "height"], 7]],
            "fill-extrusion-opacity": 0.9,
            "fill-extrusion-vertical-gradient": true,
          },
        },
        under,
      );

      map.addSource("guide", { type: "geojson", data: line([]) });
      map.addLayer({ id: "guide", type: "line", source: "guide", layout: { "line-cap": "round" }, paint: { "line-color": "#F5F4EF", "line-opacity": 0.7, "line-width": 2, "line-dasharray": [1, 2.5] } });
      // The route: a wide soft glow, a dark edge, the lime line, and a bright head while it's being drawn.
      map.addSource("route", { type: "geojson", data: line([]) });
      map.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MAP_COLOURS.route, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 8, 17, 22], "line-blur": ["interpolate", ["linear"], ["zoom"], 12, 6, 17, 14], "line-opacity": 0.4 } });
      map.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MAP_COLOURS.ground, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 5, 17, 10] } });
      map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MAP_COLOURS.route, "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 17, 5.5] } });
      map.addSource("head", { type: "geojson", data: line([]) });
      map.addLayer({ id: "head-glow", type: "circle", source: "head", paint: { "circle-color": MAP_COLOURS.route, "circle-radius": 22, "circle-blur": 1, "circle-opacity": 0.55, "circle-pitch-alignment": "map" } });
      map.addLayer({ id: "head", type: "circle", source: "head", paint: { "circle-color": "#F5F4EF", "circle-radius": 5, "circle-stroke-color": MAP_COLOURS.route, "circle-stroke-width": 2 } });

      if (pin) {
        // The store: the one light building, on a pool of its own light.
        map.addSource("store", { type: "geojson", data: polygon(footprint(pin)) });
        map.addSource("store-at", { type: "geojson", data: point(here) });
        map.addLayer({ id: "store-glow", type: "circle", source: "store-at", paint: { "circle-color": "#fff1d6", "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 14, 14, 18.5, 150], "circle-blur": 1, "circle-opacity": 0, "circle-pitch-alignment": "map" } }, "route-glow");
        map.addLayer({ id: "store-flat", type: "fill", source: "store", paint: { "fill-color": "#2a2b2f", "fill-outline-color": MAP_COLOURS.route } }, "route-glow");
        map.addLayer({ id: "store-3d", type: "fill-extrusion", source: "store", paint: { "fill-extrusion-color": "#F5F4EF", "fill-extrusion-height": 0, "fill-extrusion-opacity": 1 } });
        // The pin, and over it a thin beam of lime light (an upright element: it stays vertical however the map tilts).
        const holder = document.createElement("div");
        holder.className = "relative";
        beam = document.createElement("span");
        beam.className = "map-beam pointer-events-none absolute bottom-1 left-1/2 block w-[3px] -translate-x-1/2 opacity-0";
        const dot = document.createElement("span");
        dot.className = "map-pin relative block h-4 w-4 rounded-full border-2 border-ink bg-volt";
        dot.setAttribute("data-map-pin", "");
        holder.append(beam, dot);
        marker = new Marker({ element: holder, anchor: "center" }).setLngLat(here).addTo(map);
      } else {
        // Before opening day: the area, not the address.
        map.addSource("soon", { type: "geojson", data: polygon(circle(AREA_CENTRE, 400)) });
        map.addLayer({ id: "soon-fill", type: "fill", source: "soon", paint: { "fill-color": MAP_COLOURS.route, "fill-opacity": 0 } });
        map.addLayer({ id: "soon-line", type: "line", source: "soon", paint: { "line-color": MAP_COLOURS.route, "line-width": 2, "line-dasharray": [2, 2], "line-opacity": 0 } });
      }
      for (const p of live.current.parking ?? []) {
        const mark = document.createElement("span");
        mark.className = "flex h-5 w-5 items-center justify-center rounded-[4px] border border-paper/70 bg-[#0B0C0D] font-mono text-[11px] font-semibold text-paper";
        mark.textContent = "P";
        mark.setAttribute("data-map-parking", p.kind);
        mark.setAttribute("aria-label", p.kind === "bike" ? "Bike parking" : "Car parking");
        parked.push(new Marker({ element: mark }).setLngLat([p.lng, p.lat]).addTo(map));
      }
      loaded = true;
      if (live.current.me) guide(live.current.me);
      map.once("idle", () => alive && live.current.onReady());
      // A slow connection still gets the film: the cloud clears after a few seconds whatever has arrived.
      setTimeout(() => alive && live.current.onReady(), 3500);
    });

    /** A tapped receipt line: the camera goes to where that step ends on the route. Only once the film has ended. */
    const lookAt = (step: number) => {
      const r = routeNow();
      const steps = live.current.steps;
      if (!r || r.length < 2 || !steps[step] || !shown.free) return;
      const last = steps[steps.length - 1].minutes;
      const f = last > 0 ? steps[step].minutes / last : (step + 1) / steps.length;
      map.easeTo({ center: pointAt(r, f), zoom: Math.max(map.getZoom(), 17), padding: padding(), duration: 600, essential: true });
      el.parentElement?.setAttribute("data-look", String(step));
    };

    /** Where the visitor is: a dot, and a dashed straight line from there to where the route begins. */
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
      if (shown.free) map.fitBounds(bounds([from, here, ...(r ?? [])]), { padding: padding(), maxZoom: 17, duration: 600, essential: true });
    };

    const canvas = map.getCanvas();
    const lostNow = () => alive && live.current.onLost();
    canvas.addEventListener("webglcontextlost", lostNow);
    frame = requestAnimationFrame(apply);

    api.current = {
      look: lookAt,
      guide,
      redraw: () => {
        shown.t = -1;
        shown.drawn = -1;
        if (live.current.me) guide(live.current.me);
      },
    };
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      canvas.removeEventListener("webglcontextlost", lostNow);
      api.current = null;
      meMarker?.remove();
      marker?.remove();
      parked.forEach((m) => m.remove());
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is made once per tile set and pin; everything else is read live
  }, [tilesUrl, pin?.lat, pin?.lng]);

  // A different start point, a new place for the visitor, a tapped step: act on the map that's there.
  const routeKey = props.route ? `${props.route.length}:${props.route[0].join(",")}` : "";
  useEffect(() => {
    api.current?.redraw();
  }, [routeKey, props.inset.right, props.inset.bottom]);
  const meKey = me ? me.join(",") : "";
  useEffect(() => {
    api.current?.guide(live.current.me ?? null);
  }, [meKey]);
  const lookSeen = useRef(look?.n ?? 0);
  useEffect(() => {
    if (!look || look.n === lookSeen.current) return;
    lookSeen.current = look.n;
    api.current?.look(look.step);
  }, [look]);

  // MapLibre's own stylesheet makes its container position: relative, so the box that fills the
  // stage is this outer one and the map takes all of it.
  return (
    <div role="region" aria-label={label} className="absolute inset-0">
      <div ref={box} className="h-full w-full" />
    </div>
  );
}
