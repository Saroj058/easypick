import { describe, expect, it } from "vitest";

import { bounds, distance, lengthMeters, minutes, pointAt, prepareRoute, parseRouteText, routeFor, simplify, sliceTo, snapToPin, stepAt, type LngLat } from "@/lib/map/route";
import { cubicBezier, drawDuration, drawEase, drawnAt, inOut, panelAt, phaseAt, quart, timeline, totalMs, zoomForCamera } from "@/lib/map/sequence";
import { parseParking, parseSteps, parseStoreForm, startPointId } from "@/lib/store-form";
import { DEFAULT_STORE, SAMPLE_STORE, storeState, withDefaults, type StoreInfo } from "@/lib/store-state";
import { lightsFor, statusLine } from "@/lib/visit-status";

// The Visit page plan, Phase 1a: routes, the status line and the motion table (docs/VISIT_PAGE_PLAN.md).

// A made-up street in Jhamsikhel: 4 points about 100 m apart, going east.
const pin = { lat: 27.6781, lng: 85.3052 };
const line: LngLat[] = [
  [85.3022, 27.6781],
  [85.3032, 27.6781],
  [85.3042, 27.6781],
  [85.3052, 27.6781],
];
const asLatLng = (c: LngLat[]) => c.map(([lng, lat]) => `${lat}, ${lng}`).join("\n");

describe("route geometry", () => {
  it("measures and walks along a line", () => {
    const len = lengthMeters(line);
    expect(len).toBeGreaterThan(290);
    expect(len).toBeLessThan(300);
    expect(pointAt(line, 0)).toEqual(line[0]);
    expect(pointAt(line, 1)).toEqual(line[3]);
    const mid = pointAt(line, 0.5);
    expect(mid[0]).toBeCloseTo(85.3037, 4);
    expect(mid[1]).toBeCloseTo(27.6781, 6);
    // Out of range fractions clamp.
    expect(pointAt(line, -1)).toEqual(line[0]);
    expect(pointAt(line, 2)).toEqual(line[3]);
    expect(lengthMeters(sliceTo(line, 0.5))).toBeCloseTo(len / 2, 0);
    expect(bounds(line)).toEqual([
      [85.3022, 27.6781],
      [85.3052, 27.6781],
    ]);
  });

  it("gives whole minutes per mode, never zero", () => {
    expect(minutes(300, "walk")).toBe(4); // 75 m a minute
    expect(minutes(2800, "bike")).toBe(10); // 280 m a minute
    expect(minutes(3600, "car")).toBe(10); // 360 m a minute
    expect(minutes(10, "car")).toBe(1);
  });

  it("lights each receipt step as the line reaches its share of the walk", () => {
    const steps = [
      { text: "Chowk", minutes: 0 },
      { text: "Second left", minutes: 2 },
      { text: "Shutter", minutes: 4 },
    ];
    expect(stepAt(steps, 0)).toBe(0);
    expect(stepAt(steps, 0.49)).toBe(0);
    expect(stepAt(steps, 0.5)).toBe(1);
    expect(stepAt(steps, 0.99)).toBe(1);
    expect(stepAt(steps, 1)).toBe(2);
    expect(stepAt([], 1)).toBe(-1);
  });
});

