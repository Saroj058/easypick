// The store's details and "is it open?", worked out in Kathmandu time. Pure functions, so the
// Visit page, the footer card and the tests all agree. The details are set in /admin/store
// (lib/store-info.ts); site.ts gives the defaults until then.

import { site } from "./site";

export interface DayHours {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  open: string; // "11:00"
  close: string; // "20:00"
  closed?: boolean;
}

export interface SpecialDay {
  /** yyyy-mm-dd, Kathmandu */
  date: string;
  closed: boolean;
  open?: string;
  close?: string;
  /** Shown on the site, e.g. "Closed for Tika". */
  note: string;
}

export interface RouteStep {
  text: string;
  minutes: number;
}

/** A place people come from (a chowk, a bus stop) and the line from it to the store. */
export interface StartPoint {
  /** ^[a-z0-9-]{1,24}$, e.g. "chowk" */
  id: string;
  /** Up to 40 characters, e.g. "Jhamsikhel Chowk". */
  name: string;
  /** [lng, lat], 6 decimals, 2 to 300 points; the last one is the store pin. */
  coords: [number, number][];
  /** Up to 6 receipt lines. */
  steps: RouteStep[];
}

export interface ParkingSpot {
  kind: "bike" | "car";
  lng: number;
  lat: number;
}

