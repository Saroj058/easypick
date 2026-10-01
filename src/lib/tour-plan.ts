// The virtual tour's store, in metres, and the film that walks through it. Shared by the 3D scene
// and the player, so the caption always matches where the camera is.
//
// Store coordinates: x across (0 = left wall … 5.4 = right wall), z depth from the shutter
// (0 = shutter line … 11 = back wall), y up. The 3D scene maps store z to world −z.
// The layout follows the store plan (5.4 × 11 m); change it here if the fit-out changes.
//
// The tour is a film on a clock: everything that moves (the camera, the shutter, the curtain,
// the kiosk screen, the gate) is a pure function of the time in seconds, so pausing, seeking
// and replaying only ever write one number.

export const STORE = { width: 5.4, depth: 11, height: 3 } as const;

type V3 = [number, number, number];

/** A camera keyframe: where you stand, what you look at, and when you get there. */
export interface Keyframe {
  /** Standing point (x, z). */
  at: [number, number];
  /** Eye height in metres. */
  y: number;
  look: V3;
  /** Lens: above 1 is tighter (close-ups), below 1 wider. */
  zoom: number;
  /** Second of the film at which the camera arrives here. */
  t: number;
  /** Seconds it rests here before moving on. */
  hold?: number;
}

/** Shot 1: the walk, from the street, round the store and out through the gate. */
const WALK: Keyframe[] = [
  { at: [2.7, -7.0], y: 1.5, look: [2.7, 2.4, 0], zoom: 1, t: 0 }, // street, the shutter down
  { at: [2.7, -3.6], y: 1.5, look: [2.7, 1.9, 1], zoom: 1, t: 5 }, // push in as it rolls up
  { at: [2.7, -0.4], y: 1.55, look: [2.7, 1.4, 4.5], zoom: 1, t: 8 }, // the door
  { at: [2.8, 2.0], y: 1.55, look: [4.1, 1.2, 1.9], zoom: 1, t: 10.5, hold: 1.5 }, // inside the gate, the greeter's stand
  { at: [4.29, 2.49], y: 1.38, look: [4.78, 1.33, 2.25], zoom: 1.25, t: 14.5, hold: 3 }, // a hang tag, close
  { at: [3.8, 5.3], y: 1.55, look: [5.1, 1.5, 6.6], zoom: 1, t: 21 }, // along the hoodies
  { at: [3.75, 7.3], y: 1.55, look: [4.0, 1.6, 10.0], zoom: 1, t: 23.5 }, // the fitting rooms come into view
  { at: [3.5, 8.0], y: 1.55, look: [3.95, 1.6, 10.3], zoom: 1, t: 26, hold: 3 }, // both fitting rooms, a step back
  { at: [2.6, 8.45], y: 1.55, look: [0.15, 1.4, 7.5], zoom: 0.95, t: 31.5 }, // turning back past the caps
  { at: [1.75, 7.4], y: 1.55, look: [1.3, 1.3, 3.9], zoom: 1, t: 33.5 }, // down the left aisle
  { at: [1.8, 5.4], y: 1.5, look: [1.45, 1.28, 3.9], zoom: 1, t: 36 }, // approaching the kiosk
  { at: [2.22, 3.9], y: 1.32, look: [1.465, 1.28, 3.9], zoom: 1.15, t: 38.5, hold: 3.5 }, // the kiosk screen, square on
  { at: [2.5, 2.7], y: 1.5, look: [1.2, 1.15, 2.2], zoom: 1, t: 44, hold: 1.5 }, // pickup counter
  { at: [2.7, 1.7], y: 1.55, look: [2.7, 1.45, -4], zoom: 1, t: 47.3 }, // through the gate
  { at: [2.7, -1.6], y: 1.55, look: [2.7, 1.8, -10], zoom: 1, t: 50.3 }, // out to the street
];
/** Shot 2: one cut, to the storefront from across the pavement. Its last frame is the still the film ends on. */
const BOOKEND: Keyframe[] = [
  { at: [2.7, -5.2], y: 1.5, look: [2.7, 2.6, 0], zoom: 1, t: 50.3 },
  { at: [2.7, -7.0], y: 1.5, look: [2.7, 2.4, 0], zoom: 1, t: 55 },
];
export const SHOTS: Keyframe[][] = [WALK, BOOKEND];
/** The cut between the two shots, and the film's length, in seconds. */
export const CUT = 50.3;
export const DURATION = 55;

export type TourZone = "street" | "enter" | "pick" | "try" | "pay" | "pickup" | "out";

export interface TourStop {
  id: TourZone;
  /** The chapter's name on its button. */
  name: string;
  /** The one line shown while this chapter plays. */
  caption: string;
  /** A sentence for screen readers, since the scene itself can't be read. */
  says: string;
  /** Second at which the chapter starts (jumping to it plays from here). */
  from: number;
  /** A second that shows the chapter at rest, for people who have motion turned off. */
  still: number;
}

