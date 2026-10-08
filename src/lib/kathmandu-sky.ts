// The real sky over Kathmandu, worked out from the clock: how high the sun is, and from that how
// much daylight there is. The Visit page lights its 3D store with it, so the picture on screen is
// the hour it actually is at the store. Pure maths (the usual low-precision solar position
// formulas, good to about a degree), so the server and the browser agree and it can be tested.

/** Kathmandu, the valley floor. */
const LAT = 27.7;
const LNG = 85.32;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (lo: number, hi: number, v: number) => {
  const t = clamp01((v - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};

/** The sun's height above Kathmandu's horizon, in degrees (negative at night), and whether it's still climbing. */
export function sunOverKathmandu(now: Date): { elevation: number; rising: boolean } {
  // Days since the J2000 epoch, in UTC.
  const d = now.getTime() / 86_400_000 - 10957.5;
  const meanLng = rad((280.46 + 0.9856474 * d) % 360);
  const anomaly = rad((357.528 + 0.9856003 * d) % 360);
  const ecliptic = meanLng + rad(1.915) * Math.sin(anomaly) + rad(0.02) * Math.sin(2 * anomaly);
  const tilt = rad(23.439 - 0.0000004 * d);
  const declination = Math.asin(Math.sin(tilt) * Math.sin(ecliptic));
  const rightAscension = Math.atan2(Math.cos(tilt) * Math.sin(ecliptic), Math.cos(ecliptic));
  // Sidereal time at Greenwich, then the sun's hour angle over Kathmandu.
  const gmst = rad((280.46061837 + 360.98564736629 * d) % 360);
  let hour = gmst + rad(LNG) - rightAscension;
  hour = ((((hour + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI; // −π … π, 0 at solar noon
  const elevation = deg(Math.asin(Math.sin(rad(LAT)) * Math.sin(declination) + Math.cos(rad(LAT)) * Math.cos(declination) * Math.cos(hour)));
  return { elevation, rising: hour < 0 };
}

export type SkyPhase = "night" | "dawn" | "day" | "dusk";

export interface Sky {
  /** Degrees above the horizon. */
  elevation: number;
  /** 0 full night … 1 full daylight, easing through twilight. */
  day: number;
  /** 0 … 1: how much of the low sun's warm colour is in the sky (peaks as it crosses the horizon). */
  glow: number;
  /** Which of the four pictures of the store this hour is nearest to. */
  phase: SkyPhase;
}

/** The sky over Kathmandu at this moment. */
export function skyOverKathmandu(now: Date): Sky {
  const { elevation, rising } = sunOverKathmandu(now);
  const day = smooth(-7, 9, elevation);
  const glow = clamp01(1 - Math.abs(elevation - 1) / 9);
  const phase: SkyPhase = elevation < -5 ? "night" : elevation > 8 ? "day" : rising ? "dawn" : "dusk";
  return { elevation, day, glow, phase };
}

const clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "19:42": the time on a clock in Kathmandu. */
export function kathmanduClock(now: Date): string {
  return clockFmt.format(now);
}

