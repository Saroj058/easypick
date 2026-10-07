import { describe, expect, it } from "vitest";

import { subsolarPoint } from "@/lib/kathmandu-sky";
import { distance, lengthMeters, type LngLat } from "@/lib/map/route";
import { cubicBezier, drawEase, inOut, quart } from "@/lib/map/sequence";
import { DEFAULT_STORE, SAMPLE_STORE, storeState, type StoreInfo } from "@/lib/store-state";
import { altitudeLabel, altitudeMetres, bearingBetween, cloudAt, earthView, FILM_SECONDS, HANDOVER, KATHMANDU, planFilm, sceneAt, SCENES, sceneStart } from "@/lib/visit/film";
import { statusShort } from "@/lib/visit-status";

const start = SAMPLE_STORE.startPoints![0];
const pin: LngLat = [SAMPLE_STORE.geo!.lng, SAMPLE_STORE.geo!.lat];
const plan = planFilm({ pin, valley: [85.35, 27.7], route: start.coords, steps: start.steps, area: "Jhamsikhel", hasDoor: true });

describe("the film's easings", () => {
  it("start at 0, end at 1 and never run backwards", () => {
    for (const e of [inOut, quart, drawEase, cubicBezier(0.45, 0, 0.2, 1)]) {
      expect(e(0)).toBeCloseTo(0, 6);
      expect(e(1)).toBeCloseTo(1, 6);
      let last = 0;
      for (let i = 0; i <= 100; i++) {
        expect(e(i / 100)).toBeGreaterThanOrEqual(last - 1e-9);
        last = e(i / 100);
      }
    }
  });
});

describe("the Visit film: scenes", () => {
  it("runs orbit → Nepal → clouds → valley → street → route → door → directions, 20 seconds in all", () => {
    expect(SCENES.map((s) => s.id)).toEqual(["orbit", "approach", "clouds", "valley", "street", "route", "door", "arrive"]);
    expect(SCENES[0].from).toBe(0);
    for (let i = 1; i < SCENES.length; i++) expect(SCENES[i].from).toBeGreaterThan(SCENES[i - 1].from);
    expect(SCENES.at(-1)!.from).toBeLessThan(FILM_SECONDS);
    expect(sceneAt(0)).toBe("orbit");
    expect(sceneAt(sceneStart("route") + 0.01)).toBe("route");
    expect(sceneAt(FILM_SECONDS)).toBe("arrive");
    expect(sceneAt(-5)).toBe("orbit");
  });

  it("hands over from the Earth to the map in the thick of the cloud", () => {
    expect(HANDOVER).toBeGreaterThan(sceneStart("clouds"));
    expect(HANDOVER).toBeLessThan(sceneStart("valley"));
    expect(cloudAt(HANDOVER)).toBeCloseTo(1, 3);
    expect(cloudAt(0)).toBe(0);
    expect(cloudAt(3)).toBe(0);
    expect(cloudAt(sceneStart("street"))).toBe(0);
    expect(cloudAt(FILM_SECONDS)).toBe(0);
  });
});

describe("the Visit film: the Earth", () => {
  it("hangs to one side of the planet at first, then falls towards Kathmandu and stops at the cloud tops", () => {
    const first = earthView(0);
    expect(first.centred).toBe(0);
    expect(first.distance).toBeGreaterThan(3);
    const last = earthView(HANDOVER);
    expect(last.centred).toBe(1);
    expect(last.over.lat).toBeCloseTo(KATHMANDU.lat, 1);
    expect(last.over.lng).toBeCloseTo(KATHMANDU.lng, 1);
    expect(last.distance).toBeGreaterThan(1.1); // never close enough for the picture to break up
    expect(last.distance).toBeLessThan(1.4);
    // It only ever comes down.
    let d = Infinity;
    for (let t = 0; t <= HANDOVER; t += 0.1) {
      expect(earthView(t).distance).toBeLessThanOrEqual(d + 1e-9);
      d = earthView(t).distance;
    }
  });

  it("lights the globe from where the sun really is", () => {
    // Noon in Kathmandu is 06:15 UTC: the sun is over about 83°E, a little south of the equator in October.
    const noon = subsolarPoint(new Date("2026-10-07T06:15:00Z"));
    expect(noon.lng).toBeGreaterThan(80);
    expect(noon.lng).toBeLessThan(90);
    expect(noon.lat).toBeGreaterThan(-8);
    expect(noon.lat).toBeLessThan(-3);
    // Twelve hours later it's over the other side of the world.
    expect(Math.abs(subsolarPoint(new Date("2026-10-07T18:15:00Z")).lng)).toBeGreaterThan(90);
    // Midsummer: over the Tropic of Cancer.
    expect(subsolarPoint(new Date("2026-06-21T06:00:00Z")).lat).toBeCloseTo(23.4, 0);
  });
});

