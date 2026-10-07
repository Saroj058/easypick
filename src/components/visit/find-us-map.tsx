"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { AttributionControl, Map as MapLibre, Marker, addProtocol, setWorkerUrl } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";

import { bounds, type LngLat } from "@/lib/map/route";
import { MAP_COLOURS, mapStyle } from "@/lib/map/style";
import { VALLEY } from "@/lib/map/tiles";
import type { MapState } from "./visit-stage";

// The Find us map: MapLibre drawing our own Kathmandu tiles (a PMTiles file, read in pieces
// straight from storage) in the site's dark style, with the route in lime and the store's pin.
// Loaded only by visit-stage.tsx, and only after the 3D store's canvas has gone (one WebGL
// context at a time). The camera moves of the full sequence arrive in Phase 4.

// Once for the page: the worker is our own copy (same origin, so the CSP needs no blob: workers),
// and "pmtiles://" requests are answered from the one file.
let prepared = false;
function prepare() {
  if (prepared) return;
  prepared = true;
  setWorkerUrl("/map/maplibre-gl-worker.mjs");
  addProtocol("pmtiles", new Protocol().tile);
}

export interface FindUsMapProps {
  tilesUrl: string;
  /** The store. Null before opening day: the map then shows the valley, with no pin. */
  pin: { lat: number; lng: number } | null;
  /** The route to draw, ending at the pin. */
  route: LngLat[] | null;
  /** Read out for the map region, e.g. "Map: route from Jhamsikhel Chowk to Easypick". */
  label: string;
  onState: (state: MapState) => void;
}

export default function FindUsMap({ tilesUrl, pin, route, label, onState }: FindUsMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const routeKey = route ? `${route.length}:${route[0].join(",")}:${route[route.length - 1].join(",")}` : "";

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    prepare();
    onState("loading");

    const view = route && route.length > 1 ? bounds(route) : pin ? ([[pin.lng - 0.004, pin.lat - 0.003], [pin.lng + 0.004, pin.lat + 0.003]] as [LngLat, LngLat]) : VALLEY;
    const map = new MapLibre({
      container: el,
      style: mapStyle(tilesUrl),
      bounds: view,
      fitBoundsOptions: { padding: { top: 120, bottom: 120, left: 48, right: 48 }, maxZoom: 17 },
      minZoom: 9,
      maxZoom: 18.5,
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
    map.addControl(new AttributionControl({ compact: false }), "bottom-right");

    let marker: Marker | null = null;
    map.on("load", () => {
      if (route && route.length > 1) {
        map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } } });
        map.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MAP_COLOURS.ground, "line-width": 8 } });
        map.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": MAP_COLOURS.route, "line-width": 4 } });
      }
      if (pin) {
        const dot = document.createElement("span");
        dot.className = "block h-4 w-4 rounded-full border-2 border-ink bg-volt shadow-[0_0_0_4px_rgba(198,255,61,0.25)]";
        dot.setAttribute("data-map-pin", "");
        marker = new Marker({ element: dot }).setLngLat([pin.lng, pin.lat]).addTo(map);
      }
      onState("ready");
    });

    return () => {
      marker?.remove();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `routeKey` stands for the route; onState is stable
  }, [tilesUrl, pin?.lat, pin?.lng, routeKey]);

  // MapLibre's own stylesheet makes its container position: relative, so the box that fills the
  // stage is this outer one and the map takes all of it.
  return (
    <div role="region" aria-label={label} className="absolute inset-0">
      <div ref={box} className="h-full w-full" />
    </div>
  );
}
