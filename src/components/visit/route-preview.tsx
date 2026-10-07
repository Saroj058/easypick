"use client";

import { distance, lengthMeters, minutes, type LngLat } from "@/lib/map/route";

// A flat drawing of a route, used in /admin/store to check a pasted route before saving: the
// line, the store pin and the 30 m circle the route has to finish inside. It's a drawing, not
// the map (find-us-map.tsx), so the admin page doesn't have to load the map library.

export interface MapPreview {
  /** The route as it will be saved, or null when there's nothing valid to draw. */
  coords: LngLat[] | null;
  pin: { lat: number; lng: number } | null;
  /** What's wrong with the pasted route, in plain words. */
  error?: string | null;
}

const W = 320;
const H = 200;
const PAD = 22;
const M_PER_DEG_LAT = 110_900;

export function RoutePreview({ preview }: { preview: MapPreview }) {
  const { coords, pin, error } = preview;
  const pinLL: LngLat | null = pin ? [pin.lng, pin.lat] : null;
  const pts = [...(coords ?? []), ...(pinLL ? [pinLL] : [])];

  if (!pts.length) {
    return <p className="border border-dashed border-mist p-4 text-[13px] text-steel-dark">{error ?? "Set the map pin and paste a route to see it here."}</p>;
  }

  // A flat projection: longitude squeezed by cos(latitude), so 100 m east looks as long as 100 m north.
  const lat0 = pts[0][1];
  const kx = Math.cos((lat0 * Math.PI) / 180) * M_PER_DEG_LAT;
  const xs = pts.map((p) => p[0] * kx);
  const ys = pts.map((p) => p[1] * M_PER_DEG_LAT);
  // Room for the 30 m circle round the pin, and at least 120 m across so a short route isn't a blur.
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 120) + 60;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const scale = Math.min((W - PAD * 2) / span, (H - PAD * 2) / span);
  const at = ([lng, lat]: LngLat) => [W / 2 + (lng * kx - cx) * scale, H / 2 - (lat * M_PER_DEG_LAT - cy) * scale] as const;

  const len = coords ? lengthMeters(coords) : 0;
  const start = coords?.[0];
  const ends = coords && pinLL ? Math.round(distance(coords[coords.length - 1], pinLL)) : null;

  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={coords ? `Route preview, ${Math.round(len)} metres to the store` : "The store pin"} className="block w-full max-w-md rounded-[2px] bg-ink">
        {/* 50 m grid, for scale */}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`v${i}`} x1={W / 2 + (i - 6) * 50 * scale} x2={W / 2 + (i - 6) * 50 * scale} y1={0} y2={H} stroke="#1c1c1f" />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`h${i}`} y1={H / 2 + (i - 6) * 50 * scale} y2={H / 2 + (i - 6) * 50 * scale} x1={0} x2={W} stroke="#1c1c1f" />
        ))}
        {pinLL && <circle cx={at(pinLL)[0]} cy={at(pinLL)[1]} r={30 * scale} fill="none" stroke="#8e8e93" strokeDasharray="3 3" />}
        {coords && <polyline points={coords.map((c) => at(c).join(",")).join(" ")} fill="none" stroke="#c6ff3d" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
        {start && <circle cx={at(start)[0]} cy={at(start)[1]} r={5} fill="#0a0a0a" stroke="#f4f3ef" strokeWidth={2} />}
        {pinLL && <circle cx={at(pinLL)[0]} cy={at(pinLL)[1]} r={6} fill="#c6ff3d" stroke="#0a0a0a" strokeWidth={2} />}
      </svg>
      <figcaption className="text-[13px]">
        {error ? (
          <span className="font-semibold text-error-light">{error}</span>
        ) : coords ? (
          <span className="text-steel-dark">
            {Math.round(len)} m · {minutes(len, "walk")} min walk · {coords.length} points{ends !== null ? " · ends on the pin" : ""}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