describe("the Visit film: the map", () => {
  it("comes down from the valley, tipping forward, and never jumps", () => {
    const high = plan.frame(sceneStart("valley")).map;
    const low = plan.frame(sceneStart("route")).map;
    expect(high.zoom).toBeLessThan(10);
    expect(high.pitch).toBe(0);
    expect(low.zoom).toBeGreaterThan(15.5);
    expect(low.pitch).toBeGreaterThan(50);
    expect(distance(low.center, start.coords[0])).toBeLessThan(40); // just ahead of the route's first point
    // From the valley to the end, frame to frame, the camera moves a little at a time.
    let prev = plan.frame(sceneStart("valley")).map;
    for (let t = sceneStart("valley"); t <= FILM_SECONDS; t += 0.05) {
      const m = plan.frame(t).map;
      expect(Math.abs(m.zoom - prev.zoom)).toBeLessThan(0.5);
      expect(Math.abs(m.pitch - prev.pitch)).toBeLessThan(6);
      expect(Math.abs(((m.bearing - prev.bearing + 540) % 360) - 180)).toBeLessThan(12);
      prev = m;
    }
  });

  it("draws the route during its scene, lighting the receipt lines in order, then stands the store up", () => {
    expect(plan.metres).toBeCloseTo(lengthMeters(start.coords), 6);
    expect(plan.frame(sceneStart("route")).drawn).toBe(0);
    expect(plan.frame(sceneStart("route")).step).toBe(-1);
    let drawn = 0;
    let step = -1;
    for (let t = sceneStart("route"); t <= sceneStart("door"); t += 0.1) {
      const f = plan.frame(t);
      expect(f.drawn).toBeGreaterThanOrEqual(drawn - 1e-9);
      expect(f.step).toBeGreaterThanOrEqual(step);
      drawn = f.drawn;
      step = f.step;
    }
    const door = plan.frame(sceneStart("door") + 0.01);
    expect(door.drawn).toBe(1);
    expect(door.step).toBe(start.steps.length - 1);
    expect(plan.frame(sceneStart("arrive")).arrived).toBe(1);
    expect(plan.frame(sceneStart("route")).arrived).toBe(0);
    // The door: closer and steeper than the walk.
    expect(plan.frame(sceneStart("arrive")).map.zoom).toBeGreaterThan(18);
  });

  it("opens the directions at the end, and only then", () => {
    expect(plan.frame(sceneStart("door") + 1).panel).toBe(false);
    expect(plan.frame(FILM_SECONDS).panel).toBe(true);
    expect(plan.frame(FILM_SECONDS).overview).toBe(1);
    expect(plan.frame(sceneStart("door")).overview).toBe(0);
  });

  it("tells one story in its captions, ending at the door", () => {
    const at = (t: number) => plan.frame(t).caption;
    expect(at(0)).toBeNull();
    expect(at(2.5)).toBe("Somewhere on Earth.");
    expect(at(5)).toBe("Under the mountains.");
    expect(at(sceneStart("valley") + 1)).toBe("In one valley.");
    expect(at(sceneStart("street") + 1)).toBe("On one street.");
    expect(at(sceneStart("route") + 0.05)).toBe(start.steps[0].text);
    expect(start.steps.map((s) => s.text)).toContain(at(sceneStart("door") - 0.05));
    expect(at(sceneStart("door") + 1)).toBe("One door.");
    expect(at(FILM_SECONDS)).toBeNull();
  });

  it("still plays with no route, and with no door yet", () => {
    const noRoute = planFilm({ pin, valley: [85.35, 27.7], route: null, steps: [], area: "Jhamsikhel", hasDoor: true });
    expect(noRoute.metres).toBe(0);
    expect(noRoute.frame(sceneStart("route") + 2).drawn).toBe(0);
    expect(noRoute.frame(sceneStart("route") + 2).map.center).toEqual(pin);
    expect(noRoute.frame(FILM_SECONDS).panel).toBe(true);
    const soon = planFilm({ pin, valley: [85.35, 27.7], route: null, steps: [], area: "Jhamsikhel", hasDoor: false });
    expect(soon.frame(sceneStart("street") + 1).caption).toBe("Around Jhamsikhel.");
    expect(soon.frame(sceneStart("door") + 1).caption).toBe("One door. Soon.");
    // Before opening day it never goes in close enough to pick out a building.
    expect(soon.frame(sceneStart("arrive")).map.zoom).toBeLessThan(16);
  });

  it("knows which way a street runs", () => {
    expect(bearingBetween([85.3, 27.7], [85.3, 27.71])).toBeCloseTo(0, 0);
    expect(bearingBetween([85.3, 27.7], [85.31, 27.7])).toBeCloseTo(90, 0);
    expect(bearingBetween([85.3, 27.7], [85.3, 27.69])).toBeCloseTo(180, 0);
  });
});

describe("the Visit film: the read-out", () => {
  it("counts the height down from orbit to the street", () => {
    expect(altitudeMetres(0, 10, 27.7)).toBeGreaterThan(10_000_000);
    expect(altitudeMetres(HANDOVER - 0.01, 10, 27.7)).toBeGreaterThan(500_000);
    expect(altitudeMetres(15, 16.5, 27.7)).toBeLessThan(3000);
    expect(altitudeLabel(14_600_000)).toBe("14,600 KM");
    expect(altitudeLabel(742_000)).toBe("742 KM");
    expect(altitudeLabel(1840)).toBe("1.8 KM");
    expect(altitudeLabel(463)).toBe("460 M");
  });

  it("has a few words of status for the first screen and the directions", () => {
    const at = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00+05:45`);
    const open: StoreInfo = { ...DEFAULT_STORE, opened: true, address: "x", hours: DEFAULT_STORE.hours.map((h) => ({ ...h, open: "11:00", close: "20:00", closed: false })) };
    expect(statusShort(storeState(open, at("2026-10-07", "12:00")))).toBe("OPEN TILL 8 PM");
    expect(statusShort(storeState(open, at("2026-10-07", "22:00")))).toBe("CLOSED NOW");
    expect(statusShort(storeState(open, at("2026-10-02", "12:00"), "2026-10-02T18:00:00+05:45"))).toBe("DROP AT 6 PM");
    expect(statusShort(storeState({ ...open, opened: false }, at("2026-10-07", "12:00")))).toBe("OPENING SOON");
  });
});
