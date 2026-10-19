import { describe, expect, it } from "vitest";

import { clearGround, colourName, frameFor, readPixels, toHex } from "@/lib/photo-magic";

/** A picture: light grey ground, an olive "garment" from (30,40) to (69,89), a white print inside it. */
function picture(w = 100, h = 125, noisy = false) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const garment = x >= 30 && x < 70 && y >= 40 && y < 90;
      const print = garment && x >= 45 && x < 55 && y >= 55 && y < 65;
      const n = noisy ? ((x * 7 + y * 13) % 50) - 25 : 0;
      const c = print ? [236, 236, 234] : garment ? [91, 95, 58] : [236 + (n > 0 ? 0 : n / 5), 236, 234];
      d.set([c[0], c[1], c[2], 255], i);
    }
  return d;
}

describe("photo magic", () => {
  it("finds the ground, the garment's box, colour and centre", () => {
    const r = readPixels(picture(), 100, 125);
    expect(r.plain).toBe(true);
    expect(toHex(r.ground)).toBe("#ececea");
    expect(r.box).toEqual({ x: 30, y: 40, w: 40, h: 50 });
    expect(colourName(r.colour)).toBe("Olive");
    expect(r.focus.x).toBeCloseTo(0.5, 1);
    expect(r.focus.y).toBeCloseTo(0.52, 1);
  });

  it("frames the garment at 4:5 with even room, inside the picture", () => {
    const f = frameFor({ x: 30, y: 40, w: 40, h: 50 }, 100, 125);
    expect(f.w / f.h).toBeCloseTo(0.8, 1);
    expect(f.x + f.w / 2).toBeCloseTo(50, 0);
    expect(f.y + f.h / 2).toBeCloseTo(65, 0);
    // A garment near the edge: the frame slides back in.
    const g = frameFor({ x: 0, y: 0, w: 40, h: 50 }, 100, 125);
    expect(g.x).toBe(0);
    expect(g.y).toBe(0);
  });

  it("clears the ground but keeps a white print inside the garment", () => {
    const d = picture();
    clearGround(d, 100, 125, [236, 236, 234]);
    const alpha = (x: number, y: number) => d[(y * 100 + x) * 4 + 3];
    expect(alpha(5, 5)).toBe(0);
    expect(alpha(50, 70)).toBe(255);
    expect(alpha(50, 60)).toBe(255); // the print
    expect(alpha(30, 60)).toBe(140); // the soft edge
  });

  it("knows a busy background isn't plain", () => {
    const d = new Uint8ClampedArray(100 * 125 * 4);
    for (let i = 0; i < 100 * 125; i++) d.set([(i * 37) % 255, (i * 91) % 255, (i * 53) % 255, 255], i * 4);
    expect(readPixels(d, 100, 125).plain).toBe(false);
  });

  it("names everyday colours", () => {
    expect(colourName([17, 17, 17])).toBe("Black");
    expect(colourName([30, 42, 70])).toBe("Navy");
    expect(colourName([245, 245, 242])).toBe("White");
  });
});
