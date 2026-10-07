// The Find us map's look: the Protomaps "black" flavour with Easypick's colours. Dark ground,
// roads as the only structure, lime kept for our own route and pin (drawn by the map component,
// not here). No points of interest and no sprite; labels only for places and main roads.

import { layers, namedFlavor } from "@protomaps/basemaps";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

import { ATTRIBUTION } from "./tiles";

export const MAP_COLOURS = {
  ground: "#0B0C0D",
  water: "#14181d",
  green: "#0f1310",
  building: "#17181a",
  /** Side streets: just visible. */
  minor: "#2b2e32",
  /** Main roads: at least this light on the ground, so the route has something to follow (contrast, plan §7). */
  major: "#5A5F64",
  highway: "#6c7178",
  rail: "#2a2c30",
  label: "#c9c8c2",
  labelSoft: "#8e8e93",
  halo: "#0B0C0D",
  route: "#c6ff3d",
} as const;

const C = MAP_COLOURS;

/** Layers kept from the basemap's labels: place names and main road names only. */
const KEEP_LABELS = new Set(["places_subplace", "places_locality", "places_region", "roads_labels_major"]);

export function mapStyle(tilesUrl: string): StyleSpecification {
  const flavour = {
    ...namedFlavor("black"),
    background: C.ground,
    earth: C.ground,
    water: C.water,
    park_a: C.green,
    park_b: C.green,
    wood_a: C.green,
    wood_b: C.green,
    scrub_a: C.green,
    scrub_b: C.green,
    hospital: C.ground,
    industrial: C.ground,
    school: C.ground,
    pedestrian: C.ground,
    aerodrome: "#101214",
    buildings: C.building,
    other: C.minor,
    minor_service: C.minor,
    minor_a: C.minor,
    minor_b: C.minor,
    link: C.major,
    major: C.major,
    highway: C.highway,
    railway: C.rail,
    bridges_other: C.minor,
    bridges_minor: C.minor,
    bridges_link: C.major,
    bridges_major: C.major,
    bridges_highway: C.highway,
    tunnel_other: C.minor,
    tunnel_minor: C.minor,
    tunnel_link: C.minor,
    tunnel_major: C.minor,
    tunnel_highway: C.minor,
    roads_label_major: C.label,
    roads_label_major_halo: C.halo,
    city_label: C.label,
    city_label_halo: C.halo,
    subplace_label: C.labelSoft,
    subplace_label_halo: C.halo,
    state_label: C.labelSoft,
    state_label_halo: C.halo,
  };

  const kept = layers("protomaps", flavour, { lang: "en" })
    .filter((l) => l.type !== "symbol" || KEEP_LABELS.has(l.id))
    .map((l): LayerSpecification => {
      if (l.type !== "symbol") return l;
      // No sprite: drop any icon. Only two faces are hosted (Regular, Medium), so italics fall back to Regular.
      const layout = { ...(l.layout ?? {}) } as Record<string, unknown>;
      delete layout["icon-image"];
      layout["text-font"] = l.id === "places_locality" ? ["Noto Sans Medium"] : ["Noto Sans Regular"];
      return { ...l, layout } as LayerSpecification;
    });

  return {
    version: 8,
    glyphs: "/map/fonts/{fontstack}/{range}.pbf",
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${tilesUrl}`,
        // The data stops at zoom 15; MapLibre stretches those tiles for closer views.
        maxzoom: 15,
        attribution: ATTRIBUTION,
      },
    },
    layers: kept,
  };
}
