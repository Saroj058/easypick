import { describe, expect, it } from "vitest";

import { kathmanduClock, skyOverKathmandu, sunOverKathmandu } from "@/lib/kathmandu-sky";

const at = (iso: string) => new Date(iso);

describe("the sky over Kathmandu", () => {
  it("puts the sun where it really is: high at noon, below the horizon at night", () => {
    // 7 Oct: sunrise about 06:00, noon height about 57°, sunset about 17:40.
    expect(sunOverKathmandu(at("2026-10-07T12:00+05:45")).elevation).toBeGreaterThan(54);
    expect(sunOverKathmandu(at("2026-10-07T12:00+05:45")).elevation).toBeLessThan(60);
    expect(Math.abs(sunOverKathmandu(at("2026-10-07T06:02+05:45")).elevation)).toBeLessThan(2);
    expect(Math.abs(sunOverKathmandu(at("2026-10-07T17:40+05:45")).elevation)).toBeLessThan(2);
    expect(sunOverKathmandu(at("2026-10-07T00:00+05:45")).elevation).toBeLessThan(-60);
    // Midsummer noon is nearly overhead; midwinter noon is low.
    expect(sunOverKathmandu(at("2026-06-21T12:00+05:45")).elevation).toBeGreaterThan(84);
    expect(sunOverKathmandu(at("2026-12-21T12:00+05:45")).elevation).toBeLessThan(40);
  });

  it("names the hour's picture: night, dawn, day, dusk", () => {
    expect(skyOverKathmandu(at("2026-10-07T21:30+05:45")).phase).toBe("night");
    expect(skyOverKathmandu(at("2026-10-07T06:02+05:45")).phase).toBe("dawn");
    expect(skyOverKathmandu(at("2026-10-07T12:30+05:45")).phase).toBe("day");
    expect(skyOverKathmandu(at("2026-10-07T17:36+05:45")).phase).toBe("dusk");
  });

  it("goes smoothly from dark to light, with the warm glow only around the horizon", () => {
    const night = skyOverKathmandu(at("2026-10-07T02:00+05:45"));
    const noon = skyOverKathmandu(at("2026-10-07T12:00+05:45"));
    const sunset = skyOverKathmandu(at("2026-10-07T17:38+05:45"));
    expect(night.day).toBe(0);
    expect(noon.day).toBe(1);
    expect(night.glow).toBe(0);
    expect(noon.glow).toBe(0);
    expect(sunset.glow).toBeGreaterThan(0.7);
    expect(sunset.day).toBeGreaterThan(0.2);
    expect(sunset.day).toBeLessThan(0.8);
    // Minute by minute through the evening the light only ever falls.
    let last = 1;
    for (let m = 0; m <= 120; m += 5) {
      const d = skyOverKathmandu(new Date(at("2026-10-07T16:30+05:45").getTime() + m * 60_000)).day;
      expect(d).toBeLessThanOrEqual(last + 1e-9);
      last = d;
    }
  });

  it("reads the clock in Kathmandu, whatever zone the server is in", () => {
    expect(kathmanduClock(at("2026-10-07T13:57:00Z"))).toBe("19:42");
    expect(kathmanduClock(at("2026-10-07T18:15:00Z"))).toBe("00:00");
  });
});
