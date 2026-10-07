// The Visit page's film, as pure maths: one number (the second of the film, 0 … FILM_SECONDS)
// decides everything on screen: where the camera is over the Earth, how thick the clouds are,
// where the map's camera is, how much of the route is drawn, which caption shows. The page's
// scroll position is that number (and "play" just scrolls for you), so the film can be run
// forwards, backwards or held anywhere, and all of it can be tested without a browser.

import { cubicBezier, drawEase, inOut, quart } from "@/lib/map/sequence";
import { distance, lengthMeters, pointAt, type LngLat } from "@/lib/map/route";
import type { RouteStep } from "@/lib/store-state";

export const FILM_SECONDS = 20;

export type SceneId = "orbit" | "approach" | "clouds" | "valley" | "street" | "route" | "door" | "arrive";

/** The scenes, in order, with the second each begins. The film ends at FILM_SECONDS. */
export const SCENES: { id: SceneId; from: number; name: string }[] = [
  { id: "orbit", from: 0, name: "Orbit" },
  { id: "approach", from: 2, name: "Nepal" },
  { id: "clouds", from: 6, name: "Clouds" },
  { id: "valley", from: 7.2, name: "Kathmandu" },
  { id: "street", from: 10, name: "The street" },
  { id: "route", from: 12, name: "The way" },
  { id: "door", from: 17, name: "The door" },
  { id: "arrive", from: 19, name: "Directions" },
];
const START = Object.fromEntries(SCENES.map((s) => [s.id, s.from])) as Record<SceneId, number>;
const END = Object.fromEntries(SCENES.map((s, i) => [s.id, SCENES[i + 1]?.from ?? FILM_SECONDS])) as Record<SceneId, number>;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
/** How far through a scene the film is, 0 … 1. */
const within = (t: number, id: SceneId) => clamp01((t - START[id]) / (END[id] - START[id]));
const soft = cubicBezier(0.45, 0, 0.2, 1);

export function sceneAt(t: number): SceneId {
  let now: SceneId = "orbit";
  for (const s of SCENES) if (t >= s.from) now = s.id;
  return now;
}

/** The second a scene begins (for the rail's buttons and for tests). */
export const sceneStart = (id: SceneId) => START[id];

// ---------- The Earth, from orbit down to the cloud tops ----------

/** Kathmandu, where the camera is heading. */
export const KATHMANDU = { lat: 27.7, lng: 85.32 };
/** Where the camera hangs at the start: south-west of Nepal, so the dive curves in. */
const ORBIT_OVER = { lat: 9, lng: 71 };

export interface EarthView {
  /** The point on the ground the camera is above. */
  over: { lat: number; lng: number };
  /** Distance from the Earth's centre, in Earth radii (1 = on the ground). */
  distance: number;
  /** 0 … 1: how far the picture has moved from "Earth to one side" (the first screen) to "Nepal dead ahead". */
  centred: number;
}

/** The camera over the Earth at second `t` (it stops at the cloud tops; the map takes over below). */
export function earthView(t: number): EarthView {
  const dive = soft(clamp01((t - START.approach) / (END.clouds - START.approach)));
  return {
    over: { lat: lerp(ORBIT_OVER.lat, KATHMANDU.lat, inOut(clamp01(dive * 1.15))), lng: lerp(ORBIT_OVER.lng, KATHMANDU.lng, inOut(clamp01(dive * 1.15))) },
    // Falling: fast at first, slowing as the ground fills the view (the logarithm of the height falls steadily).
    distance: 1 + Math.exp(lerp(Math.log(2.3), Math.log(0.2), dive)),
    centred: inOut(clamp01((t - START.approach) / 2.2)),
  };
}

