import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { allProducts } from "@/lib/catalogue";
import { getDb, schema } from "@/lib/db";
import { heldBySku } from "@/lib/holds";
import { createOrder, lockOrder, type Order } from "@/lib/orders";
import { colourCodes, nextProductCode } from "@/lib/sku";
import { applyCount, parseCounts, planCount, readPlan } from "@/lib/stock-count";

// Admin catalogue: new product codes, and stock counts that don't double-count held pieces.

const A = "TEE02-OLI-M"; // from the sample catalogue
const B = "TEE02-ASH-M";
let db: Awaited<ReturnType<typeof getDb>>;

const stock = async (sku: string) => (await db.select({ s: schema.variants.stock }).from(schema.variants).where(eq(schema.variants.sku, sku)))[0].s;
const setStock = (sku: string, n: number) => db.update(schema.variants).set({ stock: n, lastPieceOnFloor: false }).where(eq(schema.variants.sku, sku));
const held = async (sku: string) => (await heldBySku(db, [sku])).get(sku) ?? 0;

async function order(sku: string, qty: number, phone: string) {
  const now = new Date();
  const draft: Omit<Order, "number" | "total"> = {
    id: randomUUID(),
    phone,
    method: "pickup",
    provider: "esewa",
    lines: [{ sku, slug: "boxy-pocket-tee", name: "Boxy Pocket Tee", size: "M", colour: "Olive", unitPrice: 1499, qty }],
    subtotal: 1499 * qty,
    deliveryFee: 0,
    status: "awaiting_payment",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    kind: "goods",
  };
  const r = await createOrder(draft);
  if (!r.ok) throw new Error(r.message);
  return r.order;
}
const change = (id: string, fn: (o: Order) => void) =>
  lockOrder(id, async (o) => {
    fn(o);
    return { save: true, result: null };
  });

beforeAll(async () => {
  db = await getDb();
});

describe("product codes", () => {
  it("takes the number after the highest one used in the category", () => {
    expect(nextProductCode("hoodies", [])).toBe("HOD01");
    expect(nextProductCode("hoodies", ["HOD01-BLA-M", "HOD03-ASH-L", "TEE09-BLA-S", "hod02-x-m"])).toBe("HOD04");
    expect(nextProductCode("tees", ["TEE09-BLA-S", "TEE10-BLA-S"])).toBe("TEE11");
  });

  it("gives every colour its own code within the product", () => {
    expect(colourCodes(["Black", "Blue", "Blush"])).toEqual(["BLA", "BLU", "BLU2"]);
    expect(colourCodes(["Black", "Black Wash", "Blackberry"])).toEqual(["BLA", "BLA2", "BLA3"]);
    expect(colourCodes(["Off-white", "Café"])).toEqual(["OFF", "CAF"]);
    expect(colourCodes(["कालो", "", "Ash"])).toEqual(["C1", "C2", "ASH"]);
  });
});

describe("reading a stock count", () => {
  it("reads sheet rows, skips the header and blanks, and reports what it can't read", () => {
    const p = parseCounts(['sku,counted,piece', '"hod01-bla-m","4",Everyday Hoodie', "HOD01-BLA-L,,Hoodie", "'TEE01-BLA-S\t0", "X-1,2.5", "X-2,-1", "X-3", "HOD01-BLA-M;6"].join("\n"));
    expect([...p.counts]).toEqual([
      ["HOD01-BLA-M", 6],
      ["TEE01-BLA-S", 0],
    ]);
    expect(p.bad).toEqual(["X-1,2.5", "X-2,-1", "X-3"]);
    expect(p.duplicates).toEqual(["HOD01-BLA-M"]);
  });

  it("refuses a tampered or broken list of changes", () => {
    expect(readPlan("nope")).toBeNull();
    expect(readPlan("[]")).toBeNull();
    expect(readPlan(JSON.stringify([{ sku: A, now: 2, delta: -3 }]))).toBeNull();
    expect(readPlan(JSON.stringify([{ sku: A, now: 2, delta: 1.5 }]))).toBeNull();
    expect(readPlan(JSON.stringify([{ sku: A, now: 2, delta: -1 }]))).toEqual([{ sku: A, now: 2, delta: -1 }]);
  });
});

