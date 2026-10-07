"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { GOOGLE_MODE, lengthMeters, minutes, type LngLat, type TravelMode } from "@/lib/map/route";
import type { ParkingSpot, RouteStep } from "@/lib/store-state";

// The directions beside the map. On a wide screen it's a panel on the right; on a phone it's a
// sheet from the bottom with three heights (a peek with the total and Google Maps, half, nearly
// full). In order: where you're coming from (chips), how (walk, bike, car), the route's steps
// printed like a kiosk receipt (each line lights as the drawn line reaches it; tap one to look at
// that spot), and the arrival card with what to do next. Every way out is a plain link, so they
// work inside Instagram's and TikTok's browsers.

/** One place people come from, as the page sends it. */
export interface StartChoice {
  id: string;
  name: string;
  coords: LngLat[];
  steps: RouteStep[];
}

export interface DirectionsData {
  /** Start points, the first shown first. Empty with only the written route, or before opening. */
  starts: StartChoice[];
  /** The written route (no line on the map), used when there are no start points. */
  steps: RouteStep[];
  /** "OPEN TILL 8 PM", "CLOSED NOW", "OPENING SOON". */
  status: string;
  /** The address once the store is open; before that, the area. */
  place: string;
  landmark: string | null;
  entrancePhoto: string | null;
  /** The store's pin, for Google Maps. Null before opening day. */
  pin: { lat: number; lng: number } | null;
  parkingSpots: ParkingSpot[];
  /** "Free bike parking outside…": the owner's own words. */
  parkingNote: string;
  /** Before opening day: no route, the area only. */
  soon: boolean;
}

export type Snap = "peek" | "half" | "full";
/** "From my location": not offered, offered, waiting for the browser, shown on the map, or it didn't work. */
export type Locate = "off" | "idle" | "asking" | "shown" | "failed";

