// Routes for "Find us": the line from a start point (a chowk, a bus stop) to the store, as
// [lng, lat] pairs. Pure functions, used by the admin form (to read and check what the owner
// pastes), the map (to draw the line as it plays) and the receipt (which step is lit).

import type { RouteStep, StoreInfo } from "../store-state";

export type LngLat = [number, number];
export type TravelMode = "walk" | "bike" | "car";

/** Metres a minute: one set of speeds for every time shown on the site. */
export const SPEEDS: Record<TravelMode, number> = { walk: 75, bike: 280, car: 360 };

/** What Google Maps calls each mode (it has no bike directions here, so bike drives). */
export const GOOGLE_MODE: Record<TravelMode, "walking" | "driving"> = { walk: "walking", bike: "driving", car: "driving" };

export const LIMITS = {
  textBytes: 200_000,
  rawPoints: 5_000,
  maxPoints: 300,
  simplifyMeters: 3,
  maxJumpMeters: 150,
  minLengthMeters: 30,
  maxLengthMeters: 5_000,
  snapMeters: 30,
} as const;

// ---------- Distances ----------

const EARTH = 6_371_008.8; // metres
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distance(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lengthMeters(coords: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += distance(coords[i - 1], coords[i]);
  return total;
}

/** The point a fraction `f` (0 … 1) of the way along the line, by distance. */
export function pointAt(coords: LngLat[], f: number): LngLat {
  if (coords.length === 0) throw new Error("pointAt: empty line");
  if (coords.length === 1) return coords[0];
  const want = Math.min(1, Math.max(0, f)) * lengthMeters(coords);
  let walked = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = distance(coords[i - 1], coords[i]);
    if (walked + d >= want) {
      const t = d === 0 ? 0 : (want - walked) / d;
      const [a, b] = [coords[i - 1], coords[i]];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    walked += d;
  }
  return coords[coords.length - 1];
}

/** The line up to a fraction `f` of its length (for drawing it as it plays). */
export function sliceTo(coords: LngLat[], f: number): LngLat[] {
  if (coords.length < 2 || f >= 1) return coords;
  const want = Math.max(0, f) * lengthMeters(coords);
  const out: LngLat[] = [coords[0]];
  let walked = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = distance(coords[i - 1], coords[i]);
    if (walked + d >= want) {
      out.push(pointAt([coords[i - 1], coords[i]], d === 0 ? 0 : (want - walked) / d));
      return out;
    }
    out.push(coords[i]);
    walked += d;
  }
  return out;
}

/** [[west, south], [east, north]] */
export function bounds(coords: LngLat[]): [LngLat, LngLat] {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lng, lat] of coords) {
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}

/** Whole minutes for a distance, never less than one. */
export function minutes(meters: number, mode: TravelMode): number {
  return Math.max(1, Math.round(meters / SPEEDS[mode]));
}

/**
 * Which receipt line is lit once the drawn line is a fraction `f` of the way: each step lights
 * when the line reaches its share of the walk (its minutes over the last step's). -1 before the first.
 */
export function stepAt(steps: Pick<RouteStep, "minutes">[], f: number): number {
  if (steps.length === 0) return -1;
  const last = steps[steps.length - 1].minutes;
  let lit = -1;
  steps.forEach((s, i) => {
    const at = last > 0 ? s.minutes / last : i / Math.max(1, steps.length - 1);
    if (f + 1e-9 >= at) lit = i;
  });
  return lit;
}

// ---------- Reading what the owner pastes ----------

type Parsed = { ok: true; coords: LngLat[] } | { ok: false; message: string };

const isLat = (v: number) => v > 26 && v < 31;
const isLng = (v: number) => v > 80 && v < 89;

/** A pair in either order becomes [lng, lat]: in Nepal the two ranges don't overlap. */
function orient(a: number, b: number): LngLat | null {
  if (isLng(a) && isLat(b)) return [a, b];
  if (isLat(a) && isLng(b)) return [b, a];
  return null;
}

function fromGeoJson(value: unknown): number[][] | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown[] };
  if (v.type === "LineString" && Array.isArray(v.coordinates)) return v.coordinates as number[][];
  if (v.type === "MultiLineString" && Array.isArray(v.coordinates)) return (v.coordinates as number[][][]).flat();
  if (v.type === "Feature") return fromGeoJson(v.geometry);
  if (v.type === "FeatureCollection" && Array.isArray(v.features)) {
    for (const f of v.features) {
      const line = fromGeoJson(f);
      if (line) return line;
    }
  }
  return null;
}