/** How thick the cloud between the two worlds is, 0 clear … 1 nothing but white. Thickest as the map takes over. */
export function cloudAt(t: number): number {
  const mid = (START.clouds + END.clouds) / 2;
  const up = clamp01((t - (START.clouds - 1.3)) / (mid - (START.clouds - 1.3)));
  const down = clamp01((END.clouds + 0.5 - t) / (END.clouds + 0.5 - mid));
  return inOut(Math.min(up, down));
}

/** The second the Earth gives way to the map (in the thick of the cloud). */
export const HANDOVER = (START.clouds + END.clouds) / 2;

// ---------- The map, from the valley down to the door ----------

export interface MapView {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface Frame {
  scene: SceneId;
  map: MapView;
  /** 0 … 1: how much of the route's line is drawn. */
  drawn: number;
  /** The receipt line the drawn line has reached (-1 before the first). */
  step: number;
  /** 0 … 1: how far the store has stood up and lit. */
  arrived: number;
  /** 0 … 1: how far the camera has pulled back to show the whole route beside the directions. */
  overview: number;
  /** True from the moment the directions should be on screen. */
  panel: boolean;
  /** The line of big type for this moment (null when there is none). */
  caption: string | null;
}

/** Compass bearing from a to b, degrees clockwise from north. */
export function bearingBetween(a: LngLat, b: LngLat): number {
  const [l1, p1, l2, p2] = [a[0], a[1], b[0], b[1]].map((d) => (d * Math.PI) / 180);
  const y = Math.sin(l2 - l1) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** The shortest way round from one bearing to another, as a signed number of degrees. */
const turn = (from: number, to: number) => ((to - from + 540) % 360) - 180;

export interface FilmPlan {
  /** Everything about the map and the words at second `t`. */
  frame: (t: number) => Frame;
  /** The route's length in metres (0 with no route). */
  metres: number;
}

/**
 * The film for one store and one route. `pin` is the door (or the middle of the area before
 * opening day); `route` runs from a start point to the door (or null); `steps` are its receipt lines.
 */
export function planFilm(opts: { pin: LngLat; valley: LngLat; route: LngLat[] | null; steps: RouteStep[]; area: string; hasDoor: boolean }): FilmPlan {
  const { pin, valley, steps, area, hasDoor } = opts;
  const route = opts.route && opts.route.length > 1 ? opts.route : null;
  const metres = route ? lengthMeters(route) : 0;

  // The camera's heading along the route, sampled and smoothed once so it never twitches on a
  // jagged trace: at each point, the direction from a little behind to a good way ahead.
  const N = 120;
  const headings: number[] = [];
  if (route) {
    const ahead = Math.min(0.2, Math.max(0.06, 70 / Math.max(1, metres)));
    let last = bearingBetween(route[0], pointAt(route, ahead));
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const a = pointAt(route, Math.max(0, f - 0.02));
      const b = pointAt(route, Math.min(1, f + ahead));
      const raw = distance(a, b) < 2 ? last : bearingBetween(a, b);
      last += turn(last, raw); // unwrapped: no jump across north
      headings.push(last);
    }
    // a second pass: each heading is the average of its neighbours
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i <= N; i++) headings[i] = (headings[Math.max(0, i - 3)] + headings[i] * 2 + headings[Math.min(N, i + 3)]) / 4;
  }
  const headingAt = (f: number) => {
    if (!route) return 0;
    const x = clamp01(f) * N;
    const i = Math.min(N - 1, Math.floor(x));
    return lerp(headings[i], headings[i + 1], x - i);
  };
  const b0 = headingAt(0);
  const b1 = headingAt(1);
  // Closer for a short walk, further back for a long one.
  const followZoom = route ? Math.min(17.1, Math.max(15.7, 17.2 - Math.log2(Math.max(150, metres) / 300))) : 16;
  // The camera looks a little ahead of the line's head, so it arrives over that spot, not over the very first point.
  const AHEAD = 0.04;
  const begin: LngLat = route ? pointAt(route, AHEAD) : pin;

