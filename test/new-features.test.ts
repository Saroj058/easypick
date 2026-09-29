import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// A signed-out visitor on a fixed network, for event de-duplication.
const net = vi.hoisted(() => ({ ip: "203.0.113.7", ua: "test-agent" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": net.ip, "user-agent": net.ua }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

import { getDb, giftCardRow, schema } from "@/lib/db";
import { recordEvent } from "@/lib/events";
import { issueGiftCard } from "@/lib/gift-cards";
import { isNewProduct } from "@/lib/newness";
import { getTrending, scoreOf } from "@/lib/trending";
import type { Drop } from "@/lib/types";
import { claimCard, walletFor } from "@/lib/wallet";

let db: Awaited<ReturnType<typeof getDb>>;
beforeAll(async () => {
  db = await getDb();
});

const DAY = 86_400_000;
const drop = (slug: string, daysAgo: number): Drop => ({ slug, name: `Drop ${slug}`, story: "", releaseAt: new Date(Date.now() - daysAgo * DAY).toISOString(), pieceCount: 0 });

describe("New in", () => {
  it("is new for 30 days after going live", () => {
    expect(isNewProduct({ dropSlug: null, liveAt: new Date(Date.now() - 5 * DAY).toISOString(), status: "live" }, [])).toBe(true);
    expect(isNewProduct({ dropSlug: null, liveAt: new Date(Date.now() - 31 * DAY).toISOString(), status: "live" }, [])).toBe(false);
  });
  it("stops being new once two more drops have launched", () => {
    const drops = [drop("01", 20), drop("02", 10), drop("03", 1)];
    expect(isNewProduct({ dropSlug: "01", status: "live" }, drops)).toBe(false);
    expect(isNewProduct({ dropSlug: "02", status: "live" }, drops)).toBe(true);
  });
  it("never shows drafts, scheduled pieces or pieces with no date as new", () => {
    expect(isNewProduct({ dropSlug: null, status: "live" }, [])).toBe(false);
    expect(isNewProduct({ dropSlug: null, liveAt: new Date().toISOString(), status: "scheduled" }, [])).toBe(false);
  });
});

describe("Trending", () => {
  it("weights orders most and views least", () => {
    expect(scoreOf({ orders: 3, bag: 2, save: 1, restock: 1, view: 10 })).toBeCloseTo(3 * 5 + 2 * 2 + 1 + 2 + 1);
  });
  it("shows an honest fallback (not a fake ranking) while there's too little data", async () => {
    const t = await getTrending();
    expect(t.mode).toBe("picks");
  });
});

describe("Product events", () => {
  it("counts one view per person per product per day", async () => {
    const slug = `evt-${randomUUID().slice(0, 8)}`;
    await recordEvent(slug, "view");
    await recordEvent(slug, "view");
    net.ua = "another-browser"; // someone else (off Vercel every visitor shares the "local" address)
    await recordEvent(slug, "view");
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.productEvents).where(eq(schema.productEvents.productSlug, slug));
    expect(n).toBe(2);
  });
});

describe("Gift card wallet", () => {
  it("saves a card to one account only, and lists it there", async () => {
    const card = await issueGiftCard({ value: 2000, status: "active", purchaserPhone: "9800000000", recipientName: "Test", recipientPhone: null, message: "", senderName: null, sendOn: null, orderId: null });
    const a = `user-a-${randomUUID()}`;
    const b = `user-b-${randomUUID()}`;
    expect((await claimCard(card.code, a)).ok).toBe(true);
    const taken = await claimCard(card.code, b);
    expect(taken.ok).toBe(false);
    const wallet = await walletFor(a);
    expect(wallet.map((c) => c.code)).toContain(card.code);
    expect(wallet[0].usable).toBe(true);
    expect(await walletFor(b)).toHaveLength(0);
  });
  it("shows a used-up card as not usable", async () => {
    const card = await issueGiftCard({ value: 1000, status: "active", purchaserPhone: "9800000000", recipientName: "Test", recipientPhone: null, message: "", senderName: null, sendOn: null, orderId: null });
    const owner = `user-c-${randomUUID()}`;
    await claimCard(card.code, owner);
    const [row] = await db.select().from(schema.giftCards).where(eq(schema.giftCards.code, card.code));
    await db.update(schema.giftCards).set(giftCardRow({ ...row.data, balance: 0 })).where(eq(schema.giftCards.code, card.code));
    expect((await walletFor(owner))[0].usable).toBe(false);
  });
});