const far = (m: number) => (m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`);
/** The sheet's heights on a phone, as a share of the window (the peek is a fixed 96 px). */
const SHEET = 0.92;
const HALF = 0.5;
export const PEEK_PX = 96;

const MODES: { id: TravelMode; label: string }[] = [
  { id: "walk", label: "Walk" },
  { id: "bike", label: "Bike" },
  { id: "car", label: "Car" },
];

export function walkMinutes(steps: RouteStep[]): number | null {
  return steps.length ? Math.max(...steps.map((s) => s.minutes)) : null;
}

/** Google Maps directions to the door, with no starting point: it uses wherever they are. */
export function googleMapsUrl(pin: { lat: number; lng: number }, mode: TravelMode = "walk") {
  return `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}&travelmode=${GOOGLE_MODE[mode]}`;
}

/** Copies text; where the modern way is blocked (some in-app browsers), the old way. True if it worked. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const dash = (
  <p className="overflow-hidden whitespace-nowrap text-steel" aria-hidden>
    ----------------------------------------------
  </p>
);

export function Directions({
  data,
  startId,
  mode,
  lit,
  open,
  still,
  wide,
  snap,
  onSnap,
  onStart,
  onMode,
  onLook,
  onReplay,
  onLeave,
  locate = "off",
  away = null,
  onLocate,
}: {
  data: DirectionsData;
  /** The chosen start point. */
  startId: string | null;
  mode: TravelMode;
  lit: number;
  open: boolean;
  still: boolean;
  /** A wide screen has the side panel; otherwise it's the bottom sheet. */
  wide: boolean;
  snap: Snap;
  onSnap: (s: Snap) => void;
  onStart: (id: string) => void;
  onMode: (m: TravelMode) => void;
  /** Look at one step's spot on the map. */
  onLook: (step: number) => void;
  onReplay: () => void;
  onLeave: () => void;
  locate?: Locate;
  /** Metres from the visitor to the door in a straight line, once they've asked. */
  away?: number | null;
  /** The only place the page asks for a location: a tap on "From my location". */
  onLocate?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState<"" | "yes" | "no">("");
  /** While a finger drags the sheet: how far from its resting place, in px. */
  const [drag, setDrag] = useState<number | null>(null);
  const dragFrom = useRef<{ y: number; at: number } | null>(null);

  const start = data.starts.find((s) => s.id === startId) ?? data.starts[0] ?? null;
  const steps = start ? start.steps : data.steps;
  const walk = walkMinutes(steps);
  // With a drawn route the time comes from its length; with only written steps, from their minutes (walking).
  const metres = start ? lengthMeters(start.coords) : null;
  const total = metres !== null ? minutes(metres, mode) : walk;
  // Each line's minutes are its share of that total, so the last line and the total always agree.
  const scale = walk && total ? total / walk : 1;
  const mapsUrl = data.pin ? googleMapsUrl(data.pin, mode) : null;
  const modeWord = mode === "walk" ? "WALK" : mode === "bike" ? "BY BIKE" : "BY CAR";
  const summary = data.soon ? data.status : `${total !== null ? `${total} MIN ${modeWord} · ` : ""}${data.status}`;

  // When the panel comes in, the keyboard and screen readers go to its heading.
  useEffect(() => {
    if (open) heading.current?.focus({ preventScroll: true });
  }, [open]);

  // The sheet's place on a phone: how far down it's pushed from "nearly full".
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const sheetPx = Math.round(vh * SHEET);
  const rest = snap === "full" ? 0 : snap === "half" ? sheetPx - Math.round(vh * HALF) : sheetPx - PEEK_PX;
  const offset = !open ? sheetPx + 40 : Math.max(0, Math.min(sheetPx - PEEK_PX, rest + (drag ?? 0)));

  const onDown = (e: React.PointerEvent) => {
    if (wide) return;
    dragFrom.current = { y: e.clientY, at: rest };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragFrom.current) setDrag(e.clientY - dragFrom.current.y);
  };
  const onUp = (e: React.PointerEvent) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    setDrag(null);
    if (!from) return;
    const moved = e.clientY - from.y;
    // A tap on the handle steps the sheet up (or back down from the top); a drag goes to the nearest height in its direction.
    if (Math.abs(moved) < 8) return onSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "half");
    const at = from.at + moved;
    const stops: [Snap, number][] = [
      ["full", 0],
      ["half", sheetPx - Math.round(vh * HALF)],
      ["peek", sheetPx - PEEK_PX],
    ];
    onSnap(stops.reduce((best, s) => (Math.abs(s[1] - at) < Math.abs(best[1] - at) ? s : best))[0]);
  };

  const shown = wide ? (open ? "opacity-100 translate-x-0" : "pointer-events-none translate-x-6 opacity-0") : "";
  const button = "flex h-12 items-center justify-center border px-3 text-center text-[13px] font-semibold uppercase tracking-[0.05em]";

  return (
    <aside
      data-panel={open ? "open" : "closed"}
      data-snap={wide ? undefined : snap}
      aria-label="Directions"
      aria-hidden={!open}
      inert={!open}
      style={wide ? undefined : { height: sheetPx, transform: `translateY(${offset}px)` }}
      className={`absolute z-10 flex flex-col bg-paper text-ink ${
        wide
          ? `bottom-6 right-6 top-28 w-[360px] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)] transition-[opacity,translate] ease-[cubic-bezier(0.22,1,0.36,1)] ${still ? "duration-150" : "duration-[520ms]"} ${shown}`
          : `inset-x-0 bottom-0 rounded-t-[14px] shadow-[0_-18px_40px_-18px_rgba(0,0,0,0.7)] ${drag !== null ? "" : `transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] ${still ? "duration-150" : "duration-[520ms]"}`}`
      }`}
    >
      {/* The top of the sheet: drag it, or tap it, to change its height. It always shows the total and the way into Google Maps. */}
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className={`shrink-0 px-5 pt-2 ${wide ? "" : "touch-none"}`}>
        {!wide && (
          <button type="button" onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "half"))} aria-label={snap === "peek" ? "Show the directions" : "Change the directions' height"} className="mx-auto -mb-4 flex h-11 w-24 items-start justify-center pt-2.5">
            <span className="block h-1 w-10 rounded-full bg-mist" aria-hidden />
          </button>
        )}
        <div className="flex min-h-14 items-center justify-between gap-3 pb-2 md:pt-3">
          <div className="min-w-0">
            <h3 ref={heading} tabIndex={-1} className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark outline-none">
              Directions
            </h3>
            <p data-summary className="line-clamp-2 font-mono text-[13px] font-semibold leading-snug tracking-[0.02em]">
              {summary}
            </p>
          </div>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener" onPointerDown={(e) => e.stopPropagation()} className="flex h-11 shrink-0 items-center font-mono text-[12px] font-semibold underline underline-offset-4">
              Google Maps
            </a>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-mist">
        {!wide && (
          <button type="button" onClick={onLeave} className="flex h-11 items-center gap-2 px-5 text-[13px] font-semibold uppercase tracking-[0.06em]">
            <span aria-hidden>←</span> The store
          </button>
        )}

        {/* Where from, and how */}
        {!data.soon && (data.starts.length > 1 || locate !== "off") && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-3">
           <div role="radiogroup" aria-label="Coming from" className="flex gap-2">
            {data.starts.map((s) => {
              const on = s.id === start?.id;
              return (
                <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => onStart(s.id)} className={`h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold ${on ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}>
                  {s.name}
                </button>
              );
            })}
           </div>
            {locate !== "off" && (
              <button type="button" aria-pressed={locate === "shown"} disabled={locate === "asking"} onClick={onLocate} className={`h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold ${locate === "shown" ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}>
                From my location
              </button>
            )}
          </div>
        )}
        {locate !== "off" && locate !== "idle" && (
          <p role="status" data-me={locate} className="px-5 pt-3 text-[14px] text-steel-dark">
            {locate === "asking" && "Finding you…"}
            {locate === "shown" && away !== null && (away < 60_000 ? `You're about ${far(away)} from the door in a straight line (the dashed line). ` : "You're a long way from the store. ")}
            {locate === "failed" && "Couldn't get your location. "}
            {locate !== "asking" && mapsUrl && (
              <>
                <a href={mapsUrl} target="_blank" rel="noopener" className="font-semibold text-ink underline underline-offset-4">
                  Google Maps
                </a>{" "}
                {locate === "failed" ? "starts from wherever you are." : "has the turns."}
              </>
            )}
          </p>
        )}
        {!data.soon && metres !== null && (
          <div role="radiogroup" aria-label="How you're coming" className="grid grid-cols-3 gap-2 px-5 pt-3">
            {MODES.map((m) => {
              const on = m.id === mode;
              return (
                <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => onMode(m.id)} className={`flex h-14 flex-col items-center justify-center border ${on ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}>
                  <span className="text-[12px] font-semibold uppercase tracking-[0.06em]">{m.label}</span>
                  <span className="font-mono text-[12px] tabular-nums">{minutes(metres, m.id)} min</span>
                </button>
              );
            })}
          </div>
        )}

        {/* The receipt */}
        <div className="px-5 pb-2 pt-4 font-mono text-[13px] leading-[1.7]">
          <p className="font-semibold">EASYPICK · {data.status}</p>
          {dash}
          {data.soon ? (
            <>
              <p>Exact address coming soon</p>
              <p className="text-steel-dark">The circle is the area. The door goes on the map about four weeks before opening day.</p>
            </>
          ) : (
            <>
              {start && <p className="text-steel-dark">FROM {start.name.toUpperCase()}</p>}
              <ol data-receipt>
                {steps.map((s, i) => {
                  const on = i <= lit;
                  const inner = (
                    <>
                      {/* The tick that slides in beside a line as the route reaches it. */}
                      <span aria-hidden className={`absolute left-0 top-[0.35em] h-[1em] w-[2px] origin-top bg-ink transition-transform duration-[180ms] ${on ? "scale-y-100" : "scale-y-0"}`} />
                      <span className="min-w-0 text-left">
                        {String(i + 1).padStart(2, "0")}&nbsp;&nbsp;{s.text}
                      </span>
                      <span className="shrink-0 tabular-nums">{Math.round(s.minutes * scale)} MIN</span>
                    </>
                  );
                  const cls = `relative flex w-full justify-between gap-4 pl-3 transition-colors duration-200 ${on ? "text-ink" : "text-[#8e8e93]"}`;
                  return (
                    <li key={i} data-step={on ? "lit" : "dim"}>
                      {start ? (
                        <button type="button" onClick={() => onLook(i)} aria-label={`Step ${i + 1}: ${s.text}. Show it on the map`} className={`${cls} min-h-11 items-center hover:underline`}>
                          {inner}
                        </button>
                      ) : (
                        <p className={cls}>{inner}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
              {dash}
              <p className="flex justify-between gap-4">
                <span>QUEUE</span>
                <span>0 MIN</span>
              </p>
              {total !== null && (
                <p data-total className={`flex origin-left justify-between gap-4 font-semibold ${open && lit >= steps.length - 1 && !still ? "receipt-stamp" : ""}`}>
                  <span>TOTAL</span>
                  <span>
                    {total} MIN {modeWord}
                  </span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Arriving */}
        <div data-arrival className="border-t border-mist px-5 py-4">
          <p className="select-text text-[16px] font-semibold leading-snug" data-address>
            {data.place}
          </p>
          {data.landmark && !data.soon && <p className="mt-1 select-text text-[14px] text-steel-dark">{data.landmark}</p>}
          {data.entrancePhoto && !data.soon && (
            // eslint-disable-next-line @next/next/no-img-element -- the owner's photo of the door, from a link set in the admin
            <img src={data.entrancePhoto} alt="The entrance to Easypick" loading="lazy" onError={(e) => (e.currentTarget.hidden = true)} className="mt-3 aspect-[4/3] w-full bg-photo object-cover" />
          )}
          {!data.soon && (data.parkingNote || data.parkingSpots.length > 0) && (
            <p className="mt-3 text-[14px] text-steel-dark">
              <span className="font-semibold text-ink">Parking: </span>
              {data.parkingNote || `${data.parkingSpots.filter((p) => p.kind === "bike").length ? "bikes" : ""}${data.parkingSpots.some((p) => p.kind === "bike") && data.parkingSpots.some((p) => p.kind === "car") ? " and " : ""}${data.parkingSpots.some((p) => p.kind === "car") ? "cars" : ""} marked P on the map.`}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener" className={`${button} col-span-2 border-ink bg-ink text-paper`}>
                Open in Google Maps
              </a>
            )}
            {data.soon && (
              <button type="button" onClick={onLeave} className={`${button} col-span-2 border-ink bg-ink text-paper`}>
                Join the opening list
              </button>
            )}
            {!data.soon && (
              <button
                type="button"
                onClick={async () => {
                  setCopied((await copyText(data.place)) ? "yes" : "no");
                  setTimeout(() => setCopied(""), 2500);
                }}
                className={`${button} border-ink`}
              >
                {copied === "yes" ? "Copied" : "Copy address"}
              </button>
            )}
            {!data.soon && mapsUrl && (
              <a href={`https://wa.me/?text=${encodeURIComponent(`Easypick, ${data.place}\n${mapsUrl}`)}`} target="_blank" rel="noopener" className={`${button} border-ink`}>
                WhatsApp
              </a>
            )}
            <Link href="/visit/tour" className={`${button} border-ink`}>
              Look inside
            </Link>
            <button type="button" onClick={onReplay} className={`${button} border-mist`}>
              Replay
            </button>
          </div>
          <p role="status" className="mt-2 min-h-5 text-[13px] text-steel-dark">
            {copied === "no" ? "Couldn't copy. Press and hold the address above to select it." : ""}
          </p>
        </div>
      </div>
    </aside>
  );
}