describe("pieces held for orders", () => {
  it("counts placed, paid and waiting-at-the-counter orders, not ones that left the shop or were refunded", async () => {
    await setStock(A, 20);
    const base = await held(A);
    const placed = await order(A, 1, "9812100001");
    expect(await held(A)).toBe(base + 1);

    const paid = await order(A, 2, "9812100002");
    await change(paid.id, (o) => {
      o.status = "paid";
      o.paidAt = new Date().toISOString();
    });
    expect(await held(A)).toBe(base + 3);

    await change(paid.id, (o) => void (o.status = "ready_for_pickup"));
    expect(await held(A)).toBe(base + 3);

    // One of the two refunded: only one still held.
    await change(paid.id, (o) => void (o.refunds = [{ at: new Date().toISOString(), by: "test", amount: 1499, toGiftCard: 0, skus: [A], lines: [{ i: 0, qty: 1 }] }]));
    expect(await held(A)).toBe(base + 2);

    await change(paid.id, (o) => void (o.status = "out_for_delivery"));
    expect(await held(A)).toBe(base + 1);

    await change(placed.id, (o) => {
      o.status = "cancelled";
      o.stockHeld = false;
    });
    expect(await held(A)).toBe(base);
  });
});

describe("applying a stock count", () => {
  it("sets stock to counted minus held, and skips a size whose stock moved since the check", async () => {
    await setStock(A, 10);
    await setStock(B, 3);
    const o = await order(A, 2, "9812100101"); // A: 8 for sale, 2 held (still on the shelf)
    const heldA = await held(A);
    const heldB = await held(B);
    expect(heldA).toBeGreaterThanOrEqual(2);

    // Staff count every piece in the shop: the 2 held pieces are in the count.
    const counts = new Map([
      [A, 8 + heldA],
      [B, 5 + heldB],
    ]);
    const products = await allProducts();
    const plan = planCount(counts, products, await heldBySku(db));
    expect(plan.rows.find((r) => r.sku === A)).toBeUndefined(); // nothing changes: no phantom pieces
    const rowB = plan.rows.find((r) => r.sku === B)!;
    expect(rowB).toMatchObject({ now: 3, held: heldB, target: 5, delta: 2 });

    // Counted one short on A: 7 for sale.
    const plan2 = planCount(new Map([[A, 7 + heldA], [B, 5 + heldB]]), products, await heldBySku(db));
    const items = plan2.rows.map((r) => ({ sku: r.sku, now: r.now, delta: r.delta }));
    expect(items).toEqual(expect.arrayContaining([{ sku: A, now: 8, delta: -1 }, { sku: B, now: 3, delta: 2 }]));

    // A sale on B between the check and applying.
    await setStock(B, 2);
    const res = await applyCount(items, "test");
    expect(res.applied).toEqual([{ sku: A, now: 8, delta: -1 }]);
    expect(res.moved).toEqual([{ sku: B, expected: 3, actual: 2 }]);
    expect(await stock(A)).toBe(7);
    expect(await stock(B)).toBe(2);

    // Applying the same list twice changes nothing more.
    const again = await applyCount(items, "test");
    expect(again.applied).toEqual([]);
    expect(await stock(A)).toBe(7);

    await change(o.id, (x) => {
      x.status = "cancelled";
      x.stockHeld = false;
    });
  });

  it("warns when fewer are counted than are held", async () => {
    await setStock(A, 5);
    const h = await held(A);
    const o = await order(A, 1, "9812100201");
    const plan = planCount(new Map([[A, h]]), await allProducts(), await heldBySku(db)); // one held piece missing
    expect(plan.short).toEqual([expect.objectContaining({ sku: A, counted: h, held: h + 1 })]);
    expect(plan.rows.find((r) => r.sku === A)).toMatchObject({ target: 0 });
    await change(o.id, (x) => {
      x.status = "cancelled";
      x.stockHeld = false;
    });
  });
});