/** The film's seven chapters, in order. */
export const TOUR_STOPS: TourStop[] = [
  { id: "street", name: "Street", caption: "Shutter up. Walk in.", says: "The shutter rolls up on the storefront.", from: 0, still: 5 },
  { id: "enter", name: "Enter", caption: "Just looking? Perfect.", says: "Inside the door. Nobody follows you around.", from: 8, still: 11.2 },
  { id: "pick", name: "Pick", caption: "Fixed price. Size in cm.", says: "Every hang tag shows the fixed price and the measurements in centimetres.", from: 12.2, still: 16.5 },
  { id: "try", name: "Try", caption: "Take a token. Try it.", says: "The fitting rooms. The helper gives you a numbered token.", from: 21, still: 26.4 },
  { id: "pay", name: "Pay", caption: "Scan with eSewa. No queue.", says: "The self-checkout kiosk lists your pieces and shows a QR to pay with eSewa.", from: 31.5, still: 40.4 },
  { id: "pickup", name: "Pickup", caption: "Ordered online? Collect here.", says: "The pickup counter, where online orders wait.", from: 42.4, still: 45 },
  { id: "out", name: "Out", caption: "Pick it. Pay it. Wear it.", says: "Through the gate and out to the street.", from: 46, still: DURATION },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 0 → 1 between two seconds, eased at both ends. */
const ramp = (t: number, from: number, to: number) => {
  const s = clamp01((t - from) / (to - from));
  return s * s * (3 - 2 * s);
};

/** Which chapter this second belongs to. */
export function stopIndexAt(t: number, stops = TOUR_STOPS): number {
  let i = 0;
  for (let n = 1; n < stops.length; n++) if (t >= stops[n].from) i = n;
  return i;
}

// ---------- The camera's timing ----------
// Each shot's keyframes are passed through at their times, resting where there is a hold. The
// position along the keyframes is a monotone cubic through (time, keyframe number), so the walk
// has no jerks at the keyframes and comes to rest and sets off gently at each hold.

interface Timing {
  xs: number[];
  ys: number[];
  ms: number[];
}

function timing(frames: Keyframe[]): Timing {
  const xs: number[] = [];
  const ys: number[] = [];
  frames.forEach((k, i) => {
    xs.push(k.t);
    ys.push(i);
    if (k.hold) {
      xs.push(k.t + k.hold);
      ys.push(i);
    }
  });
  const n = xs.length;
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  // Tangents: zero at both ends and at rests; otherwise the mean of the slopes either side, limited so it never overshoots.
  const ms = xs.map((_, i) => (i === 0 || i === n - 1 || d[i - 1] === 0 || d[i] === 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) continue;
    const a = ms[i] / d[i];
    const b = ms[i + 1] / d[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      ms[i] = (3 * a * d[i]) / h;
      ms[i + 1] = (3 * b * d[i]) / h;
    }
  }
  return { xs, ys, ms };
}

const TIMINGS = SHOTS.map(timing);

function at(tm: Timing, t: number): number {
  const { xs, ys, ms } = tm;
  if (t <= xs[0]) return ys[0];
  const last = xs.length - 1;
  if (t >= xs[last]) return ys[last];
  let i = 0;
  while (t > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i];
  const s = (t - xs[i]) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * ms[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * ms[i + 1];
}

/** Where the camera is at this second: which shot, and how far along that shot's keyframes. */
export function pathAt(t: number): { shot: number; f: number } {
  const shot = t >= CUT ? 1 : 0;
  return { shot, f: at(TIMINGS[shot], Math.min(Math.max(t, 0), DURATION)) };
}

// ---------- What else moves, each as a function of the second ----------

/** The shutter: 0 down, 1 rolled up. It rises under the opening push-in and stays up. */
export const shutterOpen = (t: number) => ramp(t, 0.6, 4.6);
/** The hang tag swings round to face you as you step up to it (0 → 1). */
export const tagTurn = (t: number) => ramp(t, 12.6, 14.4);
/** The fitting room's curtain: 0 drawn aside, 1 closed. Someone goes in, then comes out. */
export const curtainClosed = (t: number) => ramp(t, 26.3, 27.3) - ramp(t, 28.6, 29.6);
/** Two pieces drop into the kiosk's tray as you walk up to it, one after the other (each 0 in the air → 1 in the tray). */
export const trayDrop = (t: number): [number, number] => [ramp(t, 37.2, 37.7), ramp(t, 38.0, 38.5)];
/** The kiosk's screen: 0 waiting, 1 first piece listed, 2 both with the total and the QR, 3 paid. */
export const kioskState = (t: number): 0 | 1 | 2 | 3 => (t < 37.7 ? 0 : t < 38.6 ? 1 : t < 41 ? 2 : 3);
/** The bag on the pickup counter slides forward (0 → 1). */
export const bagForward = (t: number) => ramp(t, 44.2, 45.1);
/** The exit gate's light: 0 white, 1 green, as you walk through with a paid bag. */
export const gateGreen = (t: number) => ramp(t, 46.6, 47.2);
/** The dip to black around the one cut (0 clear … 1 black). */
export const dip = (t: number) => clamp01(1 - Math.abs(t - CUT) / 0.45);
