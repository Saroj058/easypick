import { describe, expect, it } from "vitest";

import { bodyOf, hasFit, matchSize, normalizeFit } from "@/lib/fit-profile";
import { chestFromBrand, estimateBody, jeansFor, recommend, waistFromJeans } from "@/lib/size-maths";
import { typicalSizes } from "@/lib/typical-sizes";
import type { Size } from "@/lib/types";

const ALL: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];
const tees = typicalSizes("tees", "regular", ALL);
const jeans = typicalSizes("jeans", "regular", ALL);

describe("body from height and weight", () => {
  it("is sensible for an average man, and grows with weight", () => {
    const b = estimateBody(170, 65);
    expect(b.chest).toBeGreaterThanOrEqual(90);
    expect(b.chest).toBeLessThanOrEqual(96);
    expect(b.waist).toBeGreaterThanOrEqual(80);
    expect(b.waist).toBeLessThanOrEqual(86);
    expect(estimateBody(170, 85).chest).toBeGreaterThan(b.chest);
    expect(estimateBody(170, 65, "broad").chest).toBeGreaterThan(b.chest);
    expect(estimateBody(170, 65, "belly").waist).toBeGreaterThan(b.waist);
  });
});

describe("recommend", () => {
  it("gives M in a regular tee to an average man, XL when he wants it oversized", () => {
    const body = { ...estimateBody(170, 65), heightCm: 170, basis: "estimate" as const };
    expect(recommend("tees", "regular", tees, body)?.size).toBe("M");
    expect(recommend("tees", "regular", tees, { ...body, pref: "oversized" })?.size).toBe("XL");
    expect(recommend("tees", "regular", tees, body)?.confidence).not.toBe("high"); // only an estimate
  });

  it("keeps an oversized piece's look: the room is never less than its cut", () => {
    const body = { ...estimateBody(170, 65), heightCm: 170, basis: "estimate" as const };
    const big = typicalSizes("tees", "oversized", ALL);
    expect(recommend("tees", "oversized", big, body)?.size).toBe("M");
  });

  it("sizes bottoms on the waist, and caps not at all", () => {
    const body = { ...estimateBody(175, 75), basis: "estimate" as const };
    expect(recommend("jeans", "regular", jeans, body)?.on).toBe("waist");
    expect(recommend("accessories", undefined, {}, body)).toBeNull();
  });

  it("falls back to the chart when a piece has no measurements", () => {
    const r = recommend("hoodies", "regular", {}, { chest: 100, basis: "estimate" });
    expect(r).toMatchObject({ size: "L", typical: true, confidence: "low" });
    expect(recommend("hoodies", "regular", {}, { chest: 130, basis: "estimate" })?.size).toBe("XXL");
  });
});

describe("other brands", () => {
  it("reads a brand size as a chest, and jeans inches as a waist", () => {
    expect(chestFromBrand("generic", "M")).toBe(98);
    expect(chestFromBrand("uniqlo", "M")).toBeLessThan(chestFromBrand("hm", "M")!);
    expect(waistFromJeans(32)).toBe(83);
    expect(jeansFor(83)).toBe(32);
  });
});

describe("the saved profile", () => {
  it("keeps old saves working and drops nonsense", () => {
    expect(normalizeFit({ chest: 104, length: 70 })).toEqual({ chest: 104, length: 70 });
    expect(normalizeFit({ chest: 999, heightCm: 300, weightKg: 70, shape: "huge", pref: "regular" })).toEqual({ pref: "regular" });
    expect(normalizeFit([1, 2])).toEqual({});
    expect(normalizeFit({ brand: { id: "zara", size: "L" } })).toEqual({ brand: { id: "zara", size: "L" } });
  });

  it("knows when there's a size to use", () => {
    expect(hasFit({})).toBe(false);
    expect(hasFit({ heightCm: 170 })).toBe(false);
    expect(hasFit({ heightCm: 170, weightKg: 65 })).toBe(true);
    expect(hasFit({ brand: { id: "nike", size: "M" } })).toBe(true);
  });

  it("blends a brand size with height and weight, trusting the brand more", () => {
    const b = bodyOf({ heightCm: 170, weightKg: 65, brand: { id: "generic", size: "L" } })!;
    expect(b.basis).toBe("both");
    expect(b.chest).toBeGreaterThan(estimateBody(170, 65).chest);
  });

  it("matches from a garment they own the old way, and from their body otherwise", () => {
    expect(matchSize("tees", tees, { chest: 104 })?.size).toBe("M");
    expect(matchSize("tees", tees, { heightCm: 170, weightKg: 65 })?.rec).toBeDefined();
    expect(matchSize("accessories", {}, { heightCm: 170, weightKg: 65 })).toBeNull();
  });
});
