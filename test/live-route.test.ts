import { describe, expect, it } from "vitest";

import { fromRouting, MAX_LIVE_METRES, routingUrl } from "@/lib/map/live-route";

const pin = { lat: 27.6781, lng: 85.3052 };
const answer = {
  code: "Ok",
  routes: [
    {
      geometry: { coordinates: [[85.3138, 27.6772], [85.312, 27.6775], [85.31, 27.6778], [85.308, 27.6779], [85.306, 27.678], [85.3053, 27.6781]] },
      legs: [
        {
          steps: [
            { distance: 180, name: "Pulchowk Road", maneuver: { type: "depart" } },
            { distance: 420, name: "Jhamsikhel Road", maneuver: { type: "turn", modifier: "left" } },
            { distance: 12, name: "", maneuver: { type: "turn", modifier: "right" } },
            { distance: 240, name: "", maneuver: { type: "turn", modifier: "right" } },
            { distance: 0, name: "", maneuver: { type: "arrive" } },
          ],
        },
      ],
    },
  ],
};

describe("the way from where the visitor is", () => {
  it("asks the routing service for a walk from there to the door, longitude first", () => {
    expect(routingUrl([85.3138, 27.6772], pin)).toBe("https://routing.openstreetmap.de/routed-foot/route/v1/foot/85.313800,27.677200;85.305200,27.678100?overview=full&geometries=geojson&steps=true");
  });

  it("turns the answer into a line that ends on the pin and a short receipt with running minutes", () => {
    const route = fromRouting(answer, pin)!;
    expect(route.coords[0]).toEqual([85.3138, 27.6772]);
    expect(route.coords.at(-1)).toEqual([pin.lng, pin.lat]);
    expect(route.metres).toBeGreaterThan(700);
    expect(route.metres).toBeLessThan(1000);
    expect(route.steps.map((s) => s.text)).toEqual(["Where you are now", "Left onto Jhamsikhel Road", "Right into the lane", "Easypick: black shutter, lime dot"]);
    // Minutes only ever go up, start at 0 and end on the total.
    const mins = route.steps.map((s) => s.minutes);
    expect(mins[0]).toBe(0);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
    expect(mins.at(-1)).toBe(Math.round(route.metres / 75));
    expect(route.steps.every((s) => s.text.length <= 40)).toBe(true);
    expect(route.steps.length).toBeLessThanOrEqual(6);
  });

  it("refuses answers that aren't a usable route", () => {
    expect(fromRouting(null, pin)).toBeNull();
    expect(fromRouting({ code: "NoRoute", routes: [] }, pin)).toBeNull();
    expect(fromRouting({ code: "Ok", routes: [{ geometry: { coordinates: [[85.3, 27.6]] } }] }, pin)).toBeNull();
    // Further than the film is for: the saved start points are used instead.
    const far = { code: "Ok", routes: [{ geometry: { coordinates: [[84.9, 27.2], [85.0, 27.4], [85.3, 27.67]] }, legs: [{ steps: [] }] }] };
    expect(fromRouting(far, pin)).toBeNull();
    expect(MAX_LIVE_METRES).toBeGreaterThan(5000);
  });

  it("keeps a long route light: a few hundred points at most", () => {
    const many = Array.from({ length: 1500 }, (_, i) => [85.3138 - (i / 1500) * 0.0085, 27.6772 + (i / 1500) * 0.0009]);
    const route = fromRouting({ code: "Ok", routes: [{ geometry: { coordinates: many }, legs: [{ steps: [] }] }] }, pin)!;
    expect(route.coords.length).toBeLessThanOrEqual(402);
    expect(route.coords[0]).toEqual(many[0]);
  });
});