describe("reading a pasted route", () => {
  it("reads lat,lng lines, GeoJSON and GPX, and puts swapped pairs right", () => {
    const fromLines = parseRouteText(asLatLng(line));
    expect(fromLines).toEqual({ ok: true, coords: line });
    // GeoJSON is [lng, lat] already; a swapped GeoJSON comes out the same.
    const geo = JSON.stringify({ type: "Feature", geometry: { type: "LineString", coordinates: line } });
    expect(parseRouteText(geo)).toEqual({ ok: true, coords: line });
    const swapped = JSON.stringify({ type: "LineString", coordinates: line.map(([a, b]) => [b, a]) });
    expect(parseRouteText(swapped)).toEqual({ ok: true, coords: line });
    const gpx = `<gpx><trk><trkseg>${line.map(([lng, lat]) => `<trkpt lat="${lat}" lon="${lng}"><ele>1300</ele></trkpt>`).join("")}</trkseg></trk></gpx>`;
    expect(parseRouteText(gpx)).toEqual({ ok: true, coords: line });
  });

  it("refuses points outside Nepal, junk lines and empty input in plain words", () => {
    expect(parseRouteText("51.5, -0.12")).toMatchObject({ ok: false, message: expect.stringMatching(/Nepal/) });
    expect(parseRouteText("27.68 85.30 12")).toMatchObject({ ok: false, message: expect.stringMatching(/lat, lng/) });
    expect(parseRouteText("   ")).toMatchObject({ ok: false });
    expect(parseRouteText("{ not json")).toMatchObject({ ok: false, message: expect.stringMatching(/GeoJSON/) });
  });

  it("simplifies a wobbly trace within 3 m", () => {
    // 100 points on a straight line with 1 m of jitter collapse to its two ends.
    const wobbly: LngLat[] = Array.from({ length: 100 }, (_, i) => [85.3022 + i * 0.00003, 27.6781 + (i % 2 ? 0.000009 : 0)]);
    const s = simplify(wobbly, 3);
    expect(s).toHaveLength(2);
    // A real corner (100 m off the line) is kept.
    const corner: LngLat[] = [
      [85.3022, 27.6781],
      [85.3032, 27.6791],
      [85.3042, 27.6781],
    ];
    expect(simplify(corner, 3)).toHaveLength(3);
  });

  it("ends the route exactly on the pin when it finishes within 30 m, and refuses further", () => {
    const near: LngLat[] = [...line.slice(0, 3), [85.3054, 27.6782]]; // ~20 m off
    const snapped = snapToPin(near, pin);
    expect(snapped).toEqual({ ok: true, coords: [...line.slice(0, 3), [pin.lng, pin.lat]] });
    expect(prepareRoute(asLatLng(near), pin)).toMatchObject({ ok: true });
    const far: LngLat[] = [...line.slice(0, 3), [85.3049, 27.6785]]; // ~53 m off
    expect(prepareRoute(asLatLng(far), pin)).toMatchObject({ ok: false, message: expect.stringMatching(/\d+ m from the store pin/) });
  });

  it("refuses gaps over 150 m and routes that are too short or too long", () => {
    const gap: LngLat[] = [
      [85.3, 27.6781],
      [85.3022, 27.6781], // ~217 m jump
      [85.3052, 27.6781],
    ];
    expect(prepareRoute(asLatLng(gap), pin)).toMatchObject({ ok: false, message: expect.stringMatching(/jump/) });
    const tiny: LngLat[] = [
      [85.30515, 27.6781],
      [85.3052, 27.6781],
    ];
    expect(prepareRoute(asLatLng(tiny), pin)).toMatchObject({ ok: false, message: expect.stringMatching(/shorter than 30 m/) });
    // Over 5 km: a zig-zag of 140 m legs.
    const long: LngLat[] = [];
    for (let i = 0; i <= 40; i++) long.push([85.25 + (i % 2) * 0.0014, 27.6781 + i * 0.0012]);
    long.push([85.3052, 27.6781]);
    expect(prepareRoute(asLatLng(long), pin)).toMatchObject({ ok: false });
  });

  it("can be pasted back in: a prepared route prepares again to the same line", () => {
    const r1 = prepareRoute(asLatLng(line), pin);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    for (let i = 1; i < r1.coords.length; i++) expect(distance(r1.coords[i - 1], r1.coords[i])).toBeLessThanOrEqual(150);
    expect(prepareRoute(asLatLng(r1.coords), pin)).toEqual(r1);
  });

  it("needs the store pin first", () => {
    expect(prepareRoute(asLatLng(line), null)).toMatchObject({ ok: false, message: expect.stringMatching(/map pin/) });
  });

  it("checks every sample route the same way the admin form will", () => {
    for (const s of SAMPLE_STORE.startPoints!) {
      expect(s.name).toMatch(/\(sample\)/);
      const r = prepareRoute(asLatLng(s.coords), SAMPLE_STORE.geo!);
      expect(r, s.id).toMatchObject({ ok: true });
      for (let i = 1; i < s.coords.length; i++) expect(distance(s.coords[i - 1], s.coords[i])).toBeLessThan(150);
    }
  });
});

