// The one status line on the Visit page hero ("OPEN · TILL 8 PM · JHAMSIKHEL") and which lights
// the night store shows. Both come from storeState (lib/store-state.ts); nothing here decides
// open or closed on its own.

import { hourLabel, hoursOn, ktmNow, type StoreInfo, type StoreState } from "./store-state";

export type Lights = StoreState["kind"];

/** The building's lights follow the state: open, closed, drop day or coming soon. */
export function lightsFor(state: StoreState): Lights {
  return state.kind;
}

/** "Jhamsikhel, Lalitpur" → "JHAMSIKHEL" */
const place = (info: Pick<StoreInfo, "area">) => (info.area.split(",")[0] || info.area).trim().toUpperCase();

/** "Shutter down. Opens 11 AM tomorrow." → ["Shutter down", "Opens 11 AM tomorrow"] */
const sentences = (s: string) =>
  s
    .split(/\.\s+|\.$/)
    .map((x) => x.trim())
    .filter(Boolean);

export function statusLine(state: StoreState, info: Pick<StoreInfo, "area">): string {
  const where = place(info);
  switch (state.kind) {
    case "open":
      return `OPEN · TILL ${hourLabel(state.closesAt)} · ${where}`;
    case "drop": {
      const at = ktmNow(new Date(state.dropAt));
      const drop = hourLabel(`${Math.floor(at.minutes / 60)}:${at.minutes % 60}`);
      return `DROP AT ${drop} · OPEN TILL ${hourLabel(state.closesAt)} · ${where}`;
    }
    case "closed": {
      const [first, then] = sentences(state.headline);
      // A festival closure leads with its note ("CLOSED FOR TIKA · BACK SATURDAY").
      if (state.note) return [first, then, where].filter(Boolean).join(" · ").toUpperCase();
      return ["CLOSED", then, where].filter(Boolean).join(" · ").toUpperCase();
    }
    case "soon":
      return `${sentences(state.headline)[0] ?? state.headline} · ${where}`.toUpperCase();
  }
}

/**
 * Before opening day nothing that pins the store down reaches the page (and everything a page
 * renders ends up in its HTML): no address, map pin, routes, parking spots or entrance photo.
 */
export function stripPrivate(info: StoreInfo, state: StoreState): StoreInfo {
  if (state.kind !== "soon") return info;
  return { ...info, address: null, geo: null, mapUrl: null, startPoints: [], parkingSpots: [], entrancePhoto: null };
}

const KTM = "+05:45";

/**
 * When the status next changes (closing time, the drop, the next opening), as ISO, so the page can
 * refresh itself then. Null if nothing changes in the next three weeks, or before opening day.
 */
export function nextChangeAt(info: StoreInfo, state: StoreState, now: Date): string | null {
  const t = ktmNow(now);
  if (state.kind === "soon") return state.openingAt;
  if (state.kind === "open") return `${t.date}T${state.closesAt}:00${KTM}`;
  if (state.kind === "drop") return state.dropAt;
  for (let i = 0; i < 21; i++) {
    const d = new Date(`${t.date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const day = d.toISOString().slice(0, 10);
    const h = hoursOn(info, day);
    if (!h) continue;
    const at = `${day}T${h.open}:00${KTM}`;
    if (Date.parse(at) > now.getTime()) return at;
  }
  return null;
}