  const stepAtFraction = (f: number) => {
    if (!steps.length || f <= 0) return -1;
    const last = steps[steps.length - 1].minutes;
    let lit = -1;
    steps.forEach((s, i) => {
      const at = last > 0 ? s.minutes / last : i / Math.max(1, steps.length - 1);
      if (f + 1e-9 >= at) lit = i;
    });
    return lit;
  };

  const frame = (time: number): Frame => {
    const t = Math.min(FILM_SECONDS, Math.max(0, time));
    const scene = sceneAt(t);
    const v = quart(within(t, "valley"));
    const s = soft(within(t, "street"));
    const r = within(t, "route");
    const d = soft(within(t, "door"));
    const a = inOut(within(t, "arrive"));
    const drawn = route ? drawEase(r) : 0;

    // The valley from high up, tipping forward as it comes closer.
    let map: MapView = { center: [lerp(valley[0], begin[0], v), lerp(valley[1], begin[1], v)], zoom: lerp(9.4, 13.2, v), pitch: lerp(0, 46, v), bearing: lerp(b0 - 34, b0 - 12, v) };
    if (t >= START.street) map = { center: begin, zoom: lerp(13.2, followZoom, s), pitch: lerp(46, 58, s), bearing: lerp(b0 - 12, b0, s) };
    if (t >= START.route) {
      // Flying along the line, looking a little ahead of where it's being drawn. With no route, a slow turn round the place.
      map = route ? { center: pointAt(route, Math.min(1, drawn + AHEAD * (1 - drawn))), zoom: followZoom, pitch: 58, bearing: headingAt(drawn) } : { center: pin, zoom: followZoom, pitch: 58, bearing: b0 + r * 50 };
    }
    if (t >= START.door) {
      const from = route ? b1 : b0 + 50;
      map = { center: [lerp(route ? route[route.length - 1][0] : pin[0], pin[0], d), lerp(route ? route[route.length - 1][1] : pin[1], pin[1], d)], zoom: lerp(followZoom, hasDoor ? 18.3 : 15.4, d), pitch: lerp(58, hasDoor ? 62 : 40, d), bearing: from + d * 24 };
    }

    let caption: string | null = null;
    if (scene === "approach") caption = t < 4 ? "Somewhere on Earth." : "Under the mountains.";
    else if (scene === "valley") caption = "In one valley.";
    else if (scene === "street") caption = hasDoor ? "On one street." : `Around ${area}.`;
    else if (scene === "route") caption = route ? (stepAtFraction(drawn) >= 0 ? steps[stepAtFraction(drawn)].text : "Follow the line.") : hasDoor ? "Right here." : `Around ${area}.`;
    else if (scene === "door") caption = hasDoor ? "One door." : "One door. Soon.";

    return {
      scene,
      map,
      drawn: t >= START.door ? (route ? 1 : 0) : drawn,
      step: t >= START.door ? steps.length - 1 : stepAtFraction(drawn),
      arrived: d,
      overview: a,
      panel: t >= START.arrive + 0.15,
      caption,
    };
  };

  return { frame, metres };
}

/** The camera's height above the ground for the little read-out, in metres, over the Earth or over the map. */
export function altitudeMetres(t: number, zoom: number, latitude: number): number {
  if (t < HANDOVER) return (earthView(t).distance - 1) * 6_371_000;
  // What a 36° lens 800 px tall sees at this zoom.
  const metresPerPixel = (156_543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return (metresPerPixel * 800) / (2 * Math.tan((18 * Math.PI) / 180));
}

/** "12,400 KM", "840 M": the height, short enough for a corner of the screen. */
export function altitudeLabel(metres: number): string {
  if (metres >= 10_000) return `${Math.round(metres / 1000 / 10) * 10 >= 1000 ? (Math.round(metres / 100_000) * 100).toLocaleString("en-US") : Math.round(metres / 1000).toLocaleString("en-US")} KM`;
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} KM`;
  return `${Math.max(10, Math.round(metres / 10) * 10)} M`;
}