describe("which route the receipt shows", () => {
  it("uses the start point asked for, else the first, else the old written route", () => {
    const sample = withDefaults(null, true);
    expect(routeFor(sample, "sanepa").name).toBe("Sanepa Chowk (sample)");
    expect(routeFor(sample, "nope").name).toBe("Jhamsikhel Chowk (sample)");
    const legacy = { ...DEFAULT_STORE, route: [{ text: "Jhamsikhel Chowk", minutes: 0 }] };
    expect(routeFor(legacy)).toEqual({ name: null, coords: null, steps: legacy.route });
  });

  it("never wipes start points, parking or the entrance photo when the store form is saved", () => {
    const f = new FormData();
    for (let d = 0; d < 7; d++) {
      f.set(`open-${d}`, "11:00");
      f.set(`close-${d}`, "20:00");
    }
    const saved = { startPoints: SAMPLE_STORE.startPoints!, parkingSpots: SAMPLE_STORE.parkingSpots!, entrancePhoto: "/visit/door.avif" };
    const r = parseStoreForm(f, saved);
    expect(r.ok && r.info.startPoints).toEqual(saved.startPoints);
    expect(r.ok && r.info.parkingSpots).toEqual(saved.parkingSpots);
    expect(r.ok && r.info.entrancePhoto).toBe("/visit/door.avif");
  });

  it("keeps the sample pin and routes out of the public page", () => {
    const live = withDefaults(null);
    expect(live.geo).toBeNull();
    expect(live.startPoints).toEqual([]);
    expect(withDefaults(null, true).geo).toEqual(SAMPLE_STORE.geo);
  });
});

