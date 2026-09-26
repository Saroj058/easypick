import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adjustStockBy, moveStock, notifyRestocked, saveDrop, StockShortError } from "@/lib/catalogue";
import { getDb, schema } from "@/lib/db";

// The stock engine against a real PostgreSQL: locking order, the shop-floor flag, restock alerts, drops.

const h = vi.hoisted(() => ({ pending: [] as (() => unknown)[] }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void h.pending.push(fn) }));
vi.mock("@/lib/notify", () => ({ notifySms: vi.fn(async () => {}), notifyEmail: vi.fn(async () => "sent") }));
const notify = await import("@/lib/notify");

let db: Awaited<ReturnType<typeof getDb>>;
let X: string;
let Y: string;

const stockOf = async (sku: string) => (await db.select().from(schema.variants).where(eq(schema.variants.sku, sku)))[0];
const setStock = (sku: string, stock: number, lastPieceOnFloor = false) => db.update(schema.variants).set({ stock, lastPieceOnFloor }).where(eq(schema.variants.sku, sku));
const runAfter = async () => {
  const fns = h.pending.splice(0);
  await Promise.all(fns.map((f) => f()));
};

beforeAll(async () => {
  db = await getDb();
  const vs = await db.select().from(schema.variants).where(eq(schema.variants.productSlug, "oversized-heavy-tee")).orderBy(asc(schema.variants.sku));
  [X, Y] = [vs[0].sku, vs[1].sku];
});

beforeEach(() => {
  h.pending.length = 0;
  vi.mocked(notify.notifySms).mockClear();
});

describe("moveStock", () => {
  it("never deadlocks when two orders list the same sizes the other way round", async () => {
    for (let round = 0; round < 15; round++) {
      await setStock(X, 1);
      await setStock(Y, 1);
      const take = (a: string, b: string) =>
        db.transaction((tx) => moveStock(tx, [{ sku: a, delta: -1 }, { sku: b, delta: -1 }], { reason: "order_hold", source: "web" }, { online: true }));
      const results = await Promise.allSettled([take(X, Y), take(Y, X), take(X, Y), take(Y, X)]);
      for (const r of results) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(StockShortError);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect((await stockOf(X)).stock).toBe(0);
      expect((await stockOf(Y)).stock).toBe(0);
    }
  });

  it("adds up moves for the same size into one change and one ledger row", async () => {
    await setStock(X, 5);
    const ref = randomUUID();
    await db.transaction((tx) =>
      moveStock(tx, [{ sku: X, delta: -1 }, { sku: Y, delta: 0 }, { sku: X, delta: -2 }], { reason: "order_hold", source: "web", ref }),
    );
    const rows = await db.select().from(schema.stockMovements).where(eq(schema.stockMovements.ref, ref));
    expect(rows.map((r) => [r.sku, r.delta, r.stockAfter])).toEqual([[X, -3, 2]]);
  });

  it("clears 'last piece on the floor' when the piece goes, and keeps it online-only-safe while it's there", async () => {
    await setStock(X, 1, true);
    await expect(db.transaction((tx) => moveStock(tx, [{ sku: X, delta: -1 }], { reason: "order_hold", source: "web" }, { online: true }))).rejects.toBeInstanceOf(
      StockShortError,
    );
    await moveStock(db, [{ sku: X, delta: -1 }], { reason: "count", source: "admin" }); // sold in store
    expect(await stockOf(X)).toMatchObject({ stock: 0, lastPieceOnFloor: false });
  });

  it("counts a size as back when online sale becomes possible, not when stock is merely above 0", async () => {
    await setStock(X, 1, true); // only the floor piece: not buyable online
    const res = await adjustStockBy("oversized-heavy-tee", { [X]: 2 }, { reason: "received" });
    expect(res).toEqual({ ok: true, restocked: [X] });
    expect(await stockOf(X)).toMatchObject({ stock: 3, lastPieceOnFloor: false });
    const again = await adjustStockBy("oversized-heavy-tee", { [X]: 1 }, { reason: "received" });
    expect(again).toEqual({ ok: true, restocked: [] });
  });
});

