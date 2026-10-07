"use client";

import type { RouteStep } from "@/lib/store-state";

// The directions beside the map: where the route starts, its steps printed like a kiosk receipt
// (each line lights as the drawn line reaches it), the total walk, and the way into Google Maps
// for turn-by-turn. On phones it sits at the bottom. It is in the page from the moment the map
// opens; `open` only slides it into view. Phase 5 adds the start-point chips, travel modes, the
// arrival card and the phone sheet's snap points.

export interface DirectionsData {
  /** Where the route starts: "Jhamsikhel Chowk". Null with only the written route, or before opening. */
  from: string | null;
  steps: RouteStep[];
  /** "OPEN TILL 8 PM", "CLOSED NOW", "OPENING SOON". */
  status: string;
  /** The address once the store is open; before that, the area. */
  place: string;
  /** Google Maps directions to the door. Null before opening day. */
  mapsUrl: string | null;
  /** Before opening day: no route, the area only. */
  soon: boolean;
}

export function walkMinutes(steps: RouteStep[]): number | null {
  return steps.length ? Math.max(...steps.map((s) => s.minutes)) : null;
}

export function Directions({ data, lit, open, still, onReplay, onLeave }: { data: DirectionsData; lit: number; open: boolean; still: boolean; onReplay: () => void; onLeave: () => void }) {
  const walk = walkMinutes(data.steps);
  const shown = open ? "translate-x-0 translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0 md:translate-x-6 md:translate-y-0";

  return (
    <aside
      data-panel={open ? "open" : "closed"}
      aria-label="Directions"
      aria-hidden={!open}
      className={`absolute inset-x-0 bottom-0 z-10 max-h-[62%] overflow-y-auto bg-paper text-ink shadow-[0_-18px_40px_-18px_rgba(0,0,0,0.7)] transition-[opacity,translate] ease-[cubic-bezier(0.22,1,0.36,1)] md:inset-x-auto md:bottom-6 md:right-6 md:top-28 md:max-h-none md:w-[360px] md:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)] ${
        still ? "duration-150" : "duration-[520ms]"
      } ${shown}`}
    >
      <div className="p-5 font-mono text-[13px] leading-[1.7]">
        <p className="flex justify-between gap-4 font-semibold">
          <span>EASYPICK · {data.status}</span>
        </p>
        <p className="select-text font-sans text-[15px] leading-snug">{data.place}</p>
        <p className="overflow-hidden whitespace-nowrap text-steel" aria-hidden>
          ----------------------------------------------
        </p>
        {data.soon ? (
          <>
            <p>Exact address coming soon</p>
            <p className="text-steel-dark">The circle is the area. The door goes on the map about four weeks before opening day.</p>
          </>
        ) : (
          <>
            {data.from && <p className="text-steel-dark">FROM {data.from.toUpperCase()}</p>}
            <ol data-receipt>
              {data.steps.map((s, i) => {
                const on = i <= lit;
                return (
                  <li key={i} data-step={on ? "lit" : "dim"} className={`relative flex justify-between gap-4 pl-3 transition-colors duration-200 ${on ? "text-ink" : "text-[#8e8e93]"}`}>
                    {/* The tick that slides in beside a line as the route reaches it. */}
                    <span aria-hidden className={`absolute left-0 top-[0.35em] h-[1em] w-[2px] origin-top bg-ink transition-transform duration-[180ms] ${on ? "scale-y-100" : "scale-y-0"}`} />
                    <span className="min-w-0">
                      {String(i + 1).padStart(2, "0")}&nbsp;&nbsp;{s.text}
                    </span>
                    <span className="shrink-0 tabular-nums">{s.minutes} MIN</span>
                  </li>
                );
              })}
            </ol>
            <p className="overflow-hidden whitespace-nowrap text-steel" aria-hidden>
              ----------------------------------------------
            </p>
            <p className="flex justify-between gap-4">
              <span>QUEUE</span>
              <span>0 MIN</span>
            </p>
            {walk !== null && (
              <p data-total className={`flex origin-left justify-between gap-4 font-semibold ${open && lit >= data.steps.length - 1 && !still ? "receipt-stamp" : ""}`}>
                <span>TOTAL</span>
                <span>{walk} MIN WALK</span>
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-mist p-4">
        {data.mapsUrl && (
          <a href={data.mapsUrl} target="_blank" rel="noopener" className="btn btn-ink h-12 min-h-0 grow">
            Open in Google Maps
          </a>
        )}
        {data.soon && (
          <button type="button" onClick={onLeave} className="btn btn-ink h-12 min-h-0 grow">
            Join the opening list
          </button>
        )}
        <button type="button" onClick={onReplay} className="btn btn-outline h-12 min-h-0">
          Replay
        </button>
      </div>
    </aside>
  );
}
