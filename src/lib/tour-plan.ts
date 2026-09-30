// The virtual tour's store, in metres, and the walk through it. Shared by the 3D scene and the
// page, so the caption you read always matches where the camera is.
//
// Store coordinates: x across (0 = left wall … 5.4 = right wall), z depth from the shutter
// (0 = shutter line … 11 = back wall), y up. The 3D scene maps store z to world −z.
// The layout follows the store plan (5.4 × 11 m); change it here if the fit-out changes.

export const STORE = { width: 5.4, depth: 11, height: 3 } as const;
export const EYE = 1.6;

type V3 = [number, number, number];

/** A camera keyframe: where you stand (x, z at eye height) and what you look at (x, y, z). */
export interface Keyframe {
  at: [number, number];
  look: V3;
}

export const KEYFRAMES: Keyframe[] = [
  { at: [2.7, -6.2], look: [2.7, 2.3, 1] }, // 0 street, facing the shutter
  { at: [2.7, -0.6], look: [2.7, 1.4, 3] }, // 1 at the door
  { at: [2.7, 1.7], look: [4.2, 1.25, 2.3] }, // 2 inside the gate, the greeter's stand
  { at: [3.95, 2.85], look: [4.82, 1.38, 2.23] }, // 3 tee wall, a hang tag up close
  { at: [3.7, 5.6], look: [5.3, 1.45, 6.0] }, // 4 hoodies
  { at: [3.7, 6.9], look: [4.3, 1.3, 9.9] }, // 5 towards the fitting rooms
  { at: [3.3, 8.15], look: [4.2, 1.6, 10.1] }, // 6 fitting rooms, a step back to see both
  { at: [1.8, 8.0], look: [1.2, 1.3, 5.0] }, // 7 turning back, round the tables
  { at: [1.95, 5.3], look: [1.1, 1.2, 3.9] }, // 8 approaching the kiosk
  { at: [2.3, 3.9], look: [1.3, 1.22, 3.9] }, // 9 at the kiosk, screen at eye level
  { at: [2.55, 2.55], look: [0.8, 1.05, 2.3] }, // 10 pickup counter
  { at: [2.7, 1.3], look: [2.7, 1.5, -4] }, // 11 through the gate, out to the street
];

export type TourZone = "street" | "enter" | "pick" | "try" | "pay" | "pickup" | "out";

export interface TourStopCopy {
  id: TourZone;
  /** Keyframe the camera rests on while this stop's caption is up. */
  frame: number;
  /** Zone sign number, e.g. "01". */
  sign: string;
  title: string;
  /** The Devanagari line under the title. (Have a native speaker check before launch.) */
  ne: string;
  body: string;
  /** "Worried about…" answers shown under the body. */
  worry?: { q: string; a: string };
}

/** The walk: seven stops, in the order you walk them. Copy matches /how-it-works. */
export const TOUR_STOPS: TourStopCopy[] = [
  {
    id: "street",
    frame: 0,
    sign: "00",
    title: "Aaunus.",
    ne: "आउनुस्।",
    body: "A black shutter, a lime dot. Scroll to walk in.",
  },
  {
    id: "enter",
    frame: 2,
    sign: "00",
    title: "Just looking? Perfect.",
    ne: "आरामले हेर्नुस्।",
    body: "The greeter says hi. There's a three-step picture guide by the door. Nobody follows you around.",
  },
  {
    id: "pick",
    frame: 3,
    sign: "01",
    title: "Pick it.",
    ne: "मोलमोलाइ छैन।",
    body: "Every tag shows the fixed price and the measurements in cm. Same price in store and online, VAT included.",
    worry: { q: "Not sure of your size?", a: "Compare the cm on the tag with a piece you already own, or ask the helper." },
  },
  {
    id: "try",
    frame: 6,
    sign: "02",
    title: "Try it on.",
    ne: "टोकन लिनुस्।",
    body: "The helper gives you a numbered token for the pieces you take in, and counts them out again. Take your time.",
    worry: { q: "Wrong size?", a: "Wave at the helper. They'll bring the next one. Exchanges within 7 days, too." },
  },
  {
    id: "pay",
    frame: 9,
    sign: "03",
    title: "Pay it.",
    ne: "स्क्यान गर्नुस्, सकियो।",
    body: "Drop your pieces in the kiosk's tray. It lists them and shows a QR. Scan with eSewa. No queue.",
    worry: { q: "No eSewa?", a: "The kiosk takes QR payments only. If you need to pay another way, ask the helper." },
  },
  {
    id: "pickup",
    frame: 10,
    sign: "04",
    title: "Ordered online?",
    ne: "अनलाइन अर्डर यहीँ।",
    body: "Your bag waits at the pickup counter. Show your order number or the SMS. Pickup is free.",
  },
  {
    id: "out",
    frame: 11,
    sign: "05",
    title: "Wear it.",
    ne: "टिप्नुस्। तिर्नुस्। लगाउनुस्।",
    body: "Your bill comes by SMS or print. Walk out.",
    worry: { q: "What if the gate beeps?", a: "Usually a tag was missed at the kiosk. The greeter asks you to step back, checks your bill and fixes it. It takes a minute." },
  },
];

/** How much of each stop's scroll the camera stays still (the rest is walking to the next). */
export const DWELL = 0.45;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Smooth start and stop for each walk between stops. */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Tour progress (0–1 over the whole walk) → position along the keyframes (0 … KEYFRAMES.length−1),
 * resting on each stop's keyframe for the first part of its share of the scroll.
 */
export function pathPosition(progress: number, stops = TOUR_STOPS): number {
  const n = stops.length;
  const p = clamp01(progress) * n;
  const i = Math.min(Math.floor(p), n - 1);
  const f = p - i;
  const from = stops[i].frame;
  if (i === n - 1 || f <= DWELL) return from;
  return from + (stops[i + 1].frame - from) * ease((f - DWELL) / (1 - DWELL));
}

/** Which stop's caption belongs to this progress. */
export const stopIndexAt = (progress: number, n = TOUR_STOPS.length) => Math.min(Math.floor(clamp01(progress) * n), n - 1);

/** The shutter rolls up as you walk from the street to the door (0 = down, 1 = up). */
export const shutterOpen = (pathPos: number) => clamp01((pathPos - 0.1) / 0.75);