describe("notifyRestocked", () => {
  it("tells each waiting person once, even when two restocks report at the same moment", async () => {
    await setStock(Y, 0);
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    await db.insert(schema.restockAlerts).values(
      ids.map((id, i) => ({ id, slug: "oversized-heavy-tee", sku: Y, size: "M" as const, colour: "Black", phone: `98130000${i}0`, email: null, createdAt: new Date().toISOString(), notifiedAt: null })),
    );
    await setStock(Y, 2);
    const told = await Promise.all([notifyRestocked([Y]), notifyRestocked([Y, Y])]);
    expect(told[0] + told[1]).toBe(3);
    await runAfter();
    const phones = vi.mocked(notify.notifySms).mock.calls.map((c) => c[0]);
    expect(phones.sort()).toEqual(["9813000000", "9813000010", "9813000020"]);
    const rows = await db.select().from(schema.restockAlerts).where(inArray(schema.restockAlerts.id, ids));
    expect(rows.every((r) => r.notifiedAt)).toBe(true);
  });

  it("keeps people waiting while the size can't be bought online or the product isn't on sale", async () => {
    const id = randomUUID();
    await db.insert(schema.restockAlerts).values({ id, slug: "oversized-heavy-tee", sku: X, size: "S", colour: "Black", phone: "9813000099", email: null, createdAt: new Date().toISOString(), notifiedAt: null });
    await setStock(X, 1, true);
    expect(await notifyRestocked([X])).toBe(0);
    await setStock(X, 2);
    await db.update(schema.products).set({ status: "draft" }).where(eq(schema.products.slug, "oversized-heavy-tee"));
    expect(await notifyRestocked([X])).toBe(0);
    await db.update(schema.products).set({ status: "live" }).where(eq(schema.products.slug, "oversized-heavy-tee"));
    expect(await notifyRestocked([X])).toBe(1);
  });
});

describe("saveDrop", () => {
  const future = () => new Date(Date.now() + 7 * 86_400_000).toISOString();
  const product = async (slug: string) => (await db.select().from(schema.products).where(eq(schema.products.slug, slug)))[0];
  const drop = async (slug: string) => (await db.select().from(schema.drops).where(eq(schema.drops.slug, slug)))[0];

  it("puts a product taken out of a future drop back to draft, keeps archived members, and recounts the drop it left", async () => {
    await saveDrop({ slug: "t1", name: "Test 1", story: "", releaseAt: future() }, ["boxy-pocket-tee", "everyday-hoodie"]);
    await saveDrop({ slug: "t2", name: "Test 2", story: "", releaseAt: future() }, ["tapered-jogger"]);
    expect((await product("boxy-pocket-tee")).status).toBe("scheduled");
    await db.update(schema.products).set({ status: "archived" }).where(eq(schema.products.slug, "everyday-hoodie"));

    // Re-save t1 without the tee (the form doesn't show archived products), and move the jogger in from t2.
    await saveDrop({ slug: "t1", name: "Test 1", story: "", releaseAt: future() }, ["tapered-jogger"]);
    const tee = await product("boxy-pocket-tee");
    expect(tee.status).toBe("draft");
    expect(tee.data.dropSlug).toBeNull();
    expect((await product("everyday-hoodie")).data.dropSlug).toBe("t1");
    expect((await product("tapered-jogger")).data.dropSlug).toBe("t1");
    expect((await drop("t2")).pieceCount).toBe(0);
  });

  it("freezes the piece count once a drop is out", async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    await saveDrop({ slug: "t3", name: "Test 3", story: "", releaseAt: past }, ["six-panel-cap"]);
    const counted = (await drop("t3")).pieceCount;
    await db.update(schema.drops).set({ pieceCount: counted + 50 }).where(eq(schema.drops.slug, "t3"));
    await saveDrop({ slug: "t3", name: "Test 3 renamed", story: "", releaseAt: past }, ["six-panel-cap"]);
    expect((await drop("t3")).pieceCount).toBe(counted + 50);
  });
});
