import { describe, expect, it } from "vitest";

import { distance, lengthMeters, type LngLat } from "@/lib/map/route";
import { cubicBezier, drawEase, inOut, quart } from "@/lib/map/sequence";
import { DEFAULT_STORE, SAMPLE_STORE, storeState, type StoreInfo } from "@/lib/store-state";
import { altitudeLabel, altitudeMetres, bearingBetween, FILM_SECONDS, planFilm, sceneAt, SCENES, sceneStart } from "@/lib/visit/film";
import { statusShort } from "@/lib/visit-status";

const start = SAMPLE_STORE.startPoints![0];
const pin: LngLat = [SAMPLE_STORE.geo!.lng, SAMPLE_STORE.geo!.lat];
const plan = planFilm({ pin, route: start.coords, steps: start.steps, area: "Jhamsikhel", hasDoor: true });

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

describe("the Visit film", () => {
  it("runs the route → the start → the way → the door → directions", () => {
    expect(SCENES.map((s) => s.id)).toEqual(["open", "street", "route", "door", "arrive"]);
    expect(SCENES[0].from).toBe(0);
    for (let i = 1; i < SCENES.length; i++) expect(SCENES[i].from).toBeGreaterThan(SCENES[i - 1].from);
    expect(SCENES.at(-1)!.from).toBeLessThan(FILM_SECONDS);
    expect(sceneAt(0)).toBe("open");
    expect(sceneAt(sceneStart("route") + 0.01)).toBe("route");
    expect(sceneAt(FILM_SECONDS)).toBe("arrive");
    expect(sceneAt(-5)).toBe("open");
  });

  it("opens on the whole route, drawn, with the store lit and no words in the way", () => {
    const first = plan.frame(0);
    expect(first.overview).toBe(1);
    expect(first.drawn).toBe(1);
    expect(first.arrived).toBe(1);
    expect(first.caption).toBeNull();
    expect(first.panel).toBe(false);
  });

  it("drops to where the route begins, clearing the line before it is walked", () => {
    const end = plan.frame(sceneStart("route") - 0.001);
    expect(end.overview).toBeCloseTo(0, 2);
    expect(end.drawn).toBe(0);
    expect(end.arrived).toBe(0);
    expect(distance(end.map.center, start.coords[0])).toBeLessThan(40);
    expect(end.map.pitch).toBeGreaterThan(50);
    expect(plan.frame(sceneStart("street") + 0.5).caption).toBe("Start here.");
    // The line only ever pulls back during this scene.
    let drawn = 1;
    for (let t = sceneStart("street"); t < sceneStart("route"); t += 0.1) {
      expect(plan.frame(t).drawn).toBeLessThanOrEqual(drawn + 1e-9);
      drawn = plan.frame(t).drawn;
    }
  });

  it("walks the route, drawing the line and lighting the receipt lines in order, and never jumps", () => {
    expect(plan.metres).toBeCloseTo(lengthMeters(start.coords), 6);
    let drawn = 0;
    let step = -1;
    let prev = plan.frame(sceneStart("route")).map;
    for (let t = sceneStart("route"); t <= sceneStart("arrive"); t += 0.05) {
      const f = plan.frame(t);
      expect(f.drawn).toBeGreaterThanOrEqual(drawn - 1e-9);
      expect(f.step).toBeGreaterThanOrEqual(step);
      expect(Math.abs(f.map.zoom - prev.zoom)).toBeLessThan(0.4);
      expect(Math.abs(f.map.pitch - prev.pitch)).toBeLessThan(4);
      expect(Math.abs(((f.map.bearing - prev.bearing + 540) % 360) - 180)).toBeLessThan(12);
      expect(distance(f.map.center, prev.center)).toBeLessThan(40);
      drawn = f.drawn;
      step = f.step;
      prev = f.map;
    }
    expect(plan.frame(sceneStart("route") + 0.05).caption).toBe(start.steps[0].text);
    expect(start.steps.map((s) => s.text)).toContain(plan.frame(sceneStart("door") - 0.05).caption);
  });

  it("pushes in on the door and lights the store, then opens the directions beside the whole route", () => {
    const door = plan.frame(sceneStart("door") + 1);
    expect(door.drawn).toBe(1);
    expect(door.step).toBe(start.steps.length - 1);
    expect(door.caption).toBe("One door.");
    expect(door.panel).toBe(false);
    const arrive = plan.frame(sceneStart("arrive"));
    expect(arrive.arrived).toBe(1);
    expect(arrive.map.zoom).toBeGreaterThan(18);
    expect(distance(arrive.map.center, pin)).toBeLessThan(1);
    const end = plan.frame(FILM_SECONDS);
    expect(end.panel).toBe(true);
    expect(end.overview).toBe(1);
    expect(end.caption).toBeNull();
  });

  it("still plays with no route, and with no door yet", () => {
    const noRoute = planFilm({ pin, route: null, steps: [], area: "Jhamsikhel", hasDoor: true });
    expect(noRoute.metres).toBe(0);
    expect(noRoute.frame(0).drawn).toBe(0);
    expect(noRoute.frame(sceneStart("route") + 2).drawn).toBe(0);
    expect(noRoute.frame(sceneStart("route") + 2).map.center).toEqual(pin);
    expect(noRoute.frame(FILM_SECONDS).panel).toBe(true);
    const soon = planFilm({ pin, route: null, steps: [], area: "Jhamsikhel", hasDoor: false });
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
  it("shows the camera's height in a few characters", () => {
    expect(altitudeMetres(16.5, 27.7)).toBeLessThan(3000);
    expect(altitudeMetres(12, 27.7)).toBeGreaterThan(altitudeMetres(16, 27.7));
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