describe("the status line and the lights", () => {
  const at = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00+05:45`);
  const open: StoreInfo = {
    ...DEFAULT_STORE,
    opened: true,
    area: "Jhamsikhel, Lalitpur",
    address: "Jhamsikhel Road",
    hours: DEFAULT_STORE.hours.map((h) => ({ ...h, open: "11:00", close: "20:00", closed: false })),
  };

  it("open", () => {
    const s = storeState(open, at("2026-10-07", "12:00"));
    expect(statusLine(s, open)).toBe("OPEN · TILL 8 PM · JHAMSIKHEL");
    expect(lightsFor(s)).toBe("open");
  });

  it("open on a short special day", () => {
    const short = { ...open, special: [{ date: "2026-10-07", closed: false, open: "11:00", close: "15:00", note: "Short day" }] };
    expect(statusLine(storeState(short, at("2026-10-07", "12:00")), short)).toBe("OPEN · TILL 3 PM · JHAMSIKHEL");
  });

  it("drop Friday", () => {
    // 2 Oct 2026 is a Friday.
    const s = storeState(open, at("2026-10-02", "12:00"), "2026-10-02T18:00:00+05:45");
    expect(statusLine(s, open)).toBe("DROP AT 6 PM · OPEN TILL 8 PM · JHAMSIKHEL");
    expect(lightsFor(s)).toBe("drop");
  });

  it("closed, and closed for a festival", () => {
    const s = storeState(open, at("2026-10-07", "21:00"));
    expect(statusLine(s, open)).toBe("CLOSED · OPENS 11 AM TOMORROW · JHAMSIKHEL");
    expect(lightsFor(s)).toBe("closed");
    const tika = { ...open, special: [0, 1, 2].map((n) => ({ date: `2026-10-2${1 + n}`, closed: true, note: "Closed for Tika" })) };
    expect(statusLine(storeState(tika, at("2026-10-21", "12:00")), tika)).toBe("CLOSED FOR TIKA · BACK SATURDAY · JHAMSIKHEL");
  });

  it("coming soon, from the state's own headline", () => {
    const soon = { ...open, opened: false, openingDate: "2027-02-14" };
    const s = storeState(soon, at("2026-10-07", "12:00"));
    expect(statusLine(s, soon)).toBe("OPENING FEBRUARY 2027 · JHAMSIKHEL");
    expect(lightsFor(s)).toBe("soon");
  });
});

describe("the Find us motion table", () => {
  // The plan's round numbers: a first visit puts the panel in at about 5.6 s, a repeat visit at
  // about 3.4 s, a deep link at 1.5 s. The route length decides the drawing time.
  it("hits the planned totals", () => {
    const firstMeters = (1780 - 900) / 0.3; // the draw that makes 5.6 s
    expect(panelAt("first", firstMeters)).toBeCloseTo(5600, -1);
    const repeatMeters = (1400 - 900) / 0.3; // the draw that makes 3.4 s
    expect(panelAt("repeat", repeatMeters)).toBeCloseTo(3400, -1);
    expect(panelAt("deeplink", 300)).toBe(1500);
    expect(panelAt("deeplink", 4000)).toBe(1500);
    // soon: valley, then the 400 m circle and the sign-up at about 3 s.
    expect(panelAt("soon", 0)).toBe(3000);
    // first visit with a typical 300 m walk: panel just over 5 s, arrival 0.7 s later.
    expect(panelAt("first", 300)).toBe(3300 + 1200 + 520);
    expect(totalMs("first", 300)).toBe(3300 + 1200 + 520 + 700);
  });

  it("clamps the drawing time between 1.2 and 2.4 s", () => {
    expect(drawDuration(0)).toBe(1200);
    expect(drawDuration(1000)).toBe(1200);
    expect(drawDuration(2000)).toBe(1500);
    expect(drawDuration(10000)).toBe(2400);
  });

  it("runs the phases in order, with the crossfade on top of the rise", () => {
    const names = timeline("first", 300)
      .filter((p) => !p.overlay)
      .map((p) => p.name);
    expect(names).toEqual(["rise", "pullout", "hold", "fly", "draw", "settle", "arrival"]);
    const fade = timeline("first", 300).find((p) => p.name === "crossfade")!;
    expect([fade.start, fade.end]).toEqual([560, 800]);
    expect(timeline("repeat", 300).some((p) => p.name === "hold")).toBe(false); // no valley
    expect(timeline("chip", 300).map((p) => p.name)).toEqual(["retract", "draw", "settle"]);
    expect(timeline("soon", 300).some((p) => p.name === "draw")).toBe(false); // no route before opening
  });

  it("knows where it is at any moment", () => {
    expect(phaseAt(0, "first", 300).name).toBe("rise");
    expect(phaseAt(1000, "first", 300)).toMatchObject({ name: "pullout", progress: 0.3 });
    expect(phaseAt(2000, "first", 300).name).toBe("hold");
    expect(phaseAt(99_999, "first", 300)).toMatchObject({ name: "arrival", progress: 1 });
    expect(drawnAt(3300, "first", 300)).toBe(0);
    expect(drawnAt(3300 + 600, "first", 300)).toBeCloseTo(0.5, 1);
    expect(drawnAt(10_000, "first", 300)).toBe(1);
  });

  it("scales every time for ?motion=fast", () => {
    expect(panelAt("first", 300, 0.1)).toBeCloseTo(502, 0);
  });

  it("eases the way the plan says", () => {
    for (const e of [inOut, quart, drawEase]) {
      expect(e(0)).toBeCloseTo(0, 6);
      expect(e(1)).toBeCloseTo(1, 6);
      expect(e(0.5)).toBeCloseTo(0.5, 1); // halfway, near enough (drawEase's ramps differ: 12 % and 15 %)
    }
    // drawEase: slow start, steady middle, slow finish.
    expect(drawEase(0.06)).toBeLessThan(0.06);
    expect(drawEase(0.97)).toBeGreaterThan(0.97);
    expect(cubicBezier(0.22, 1, 0.36, 1)(0.5)).toBeGreaterThan(0.85);
  });

  it("matches the map's zoom to the 3D camera", () => {
    // A camera 40 m up with a 60° lens on an 800 px tall view: 0.058 m a pixel, zoom 21.2;
    // 160 m up it's two zoom levels further out.
    expect(zoomForCamera(40, 60, 800)).toBeCloseTo(21.2, 1);
    expect(zoomForCamera(160, 60, 800)).toBeCloseTo(19.2, 1);
  });
});


describe("the admin form's start points (Phase 1b)", () => {
  const base = () => {
    const f = new FormData();
    for (let d = 0; d < 7; d++) {
      f.set(`open-${d}`, "11:00");
      f.set(`close-${d}`, "20:00");
    }
    f.set("lat", String(pin.lat));
    f.set("lng", String(pin.lng));
    f.set("startPointsForm", "1");
    return f;
  };
  const addStart = (f: FormData, name: string, route: string, steps: string) => {
    f.append("spName", name);
    f.append("spRoute", route);
    f.append("spSteps", steps);
  };

  it("reads a start point, its route and steps, parking and the photo", () => {
    const f = base();
    addStart(f, "Jhamsikhel Chowk", asLatLng(line), ["Jhamsikhel Chowk, 0", "Second left, 2", "Black shutter, 4"].join("\n"));
    addStart(f, "", "", ""); // an empty row is skipped
    f.set("parkingSpots", ["bike, 27.6779, 85.3053", "car 27.6774 85.3061"].join("\n"));
    f.set("entrancePhoto", "https://example.com/door.jpg");
    const r = parseStoreForm(f);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.info.startPoints).toHaveLength(1);
    expect(r.info.startPoints[0]).toMatchObject({
      id: "jhamsikhel-chowk",
      name: "Jhamsikhel Chowk",
      steps: [
        { text: "Jhamsikhel Chowk", minutes: 0 },
        { text: "Second left", minutes: 2 },
        { text: "Black shutter", minutes: 4 },
      ],
    });
    expect(r.info.startPoints[0].coords.at(-1)).toEqual([pin.lng, pin.lat]);
    expect(r.info.parkingSpots).toEqual([
      { kind: "bike", lat: 27.6779, lng: 85.3053 },
      { kind: "car", lat: 27.6774, lng: 85.3061 },
    ]);
    expect(r.info.entrancePhoto).toBe("https://example.com/door.jpg");
  });

  it("says which start point is wrong, in plain words", () => {
    const f = base();
    addStart(f, "Sanepa", "51.5, -0.12", "Sanepa, 0");
    expect(parseStoreForm(f)).toMatchObject({ ok: false, message: expect.stringMatching(/^Start point 1 \(Sanepa\): .*Nepal/) });
    const g = base();
    addStart(g, "", asLatLng(line), "");
    expect(parseStoreForm(g)).toMatchObject({ ok: false, message: expect.stringMatching(/give it a name/) });
    const h = base();
    h.delete("lat");
    h.delete("lng");
    addStart(h, "Chowk", asLatLng(line), "");
    expect(parseStoreForm(h)).toMatchObject({ ok: false, message: expect.stringMatching(/map pin/) });
  });

  it("clears start points when the form sends none, but keeps them when the form doesn't carry them", () => {
    const saved = { startPoints: SAMPLE_STORE.startPoints!, parkingSpots: [], entrancePhoto: null };
    const cleared = parseStoreForm(base(), saved);
    expect(cleared.ok && cleared.info.startPoints).toEqual([]);
    const legacy = base();
    legacy.delete("startPointsForm");
    const kept = parseStoreForm(legacy, saved);
    expect(kept.ok && kept.info.startPoints).toEqual(saved.startPoints);
  });

  it("reads steps and parking lines, and makes unique ids", () => {
    expect(parseSteps(["Chowk, 0", "", "Shutter 4 min"].join("\n"))).toEqual({
      ok: true,
      steps: [
        { text: "Chowk", minutes: 0 },
        { text: "Shutter", minutes: 4 },
      ],
    });
    expect(parseSteps("Chowk")).toMatchObject({ ok: false, message: expect.stringMatching(/place, minutes/) });
    expect(parseParking("boat, 27.67, 85.30")).toMatchObject({ ok: false });
    expect(startPointId("Chowk", new Set(["chowk"]))).toBe("chowk-2");
    expect(startPointId("Sanepa Chowk (sample)", new Set())).toBe("sanepa-chowk-sample");
  });
});
