import { describe, expect, it } from "vitest";

import { SCENES } from "@/lib/visit/film";
import { guideLine, type GuideContext } from "@/lib/visit/guide";

const steps = [{ text: "Jhamsikhel Chowk" }, { text: "West, past the café row" }, { text: "Black shutter, lime dot" }];
const base: GuideContext = { scene: "open", soon: false, area: "Jhamsikhel", from: "Jhamsikhel Chowk", walk: 8, steps, step: -1, panel: false, plain: false, canLocate: true };

describe("what Pick says on the Visit page", () => {
  it("says hello on the first screen, with the walk and the two ways to visit", () => {
    expect(guideLine(base)).toBe("Namaste, I'm Pick. The lime line is the way to our door, about 8 minutes on foot. Come in person, or walk the store from here.");
    expect(guideLine({ ...base, from: null, walk: null })).toContain("The big pin is us.");
  });

  it("names where the route starts, and says so when it starts from the visitor", () => {
    expect(guideLine({ ...base, scene: "street" })).toBe("We start at Jhamsikhel Chowk.");
    expect(guideLine({ ...base, scene: "street", from: "Your location" })).toBe("We start from where you are.");
  });

  it("reads the route one step at a time", () => {
    expect(guideLine({ ...base, scene: "route", step: 1 })).toBe("2 of 3: West, past the café row.");
    expect(guideLine({ ...base, scene: "route", step: -1 })).toBe("Follow the lime line with me.");
  });

  it("points out the door, then what the directions can do", () => {
    expect(guideLine({ ...base, scene: "door" })).toBe("This is us. Black shutter, lime dot.");
    expect(guideLine({ ...base, scene: "arrive", panel: true })).toContain("From my location");
    expect(guideLine({ ...base, scene: "arrive", panel: true, canLocate: false })).toBe("Your directions are ready. The lime button opens Google Maps.");
  });

  it("before opening day promises no door and no route", () => {
    for (const s of SCENES) {
      const line = guideLine({ ...base, soon: true, from: null, walk: null, steps: [], scene: s.id, panel: s.id === "arrive" });
      expect(line).not.toMatch(/lime line|Google Maps|shutter/);
    }
    expect(guideLine({ ...base, soon: true, scene: "open" })).toContain("opening soon, around Jhamsikhel");
  });

  it("always has something short to say", () => {
    for (const s of SCENES)
      for (const panel of [false, true])
        for (const plain of [false, true]) {
          const line = guideLine({ ...base, scene: s.id, panel, plain, step: 0 });
          expect(line.length).toBeGreaterThan(10);
          expect(line.length).toBeLessThanOrEqual(150);
        }
  });
});
