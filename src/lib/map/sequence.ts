// The "Find us" motion as one timing table (docs/VISIT_PAGE_PLAN.md §6). Pure, so the map, the
// panel and the tests read the same times. Times are in milliseconds from the tap on Find us.

export type SeqMode = "first" | "repeat" | "deeplink" | "chip" | "soon";

export type PhaseName =
  | "rise" // the 3D camera tilts up to look straight down
  | "crossfade" // 3D snapshot → map (an overlay on top of rise and pullout)
  | "pullout" // out to the whole valley
  | "hold" // the valley, still
  | "fly" // to the route
  | "retract" // a chip change: the old line pulls back
  | "draw" // the route draws
  | "settle" // the panel slides in, the map recentres
  | "arrival" // the store extrudes, the pin rings, the total stamps
  | "circle" // soon: a 400 m circle round the area
  | "signup"; // soon: the opening-list sign-up

export type Easing = (t: number) => number;

export interface Phase {
  name: PhaseName;
  start: number;
  end: number;
  ease: Easing;
  /** Overlays (the crossfade) run on top of the camera phases. */
  overlay?: boolean;
}

// ---------- Easings ----------

/** A CSS cubic-bezier(x1, y1, x2, y2) as a function, solved for x by Newton's method then bisection. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const bez = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const slope = (t: number, a: number, b: number) => 3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = slope(t, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      t -= (bez(t, x1, x2) - x) / d;
    }
    if (t < 0 || t > 1 || Math.abs(bez(t, x1, x2) - x) > 1e-4) {
      let [lo, hi] = [0, 1];
      t = x;
      for (let i = 0; i < 30; i++) {
        if (bez(t, x1, x2) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return bez(t, y1, y2);
  };
}

export const linear: Easing = (t) => Math.min(1, Math.max(0, t));
export const inOut = cubicBezier(0.65, 0, 0.35, 1);
export const out = cubicBezier(0.22, 1, 0.36, 1);
export const quart: Easing = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
export const expoOut: Easing = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
/** The step-inside dolly through the door. */
export const dolly = cubicBezier(0.7, 0, 0.3, 1);

/**
 * The route's own pace: speeding up over the first 12 %, steady through the middle, slowing over
 * the last 15 %. Continuous in value and speed, and 0 → 1.
 */
export const drawEase: Easing = (t) => {
  const x = Math.min(1, Math.max(0, t));
  const a = 0.12;
  const b = 0.15;
  // a steady speed v in the middle; quadratic ramps either side, areas chosen so the total is 1
  const v = 1 / (1 - a / 2 - b / 2);
  if (x < a) return (v / (2 * a)) * x * x;
  if (x <= 1 - b) return v * (a / 2) + v * (x - a);
  const r = 1 - x;
  return 1 - (v / (2 * b)) * r * r;
};

// ---------- Durations ----------

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How long the route takes to draw: longer routes a little longer, 1.2 to 2.4 s. */
export const drawDuration = (meters: number) => clamp(900 + 0.3 * meters, 1200, 2400);

export const PANEL_MS = 520;
export const ARRIVAL_MS = 700;

/** The whole table for an entry. `speed` scales every time (?motion=fast uses 0.1). */
export function timeline(mode: SeqMode, meters: number, speed = 1): Phase[] {
  const D = drawDuration(meters);
  const p: Phase[] = [];
  let t = 0;
  const add = (name: PhaseName, ms: number, ease: Easing) => {
    p.push({ name, start: t, end: t + ms, ease });
    t += ms;
  };

  switch (mode) {
    case "first":
      add("rise", 700, inOut);
      p.push({ name: "crossfade", start: 560, end: 800, ease: linear, overlay: true });
      add("pullout", 1000, quart);
      add("hold", 600, linear);
      add("fly", 1000, quart);
      add("draw", D, drawEase);
      add("settle", PANEL_MS, out);
      add("arrival", ARRIVAL_MS, out);
      break;
    case "repeat":
      add("rise", 700, inOut);
      p.push({ name: "crossfade", start: 560, end: 800, ease: linear, overlay: true });
      add("fly", 900, quart);
      add("draw", clamp(D, 1200, 1800), drawEase);
      add("settle", 400, expoOut);
      add("arrival", ARRIVAL_MS, out);
      break;
    case "deeplink":
      // Straight to the route: drawn by 1.2 s, panel in by 1.5 s.
      add("draw", 1200, drawEase);
      add("settle", 300, expoOut);
      add("arrival", ARRIVAL_MS, out);
      break;
    case "chip":
      add("retract", 250, inOut);
      add("draw", clamp(D, 1200, 1800), drawEase);
      add("settle", 400, expoOut);
      break;
    case "soon":
      add("rise", 700, inOut);
      p.push({ name: "crossfade", start: 560, end: 800, ease: linear, overlay: true });
      add("pullout", 1000, quart);
      add("hold", 600, linear);
      add("circle", 500, quart);
      add("signup", 200, out);
      break;
  }
  return p.map((x) => ({ ...x, start: x.start * speed, end: x.end * speed })).sort((a, b) => a.start - b.start);
}

/** When the panel has fully slid in (the end of "settle"), or the sign-up shows for soon. */
export function panelAt(mode: SeqMode, meters: number, speed = 1): number {
  const tl = timeline(mode, meters, speed);
  return (tl.find((x) => x.name === "settle") ?? tl.find((x) => x.name === "signup") ?? tl[tl.length - 1]).end;
}

/** When everything has finished, arrival included. */
export function totalMs(mode: SeqMode, meters: number, speed = 1): number {
  return Math.max(...timeline(mode, meters, speed).map((x) => x.end));
}

/**
 * The camera phase at time `t` (overlays aside), with its raw and eased progress. Before the start
 * it's the first phase at 0; after the end, the last phase at 1.
 */
export function phaseAt(t: number, mode: SeqMode, meters: number, speed = 1): { name: PhaseName; progress: number; eased: number } {
  const camera = timeline(mode, meters, speed).filter((x) => !x.overlay);
  const now = camera.find((x) => t >= x.start && t < x.end) ?? (t < camera[0].start ? camera[0] : camera[camera.length - 1]);
  const progress = now.end === now.start ? 1 : Math.min(1, Math.max(0, (t - now.start) / (now.end - now.start)));
  return { name: now.name, progress, eased: now.ease(progress) };
}

/** How much of the route is drawn at time `t` (0 … 1), eased. */
export function drawnAt(t: number, mode: SeqMode, meters: number, speed = 1): number {
  const tl = timeline(mode, meters, speed);
  const draw = tl.find((x) => x.name === "draw");
  if (!draw) return 0;
  if (t <= draw.start) return 0;
  if (t >= draw.end) return 1;
  return draw.ease((t - draw.start) / (draw.end - draw.start));
}

/** Map zoom that shows the same ground as a camera `heightMeters` up, looking straight down (§6). */
export function zoomForCamera(heightMeters: number, fovDeg: number, viewportHeightPx: number, latitude = 27.68): number {
  const mpp = (2 * heightMeters * Math.tan(((fovDeg / 2) * Math.PI) / 180)) / viewportHeightPx;
  return Math.log2((156_543.03392 * Math.cos((latitude * Math.PI) / 180)) / mpp);
}
