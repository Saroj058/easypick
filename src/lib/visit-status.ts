// The one status line on the Visit page hero ("OPEN · TILL 8 PM · JHAMSIKHEL") and which lights
// the night store shows. Both come from storeState (lib/store-state.ts); nothing here decides
// open or closed on its own.

import { hourLabel, ktmNow, type StoreInfo, type StoreState } from "./store-state";

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