/** GeoJSON (a LineString, or a Feature or FeatureCollection with one), GPX track points, or one "lat, lng" per line. */
export function parseRouteText(text: string): Parsed {
  const fail = (message: string): Parsed => ({ ok: false, message });
  const t = text.trim();
  if (!t) return fail("Paste the route: GeoJSON, a GPX file's text, or one \"lat, lng\" per line.");
  if (t.length > LIMITS.textBytes) return fail("That route is too long to read. Export it again with fewer points (under 200 KB).");

  let raw: number[][] = [];
  if (t.startsWith("{")) {
    try {
      raw = fromGeoJson(JSON.parse(t)) ?? [];
    } catch {
      return fail("That looks like GeoJSON but it doesn't read. Copy it again from geojson.io.");
    }
    if (!raw.length) return fail("No line found in that GeoJSON. Draw the route as a line, not points or a shape.");
  } else if (/<trkpt/i.test(t)) {
    for (const m of t.matchAll(/<trkpt\b[^>]*>/gi)) {
      const lat = /lat="([-\d.]+)"/.exec(m[0])?.[1];
      const lon = /lon="([-\d.]+)"/.exec(m[0])?.[1];
      if (lat && lon) raw.push([Number(lon), Number(lat)]);
    }
    if (!raw.length) return fail("No track points found in that GPX.");
  } else {
    for (const line of t.split(/\r?\n/)) {
      const nums = line.split(/[\s,;]+/).filter(Boolean).map(Number);
      if (nums.length === 0) continue;
      if (nums.length !== 2 || nums.some((n) => !Number.isFinite(n))) return fail(`This line doesn't read as "lat, lng": ${line.trim().slice(0, 40)}`);
      raw.push(nums);
    }
  }

  if (raw.length > LIMITS.rawPoints) return fail(`That's ${raw.length.toLocaleString("en-IN")} points; keep it under 5,000.`);
  const coords: LngLat[] = [];
  for (const p of raw) {
    const o = Array.isArray(p) && p.length >= 2 ? orient(Number(p[0]), Number(p[1])) : null;
    if (!o) return fail("Some points aren't in Nepal. Check the numbers (latitude about 27.7, longitude about 85.3).");
    const last = coords[coords.length - 1];
    if (!last || last[0] !== o[0] || last[1] !== o[1]) coords.push(o);
  }
  return { ok: true, coords };
}

// ---------- Simplifying ----------

/** Douglas-Peucker with the tolerance in metres (on a local flat projection, fine at street scale). */
export function simplify(coords: LngLat[], toleranceMeters: number): LngLat[] {
  if (coords.length <= 2) return coords.slice();
  const lat0 = rad(coords[0][1]);
  const xy = coords.map(([lng, lat]) => [rad(lng) * Math.cos(lat0) * EARTH, rad(lat) * EARTH]);
  const keep = new Array<boolean>(coords.length).fill(false);
  keep[0] = keep[coords.length - 1] = true;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const len = Math.hypot(bx - ax, by - ay);
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > toleranceMeters) {
      keep[at] = true;
      stack.push([a, at], [at, b]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

/** The last point becomes the exact store pin if it's within 30 m of it; further away is an error. */
export function snapToPin(coords: LngLat[], pin: { lat: number; lng: number }): { ok: true; coords: LngLat[] } | { ok: false; meters: number } {
  const p: LngLat = [pin.lng, pin.lat];
  const off = distance(coords[coords.length - 1], p);
  if (off > LIMITS.snapMeters) return { ok: false, meters: Math.round(off) };
  return { ok: true, coords: [...coords.slice(0, -1), p] };
}

const round6 = (c: LngLat): LngLat => [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6];

/**
 * The whole pipeline for a pasted route: read it, put every pair in [lng, lat], simplify (3 m),
 * keep it to 300 points, check for gaps and length, and end it exactly on the store pin.
 */
export function prepareRoute(text: string, pin: { lat: number; lng: number } | null): Parsed {
  if (!pin) return { ok: false, message: "Set the store's map pin (latitude and longitude) first: every route has to end there." };
  const parsed = parseRouteText(text);
  if (!parsed.ok) return parsed;
  // Gaps are judged on the trace as pasted: simplifying a straight street leaves long legs on purpose.
  for (let i = 1; i < parsed.coords.length; i++) {
    const gap = distance(parsed.coords[i - 1], parsed.coords[i]);
    if (gap > LIMITS.maxJumpMeters) return { ok: false, message: `There's a ${Math.round(gap)} m jump between two points. Trace the route along the road with no gaps over 150 m.` };
  }

  let tol: number = LIMITS.simplifyMeters;
  let coords = simplify(parsed.coords, tol);
  while (coords.length > LIMITS.maxPoints) {
    tol *= 2;
    coords = simplify(parsed.coords, tol);
  }
  if (coords.length < 2) return { ok: false, message: "A route needs at least two points." };

  const snapped = snapToPin(coords, pin);
  if (!snapped.ok) return { ok: false, message: `The route ends ${snapped.meters} m from the store pin. It has to finish at the store (within 30 m).` };
  coords = snapped.coords.map(round6);
  const len = lengthMeters(coords);
  if (len < LIMITS.minLengthMeters) return { ok: false, message: "That route is shorter than 30 m. Start it somewhere people would come from." };
  if (len > LIMITS.maxLengthMeters) return { ok: false, message: `That route is ${(len / 1000).toFixed(1)} km. Keep it under 5 km.` };
  return { ok: true, coords };
}

// ---------- What the receipt shows ----------

/**
 * The route to show for a start point: its line and steps. With no start points saved yet, the
 * old written route (steps only, no line) stands in, so the page never loses its directions.
 */
export function routeFor(info: Pick<StoreInfo, "startPoints" | "route">, id?: string | null): { name: string | null; coords: LngLat[] | null; steps: RouteStep[] } {
  const start = info.startPoints.find((s) => s.id === id) ?? info.startPoints[0];
  if (start) return { name: start.name, coords: start.coords, steps: start.steps };
  return { name: null, coords: null, steps: info.route };
}
