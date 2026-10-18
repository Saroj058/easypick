import { describe, expect, it } from "vitest";

import { cleanOffers, DEFAULT_OFFERS, inOffer, liveOffers, running, type Offer } from "@/lib/offer-rules";
import { categoryFor, isBottom } from "@/lib/site";
import type { Product } from "@/lib/types";

const piece = (over: Partial<Product>): Product =>
  ({ id: "x", slug: "x", name: "X", category: "tees", status: "live", price: 2000, tags: [], vault: false, ...over }) as Product;

const dashain: Offer = { id: "dashain", name: "Dashain sale", note: "", tag: "dashain-offer", under: null, endsOn: "2026-10-26", on: true };
const cheap: Offer = { id: "cheap", name: "Under 1,000", note: "", tag: null, under: 1000, endsOn: null, on: true };

describe("festival offers", () => {
  it("gathers live sale pieces by tick or by price, never the Vault or full price", () => {
    expect(inOffer(dashain, piece({ salePrice: 1500, tags: ["dashain-offer"] }))).toBe(true);
    expect(inOffer(dashain, piece({ salePrice: 1500 }))).toBe(false);
    expect(inOffer(dashain, piece({ tags: ["dashain-offer"] }))).toBe(false);
    expect(inOffer(dashain, piece({ salePrice: 1500, tags: ["dashain-offer"], vault: true }))).toBe(false);
    expect(inOffer(dashain, piece({ salePrice: 1500, tags: ["dashain-offer"], status: "sold_out" }))).toBe(false);
    expect(inOffer(cheap, piece({ salePrice: 999 }))).toBe(true);
    expect(inOffer(cheap, piece({ salePrice: 1000 }))).toBe(false);
  });

  it("runs until its last day, and only while switched on", () => {
    expect(running(dashain, "2026-10-26")).toBe(true);
    expect(running(dashain, "2026-10-27")).toBe(false);
    expect(running({ ...cheap, on: false }, "2026-10-18")).toBe(false);
  });

  it("lists running offers with pieces, their count and biggest cut", () => {
    const list = liveOffers([dashain, cheap], [piece({ salePrice: 1500, tags: ["dashain-offer"] }), piece({ salePrice: 1000, tags: ["dashain-offer"] })], "2026-10-18");
    expect(list).toEqual([{ offer: dashain, count: 2, upTo: 50 }]);
  });

  it("cleans what's saved: at most three, unique ids, defaults when nothing usable", () => {
    expect(cleanOffers("nope")).toEqual(DEFAULT_OFFERS);
    const out = cleanOffers([dashain, { ...dashain }, cheap, { ...cheap, id: "c2" }, { ...cheap, id: "c3" }]);
    expect(out.map((o) => o.id)).toEqual(["dashain", "cheap"]);
  });
});

describe("the twelve kinds", () => {
  it("places an old 'bottoms' piece by its name", () => {
    expect(categoryFor("bottoms", "Baggy Jean")).toBe("jeans");
    expect(categoryFor("bottoms", "Cargo Short")).toBe("shorts");
    expect(categoryFor("bottoms", "Wide Cargo")).toBe("joggers");
    expect(categoryFor("bottoms", "Pleated Trouser")).toBe("trousers");
    expect(categoryFor("polos", "Pique Polo")).toBe("polos");
    expect(isBottom("shorts")).toBe(true);
    expect(isBottom("shirts")).toBe(false);
  });
});