export interface StoreInfo {
  /** The owner's opening-day switch. Until it's on, the public page shows "Coming soon". */
  opened: boolean;
  /** yyyy-mm-dd, for "Opening February 2027" and the countdown. */
  openingDate: string | null;
  area: string;
  address: string | null;
  landmark: string | null;
  mapUrl: string | null;
  geo: { lat: number; lng: number } | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  hours: DayHours[];
  special: SpecialDay[];
  /** One line for the Visit page, e.g. "Closed for Tika, back on Oct 14". */
  notice: string;
  /** Walking directions by landmark, for the route receipt. Used when there are no start points. */
  route: RouteStep[];
  /** Up to 6; the first is the default on the map. */
  startPoints: StartPoint[];
  /** A photo of the entrance, for the arrival card. */
  entrancePhoto: string | null;
  parkingSpots: ParkingSpot[];
  transport: string;
  parking: string;
  access: string;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DEFAULT_STORE: StoreInfo = {
  opened: false,
  openingDate: null,
  area: site.store.area,
  address: site.store.address,
  landmark: site.store.landmark,
  mapUrl: site.store.mapUrl,
  geo: site.store.geo,
  phone: site.store.phone,
  whatsapp: site.store.whatsapp,
  email: null,
  instagram: null,
  hours: DAY_NAMES.map((_, day) => ({ day, open: site.store.hours.open, close: site.store.hours.close, closed: !(site.store.openDays as readonly number[]).includes(day) })),
  special: [],
  notice: "",
  route: [],
  startPoints: [],
  entrancePhoto: null,
  parkingSpots: [],
  transport: "",
  parking: "",
  access: "",
};

// ---------- Sample data for the preview ----------
// The sample pin is a made-up spot in Jhamsikhel, not the store (the real address stays out of
// this public repo until opening day). Every sample place says "(sample)".

const SAMPLE_PIN = { lat: 27.6781, lng: 85.3052 };

/** A line through the waypoints with a point at least every 70 m, like a traced route. */
function sampleLine(...waypoints: [number, number][]): [number, number][] {
  const out: [number, number][] = [waypoints[0]];
  for (let i = 1; i < waypoints.length; i++) {
    const [a, b] = [waypoints[i - 1], waypoints[i]];
    const metres = Math.hypot((b[0] - a[0]) * 98_600, (b[1] - a[1]) * 110_900);
    const n = Math.max(1, Math.ceil(metres / 70));
    for (let k = 1; k <= n; k++) out.push([Number((a[0] + ((b[0] - a[0]) * k) / n).toFixed(6)), Number((a[1] + ((b[1] - a[1]) * k) / n).toFixed(6))]);
  }
  return out;
}
const PIN: [number, number] = [SAMPLE_PIN.lng, SAMPLE_PIN.lat];

const SAMPLE_START_POINTS: StartPoint[] = [
  {
    id: "chowk",
    name: "Jhamsikhel Chowk (sample)",
    coords: sampleLine([85.307, 27.68], [85.3054, 27.6797], PIN),
    steps: [
      { text: "Jhamsikhel Chowk", minutes: 0 },
      { text: "West, past the café row", minutes: 2 },
      { text: "Black shutter, lime dot", minutes: 4 },
    ],
  },
  {
    id: "sanepa",
    name: "Sanepa Chowk (sample)",
    coords: sampleLine([85.3045, 27.684], [85.305, 27.68], PIN),
    steps: [
      { text: "Sanepa Chowk", minutes: 0 },
      { text: "South on the main road", minutes: 5 },
      { text: "Black shutter, lime dot", minutes: 9 },
    ],
  },
  {
    id: "pulchowk",
    name: "Pulchowk (sample)",
    coords: sampleLine([85.313, 27.679], [85.3058, 27.679], PIN),
    steps: [
      { text: "Pulchowk bus stop", minutes: 0 },
      { text: "West towards Jhamsikhel", minutes: 6 },
      { text: "Black shutter, lime dot", minutes: 11 },
    ],
  },
  {
    id: "kupondole",
    name: "Kupondole (sample)",
    coords: sampleLine([85.312, 27.686], [85.308, 27.6815], PIN),
    steps: [
      { text: "Kupondole Height", minutes: 0 },
      { text: "Down to Jhamsikhel Road", minutes: 7 },
      { text: "Black shutter, lime dot", minutes: 14 },
    ],
  },
];

/** What /visit?preview=open shows for demos while the real details aren't in yet. Never public. */
export const SAMPLE_STORE: Partial<StoreInfo> = {
  area: "Jhamsikhel, Lalitpur",
  address: "Jhamsikhel Road, Lalitpur (sample)",
  landmark: "Black shutter with a lime dot, near Jhamsikhel Chowk",
  route: [
    { text: "Jhamsikhel Chowk", minutes: 0 },
    { text: "Towards Sanepa, 2nd left", minutes: 2 },
    { text: "Black shutter, lime dot", minutes: 3 },
  ],
  transport: "Micro and tempo stop at Jhamsikhel Chowk, 3 minutes' walk.",
  parking: "Free bike parking outside. Car parking a 2-minute walk away.",
  access: "Step-free entrance and wide aisles. Our helper can bring pieces to you.",
  geo: SAMPLE_PIN,
  startPoints: SAMPLE_START_POINTS,
  parkingSpots: [
    { kind: "bike", lng: 85.30535, lat: 27.67798 },
    { kind: "car", lng: 85.3061, lat: 27.6774 },
  ],
};

// ---------- Kathmandu time ----------

const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" });
const partsFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kathmandu", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function ktmNow(now: Date) {
  const parts = partsFmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    date: ymdFmt.format(now),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** "20:00" → "8 PM", "10:30" → "10:30 AM" */
export function hourLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

/** The hours for one Kathmandu day, special days first. Null = closed. */
export function hoursOn(info: StoreInfo, ymd: string): { open: string; close: string; note?: string } | null {
  const special = info.special.find((s) => s.date === ymd);
  if (special) return special.closed || !special.open || !special.close ? null : { open: special.open, close: special.close, note: special.note };
  const h = info.hours.find((x) => x.day === weekdayOf(ymd));
  return !h || h.closed ? null : { open: h.open, close: h.close };
}

// ---------- The state ----------

export type StoreState =
  | { kind: "soon"; headline: string; openingAt: string | null }
  | { kind: "open"; headline: string; closesAt: string }
  | { kind: "drop"; headline: string; dropAt: string; closesAt: string }
  | { kind: "closed"; headline: string; note: string | null };

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const weekdayName = (ymd: string) => DAY_NAMES[weekdayOf(ymd)];
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Open, closed, drop day or coming soon, right now in Kathmandu.
 * `dropAt`: the next drop's release time (ISO), if any.
 */
export function storeState(info: StoreInfo, now: Date, dropAt?: string | null): StoreState {
  if (!info.opened) {
    const d = info.openingDate;
    const opensAt = d ? (hoursOn({ ...info, special: [] }, d)?.open ?? "11:00") : null;
    const openingAt = d ? `${d}T${opensAt}:00+05:45` : null;
    // openingAt only while it's still ahead, for the countdown.
    return {
      kind: "soon",
      headline: d ? `Opening ${monthYear.format(new Date(`${d}T12:00:00Z`))}` : "Opening soon",
      openingAt: openingAt && Date.parse(openingAt) > now.getTime() ? openingAt : null,
    };
  }
  const t = ktmNow(now);
  const today = hoursOn(info, t.date);
  if (today && t.minutes >= toMinutes(today.open) && t.minutes < toMinutes(today.close)) {
    const closesAt = today.close;
    // Drop day: the shutter is half up until the drop, then all the way.
    if (dropAt && ymdFmt.format(new Date(dropAt)) === t.date && Date.parse(dropAt) > now.getTime()) {
      const at = ktmNow(new Date(dropAt));
      const label = hourLabel(`${Math.floor(at.minutes / 60)}:${at.minutes % 60}`);
      return { kind: "drop", headline: `Drop at ${label}.`, dropAt, closesAt };
    }
    return { kind: "open", headline: `Aaunus. Open till ${hourLabel(closesAt)}.`, closesAt };
  }

  // Closed: find when it opens next (up to three weeks ahead, for long festival closures).
  const special = info.special.find((s) => s.date === t.date);
  const note = special?.note || null;
  for (let i = 0; i < 21; i++) {
    const day = addDays(t.date, i);
    const h = hoursOn(info, day);
    if (!h) continue;
    if (i === 0 && t.minutes >= toMinutes(h.open)) continue; // today's hours are over
    const when = i === 0 ? "today" : i === 1 ? "tomorrow" : i < 7 ? weekdayName(day) : shortDate.format(new Date(`${day}T12:00:00Z`));
    if (note) return { kind: "closed", headline: `${note}. Back ${i < 7 ? when : `on ${when}`}.`, note };
    return { kind: "closed", headline: `Shutter down. Opens ${hourLabel(h.open)} ${when}.`, note: null };
  }
  return { kind: "closed", headline: note ? `${note}.` : "Shutter down.", note };
}

/** Merged details: saved settings over the defaults; samples filled in only for the preview. */
export function withDefaults(saved: Partial<StoreInfo> | null, preview = false): StoreInfo {
  const base: StoreInfo = { ...DEFAULT_STORE, ...(saved ?? {}) };
  if (!preview) return base;
  const fill = <K extends keyof StoreInfo>(k: K) => {
    const v = base[k];
    if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) (base as unknown as Record<string, unknown>)[k] = SAMPLE_STORE[k] ?? v;
  };
  (["area", "address", "landmark", "geo", "route", "startPoints", "parkingSpots", "entrancePhoto", "transport", "parking", "access"] as const).forEach(fill);
  if (!saved?.area) base.area = SAMPLE_STORE.area!;
  return { ...base, opened: true };
}
