// The easings the Visit film moves with (lib/visit/film.ts): pure functions of 0 … 1.

export type Easing = (t: number) => number;

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

export const inOut = cubicBezier(0.65, 0, 0.35, 1);
export const quart: Easing = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

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
