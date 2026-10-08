// The Visit page's film, as pure maths: one number (the second of the film, 0 … FILM_SECONDS)
// decides everything on screen: where the map's camera is, how much of the route is drawn, how
// far the store has lit up, which caption shows. The page's scroll position is that number (and
// "play" just scrolls for you), so the film can be run forwards, backwards or held anywhere, and
// all of it can be tested without a browser.
//
// It opens on the whole route, drawn, with the store lit at its end. Then the camera drops to
// where the route begins, flies along it as the line is drawn again step by step, pushes in on
// the door, and pulls back to the whole route beside the directions.

import { cubicBezier, drawEase, inOut } from "@/lib/map/sequence";
import { distance, lengthMeters, pointAt, type LngLat } from "@/lib/map/route";
import type { RouteStep } from "@/lib/store-state";

export const FILM_SECONDS = 13;

export type SceneId = "open" | "street" | "route" | "door" | "arrive";

/** The scenes, in order, with the second each begins. The film ends at FILM_SECONDS. */
export const SCENES: { id: SceneId; from: number; name: string }[] = [
  { id: "open", from: 0, name: "The route" },
  { id: "street", from: 1.5, name: "The start" },
  { id: "route", from: 4, name: "The way" },
  { id: "door", from: 10, name: "The door" },
  { id: "arrive", from: 12, name: "Directions" },
];
const START = Object.fromEntries(SCENES.map((s) => [s.id, s.from])) as Record<SceneId, number>;
const END = Object.fromEntries(SCENES.map((s, i) => [s.id, SCENES[i + 1]?.from ?? FILM_SECONDS])) as Record<SceneId, number>;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
/** How far through a scene the film is, 0 … 1. */
const within = (t: number, id: SceneId) => clamp01((t - START[id]) / (END[id] - START[id]));
const soft = cubicBezier(0.45, 0, 0.2, 1);

export function sceneAt(t: number): SceneId {
  let now: SceneId = "open";
  for (const s of SCENES) if (t >= s.from) now = s.id;
  return now;
}

/** The second a scene begins (for the rail's buttons and for tests). */
export const sceneStart = (id: SceneId) => START[id];

export interface MapView {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface Frame {
  scene: SceneId;
  /** The camera close in (along the route, at the door). */
  map: MapView;
  /** 0 … 1: how far the camera is pulled back to the whole route (1 at the start and at the end). */
  overview: number;
  /** 0 … 1: how much of the route's line is drawn. */
  drawn: number;
  /** The receipt line the drawn line has reached (-1 before the first). */
  step: number;
  /** 0 … 1: how far the store has stood up and lit. */
  arrived: number;
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
export function planFilm(opts: { pin: LngLat; route: LngLat[] | null; steps: RouteStep[]; area: string; hasDoor: boolean }): FilmPlan {
  const { pin, steps, area, hasDoor } = opts;
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
  const last = steps.length - 1;

  const stepAtFraction = (f: number) => {
    if (!steps.length || f <= 0) return -1;
    const end = steps[last].minutes;
    let lit = -1;
    steps.forEach((s, i) => {
      const at = end > 0 ? s.minutes / end : i / Math.max(1, last);
      if (f + 1e-9 >= at) lit = i;
    });
    return lit;
  };

  const frame = (time: number): Frame => {
    const t = Math.min(FILM_SECONDS, Math.max(0, time));
    const scene = sceneAt(t);
    const s = soft(within(t, "street"));
    const r = within(t, "route");
    const d = soft(within(t, "door"));
    const a = inOut(within(t, "arrive"));
    const walked = route ? drawEase(r) : 0;
    const startView: MapView = { center: begin, zoom: followZoom, pitch: 58, bearing: b0 };

    if (scene === "open") return { scene, map: startView, overview: 1, drawn: route ? 1 : 0, step: last, arrived: 1, panel: false, caption: null };
    if (scene === "street") {
      // Down from the whole route to where it begins; the finished line pulls back to its start and the store's light goes down.
      const clear = clamp01(within(t, "street") * 2.2);
      return { scene, map: startView, overview: 1 - s, drawn: route ? 1 - clear : 0, step: clear < 1 ? last : -1, arrived: 1 - clear, panel: false, caption: hasDoor ? (route ? "Start here." : "Right here.") : `Around ${area}.` };
    }
    if (scene === "route") {
      // Flying along the line, looking a little ahead of where it's being drawn. With no route, a slow turn round the place.
      const map: MapView = route ? { center: pointAt(route, Math.min(1, walked + AHEAD * (1 - walked))), zoom: followZoom, pitch: 58, bearing: headingAt(walked) } : { center: pin, zoom: followZoom, pitch: 58, bearing: b0 + r * 50 };
      const lit = stepAtFraction(walked);
      return { scene, map, overview: 0, drawn: walked, step: lit, arrived: 0, panel: false, caption: route ? (lit >= 0 ? steps[lit].text : "Follow the line.") : hasDoor ? "Right here." : `Around ${area}.` };
    }
    // The door: closer and steeper, turning a little round it; then back out to the whole route beside the directions.
    const from = route ? b1 : b0 + 50;
    const end: LngLat = route ? route[route.length - 1] : pin;
    const map: MapView = { center: [lerp(end[0], pin[0], d), lerp(end[1], pin[1], d)], zoom: lerp(followZoom, hasDoor ? 18.3 : 15.4, d), pitch: lerp(58, hasDoor ? 62 : 40, d), bearing: from + d * 24 };
    return { scene, map, overview: scene === "arrive" ? a : 0, drawn: route ? 1 : 0, step: last, arrived: d, panel: t >= START.arrive + 0.15, caption: scene === "door" ? (hasDoor ? "One door." : "One door. Soon.") : null };
  };

  return { frame, metres };
}

/** The camera's height above the ground for the little read-out, in metres, from the map's zoom. */
export function altitudeMetres(zoom: number, latitude: number): number {
  // What a 36° lens 800 px tall sees at this zoom.
  const metresPerPixel = (156_543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return (metresPerPixel * 800) / (2 * Math.tan((18 * Math.PI) / 180));
}

/** "1.8 KM", "460 M": the height, short enough for a corner of the screen. */
export function altitudeLabel(metres: number): string {
  if (metres >= 10_000) return `${Math.round(metres / 1000).toLocaleString("en-US")} KM`;
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} KM`;
  return `${Math.max(10, Math.round(metres / 10) * 10)} M`;
}
