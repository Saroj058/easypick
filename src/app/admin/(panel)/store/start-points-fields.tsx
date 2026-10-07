"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { prepareRoute } from "@/lib/map/route";
import type { StoreInfo } from "@/lib/store-state";

// The "Start points" part of /admin/store: for each place people come from, a name, the route
// pasted from geojson.io or a GPS app, and the steps printed on the receipt. Each route is checked
// as it's typed (the same check the save runs) and drawn in a small preview.

const FindUsMap = dynamic(() => import("@/components/visit/find-us-map").then((m) => m.FindUsMap), {
  ssr: false,
  loading: () => <p className="text-[13px] text-steel-dark">Loading the preview…</p>,
});

const input = "mt-1 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-3 text-base outline-none focus:border-ink";
const area = "mt-1 w-full rounded-[2px] border border-mist bg-paper px-3 py-2 font-mono text-[13px] outline-none focus:border-ink";
const lbl = "text-sm font-semibold";
const hint = "mt-1 text-[12px] text-steel-dark";

type Row = { key: number; name: string; route: string; steps: string };

const toRows = (info: StoreInfo): Row[] =>
  info.startPoints.map((s, i) => ({
    key: i,
    name: s.name,
    route: s.coords.map(([lng, lat]) => `${lat}, ${lng}`).join("\n"),
    steps: s.steps.map((x) => `${x.text}, ${x.minutes}`).join("\n"),
  }));

export function StartPointsFields({ initial, pin }: { initial: StoreInfo; pin: { lat: number; lng: number } | null }) {
  const [rows, setRows] = useState<Row[]>(toRows(initial));
  const set = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  return (
    <div className="space-y-6">
      {/* Tells the save that this form carries start points (an older form without it keeps what's saved). */}
      <input type="hidden" name="startPointsForm" value="1" />
      <p className="text-[14px] text-steel-dark">Trace the route in geojson.io or record it with OsmAnd / Organic Maps, then paste it here.</p>
      {rows.length === 0 && <p className="text-[14px]">No start points yet. Until there are, the Visit page shows the route receipt above without a map line.</p>}
      <ol className="space-y-6">
        {rows.map((r, i) => {
          const checked = r.route.trim() ? prepareRoute(r.route, pin) : null;
          return (
            <li key={r.key} className="space-y-3 border-l-2 border-ink pl-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label htmlFor={`sp-name-${r.key}`} className={lbl}>
                    Start point {i + 1}
                  </label>
                  <input id={`sp-name-${r.key}`} name="spName" maxLength={40} value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Jhamsikhel Chowk" className={input} />
                </div>
                <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="min-h-11 text-[14px] underline" aria-label={`Remove start point ${i + 1}`}>
                  Remove
                </button>
              </div>
              <div>
                <label htmlFor={`sp-route-${r.key}`} className={lbl}>
                  Route to the store
                </label>
                <textarea id={`sp-route-${r.key}`} name="spRoute" rows={4} value={r.route} onChange={(e) => set(r.key, { route: e.target.value })} placeholder={"GeoJSON, GPX, or one “lat, lng” per line:\n27.6800, 85.3070\n27.6797, 85.3054"} className={area} />
                <p className={hint}>It has to finish within 30 m of the map pin; the last point becomes the pin exactly.</p>
              </div>
              <FindUsMap preview={{ coords: checked?.ok ? checked.coords : null, pin, error: checked && !checked.ok ? checked.message : null }} />
              <div>
                <label htmlFor={`sp-steps-${r.key}`} className={lbl}>
                  Receipt steps
                </label>
                <textarea id={`sp-steps-${r.key}`} name="spSteps" rows={3} value={r.steps} onChange={(e) => set(r.key, { steps: e.target.value })} placeholder={"Jhamsikhel Chowk, 0\nWest past the cafés, 2\nBlack shutter, lime dot, 4"} className={area} />
                <p className={hint}>One step a line: the place, a comma, the minutes from the start. Up to 6.</p>
              </div>
            </li>
          );
        })}
      </ol>
      {rows.length < 6 && (
        <button type="button" onClick={() => setRows((rs) => [...rs, { key: Date.now(), name: "", route: "", steps: "" }])} className="btn btn-outline">
          Add a start point
        </button>
      )}

      <div>
        <label htmlFor="parkingSpots" className={lbl}>
          Parking spots
        </label>
        <textarea
          id="parkingSpots"
          name="parkingSpots"
          rows={3}
          defaultValue={initial.parkingSpots.map((p) => `${p.kind}, ${p.lat}, ${p.lng}`).join("\n")}
          placeholder={"bike, 27.6779, 85.3053\ncar, 27.6774, 85.3061"}
          className={area}
        />
        <p className={hint}>One a line: bike or car, then latitude and longitude. Shown on the map when people arrive.</p>
      </div>
      <div>
        <label htmlFor="entrancePhoto" className={lbl}>
          Entrance photo
        </label>
        <input id="entrancePhoto" name="entrancePhoto" defaultValue={initial.entrancePhoto ?? ""} placeholder="https://…/entrance.jpg" className={input} />
        <p className={hint}>A link to a photo of the door, for the arrival card.</p>
      </div>
    </div>
  );
}
