import { describe, expect, it } from "vitest";

import { bagStorageKey, hashId, LEGACY_BAG_KEY } from "@/lib/bag-storage";
import { stockFromVariants } from "@/lib/live-stock";

describe("bag storage key", () => {
  it("is stable per account and different between accounts", () => {
    const a = bagStorageKey("7d1f6a3e-1111-4c1e-9d0a-000000000001");
    expect(bagStorageKey("7d1f6a3e-1111-4c1e-9d0a-000000000001")).toBe(a);
    expect(bagStorageKey("7d1f6a3e-1111-4c1e-9d0a-000000000002")).not.toBe(a);
    expect(a.startsWith(`${LEGACY_BAG_KEY}:`)).toBe(true);
    expect(a).not.toBe(LEGACY_BAG_KEY);
  });

  it("doesn't put the raw id in storage", () => {
    const id = "9800000000";
    expect(bagStorageKey(id)).not.toContain(id);
    expect(hashId(id)).toMatch(/^[0-9a-z]+$/);
  });
});

describe("stock from the rendered page", () => {
  it("maps variants to live stock, with the floor piece as in-store only", () => {
    const s = stockFromVariants("tee", [
      { sku: "T-M", size: "M", colour: "Black", stock: 2 },
      { sku: "T-L", size: "L", colour: "Black", stock: 1, lastPieceOnFloor: true },
    ]);
    expect(s.slug).toBe("tee");
    expect(s.sizes).toEqual([
      { size: "M", colour: "Black", stock: 2, inStoreOnly: false },
      { size: "L", colour: "Black", stock: 1, inStoreOnly: true },
    ]);
  });
});
