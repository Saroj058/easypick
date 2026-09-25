import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { getDb, schema } from "@/lib/db";
import { createOrder, findOrder, type Order } from "@/lib/orders";
import { confirmPayment } from "@/lib/payments";

// The guarantees that protect money and stock, against a real PostgreSQL.

const SKU = "CAP01-BLA-ONE"; // from the sample catalogue
let db: Awaited<ReturnType<typeof getDb>>;

const stock = async () => (await db.select({ s: schema.variants.stock }).from(schema.variants).where(eq(schema.variants.sku, SKU)))[0].s;
const setStock = (n: number) => db.update(schema.variants).set({ stock: n, lastPieceOnFloor: false }).where(eq(schema.variants.sku, SKU));

function draft(phone: string): Omit<Order, "number" | "total"> {
  const now = new Date();
  return {
    id: randomUUID(),
    phone,
    method: "pickup",
    provider: "esewa",
    lines: [{ sku: SKU, slug: "six-panel-cap", name: "Six-Panel Cap", size: "ONE", colour: "Black", unitPrice: 999, qty: 1 }],
    subtotal: 999,
    deliveryFee: 0,
    status: "awaiting_payment",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    kind: "goods",
  };
}

beforeAll(async () => {
  db = await getDb(); // migrates and seeds the empty test database
});

describe("placing an order", () => {
  it("holds the piece at once and numbers orders from a sequence", async () => {
    await setStock(3);
    const r = await createOrder(draft("9812000001"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order.number).toMatch(/^EP-\d{7}$/);
    expect(await stock()).toBe(2);
    const lines = await db.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, r.order.id));
    expect(lines).toHaveLength(1);
    const moves = await db.select().from(schema.stockMovements).where(eq(schema.stockMovements.ref, r.order.number));
    expect(moves.map((m) => [m.reason, m.delta])).toEqual([["order_hold", -1]]);
  });

  it("sells the last piece once, even to ten people at the same moment", async () => {
    await setStock(1);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => createOrder(draft(`98120001${String(i).padStart(2, "0")}`))));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && /sold out/.test(r.message))).toBe(true);
    expect(await stock()).toBe(0);
  });

  it("never lets stock go below zero, even written directly", async () => {
    await expect(db.execute(sql`update variants set stock = -1 where sku = ${SKU}`)).rejects.toThrow();
  });
});

describe("payment", () => {
  it("counts a payment once when it's confirmed twice at the same moment", async () => {
    await setStock(2);
    const r = await createOrder(draft("9812000201"));
    if (!r.ok) throw new Error(r.message);
    await Promise.all([confirmPayment(r.order.id), confirmPayment(r.order.id)]);
    const o = (await findOrder(r.order.id))!;
    expect(o.status).toBe("paid");
    expect((o.events ?? []).filter((e) => /paid/i.test(e.what))).toHaveLength(1);
    expect(await stock()).toBe(1); // held at order time, not taken again
  });

  it("gives the piece back when an unpaid order expires, and takes it again if a late payment arrives", async () => {
    await setStock(2);
    const r = await createOrder(draft("9812000301"));
    if (!r.ok) throw new Error(r.message);
    expect(await stock()).toBe(1);
    await db
      .update(schema.orders)
      .set({ data: sql`jsonb_set(${schema.orders.data}, '{expiresAt}', to_jsonb((now() - interval '1 minute')::text))` })
      .where(eq(schema.orders.id, r.order.id));
    expect((await findOrder(r.order.id))!.status).toBe("expired");
    expect(await stock()).toBe(2);

    await confirmPayment(r.order.id);
    const o = (await findOrder(r.order.id))!;
    expect(o.status).toBe("paid");
    expect(o.stockHeld).toBe(true);
    expect(await stock()).toBe(1);
  });

  it("flags the order for staff when the late payment's piece has sold meanwhile", async () => {
    await setStock(1);
    const r = await createOrder(draft("9812000401"));
    if (!r.ok) throw new Error(r.message);
    await db
      .update(schema.orders)
      .set({ data: sql`jsonb_set(${schema.orders.data}, '{expiresAt}', to_jsonb((now() - interval '1 minute')::text))` })
      .where(eq(schema.orders.id, r.order.id));
    await findOrder(r.order.id); // expires, piece back
    const other = await createOrder(draft("9812000402")); // someone else buys it
    expect(other.ok).toBe(true);
    await confirmPayment(r.order.id);
    const o = (await findOrder(r.order.id))!;
    expect(o.status).toBe("paid");
    expect(o.attention).toBeTruthy();
    expect(await stock()).toBe(0);
  });
});
