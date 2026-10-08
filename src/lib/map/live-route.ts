// A walking route from where the visitor is to the store's door, worked out along real streets by
// OpenStreetMap's public routing service (OSRM, no key). Asked for only after the visitor has
// shared their location; their coordinates go to that service in the request and nowhere else.
// This file is the pure half: the address to ask, and turning the answer into a line for the map
// and a few receipt lines.

import { lengthMeters, SPEEDS, type LngLat } from "@/lib/map/route";
import type { RouteStep } from "@/lib/store-state";

export const ROUTING_ORIGIN = "https://routing.openstreetmap.de";

/** Further than this the film would be a line across the country: the saved start points are used instead. */
export const MAX_LIVE_METRES = 25_000;

export function routingUrl(from: LngLat, pin: { lat: number; lng: number }): string {
  const p = (n: number) => n.toFixed(6);
  return `${ROUTING_ORIGIN}/routed-foot/route/v1/foot/${p(from[0])},${p(from[1])};${p(pin.lng)},${p(pin.lat)}?overview=full&geometries=geojson&steps=true`;
}

interface OsrmStep {
  distance: number;
  name?: string;
  maneuver?: { type?: string; modifier?: string };
}

const TURN: Record<string, string> = { left: "Left", "sharp left": "Sharp left", "slight left": "Bear left", right: "Right", "sharp right": "Sharp right", "slight right": "Bear right", uturn: "Turn back", straight: "Straight on" };

/** One receipt line for a turn: "Left onto Sanepa Marg", "Right into the lane". At most 40 characters. */
function wording(step: OsrmStep): string {
  const type = step.maneuver?.type ?? "";
  const turn = TURN[step.maneuver?.modifier ?? ""] ?? "Continue";
  const name = (step.name ?? "").trim();
  const text = type === "new name" || type === "continue" ? (name ? `Continue on ${name}` : "Keep going") : name ? `${turn} onto ${name}` : `${turn} into the lane`;
  return text.length > 40 ? `${text.slice(0, 39).trimEnd()}…` : text;
}

/**
 * The service's answer as a route for the map (ending exactly on the pin) and up to six receipt
 * lines with running minutes on foot. Null if the answer isn't a usable route.
 */
export function fromRouting(answer: unknown, pin: { lat: number; lng: number }): { coords: LngLat[]; steps: RouteStep[]; metres: number } | null {
  const route = (answer as { code?: string; routes?: { geometry?: { coordinates?: unknown }; legs?: { steps?: OsrmStep[] }[] }[] } | null)?.routes?.[0];
  const raw = route?.geometry?.coordinates;
  if ((answer as { code?: string } | null)?.code !== "Ok" || !Array.isArray(raw)) return null;
  let coords = raw.filter((c): c is [number, number] => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])).map((c) => [c[0], c[1]] as LngLat);
  if (coords.length < 2) return null;
  // Long routes arrive with hundreds of points: keep every nth, which is plenty for a drawn line.
  if (coords.length > 400) {
    const every = Math.ceil(coords.length / 400);
    coords = coords.filter((_, i) => i % every === 0 || i === coords.length - 1);
  }
  coords.push([pin.lng, pin.lat]);
  const metres = lengthMeters(coords);
  if (metres < 20 || metres > MAX_LIVE_METRES) return null;

  // The turns, with how far along each is; keep the first ("start") and the four that precede the longest stretches.
  const turns: { at: number; text: string; run: number }[] = [];
  let walked = 0;
  for (const s of route?.legs?.[0]?.steps ?? []) {
    const type = s.maneuver?.type ?? "";
    if (type !== "depart" && type !== "arrive" && s.distance >= 25) turns.push({ at: walked, text: wording(s), run: s.distance });
    walked += s.distance;
  }
  const kept = new Set([...turns].sort((a, b) => b.run - a.run).slice(0, 4));
  const minutesAt = (m: number) => Math.round(m / SPEEDS.walk);
  const total = Math.max(1, minutesAt(metres));
  const steps: RouteStep[] = [{ text: "Where you are now", minutes: 0 }];
  for (const t of turns) if (kept.has(t)) steps.push({ text: t.text, minutes: Math.min(total, Math.max(steps[steps.length - 1].minutes, minutesAt(t.at))) });
  steps.push({ text: "Easypick: black shutter, lime dot", minutes: total });
  return { coords, steps, metres };
}
