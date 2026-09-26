import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { getDb, schema } from "@/lib/db";
import { addDays, ktmDay, ktmMidnight, ktmStamp } from "@/lib/ktm-day";
import { activeOrders, ordersFor, ordersWithPaymentAttempts, paidOrders, searchOrders, staffQueueCounts, writeOrder, type Order } from "@/lib/orders";
import { cardSales, csvCell, netSales, ordersCsv, salesReport } from "@/lib/reports";

// The order lists and sales numbers staff rely on, against a real PostgreSQL.

let db: Awaited<ReturnType<typeof getDb>>;
let seq = 0;

function order(over: Partial<Order> = {}): Order {
  seq += 1;
  const at = over.createdAt ?? new Date().toISOString();
  return {
    id: randomUUID(),
    number: `EP-${String(9_300_000 + Math.floor(Math.random() * 600_000) + seq)}`,
    phone: "9800000000",
    method: "pickup",
    provider: "esewa",
    lines: [{ sku: "CAP01-BLA-ONE", slug: "six-panel-cap", name: "Six-Panel Cap", size: "ONE", colour: "Black", unitPrice: 1000, qty: 2 }],
    subtotal: 2000,
    deliveryFee: 0,
    total: 2000,
    status: "paid",
    createdAt: at,
    expiresAt: at,
    kind: "goods",
    ...over,
  };
}

const save = (o: Order, userId: string | null = null) => db.transaction((tx) => writeOrder(tx, o, userId, true));

async function user(phone: string) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.users).values({ id, phone, createdAt: now, lastLoginAt: now });
  return id;
}

beforeAll(async () => {
  db = await getDb();
});

describe("Kathmandu days", () => {
  it("buckets by the calendar day in Nepal (UTC+5:45)", () => {
    expect(ktmDay("2026-09-25T18:14:00Z")).toBe("2026-09-25");
    expect(ktmDay("2026-09-25T18:15:00Z")).toBe("2026-09-26");
    expect(ktmMidnight("2026-09-26").toISOString()).toBe("2026-09-25T18:15:00.000Z");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(ktmStamp("2026-09-25T18:15:09Z")).toBe("2026-09-26 00:00:09");
  });
});

describe("paid orders", () => {
  it("never include orders cancelled before payment", async () => {
    const paid = order({ paidAt: new Date().toISOString() });
    const cancelled = order({ status: "cancelled" });
    await save(paid);
    await save(cancelled);
    const ids = (await paidOrders()).map((o) => o.id);
    expect(ids).toContain(paid.id);
    expect(ids).not.toContain(cancelled.id);
  });

  it("queues: active orders and counts, gifts waiting on a size and gift cards not to pack", async () => {
    const before = await staffQueueCounts();
    const pack = order({ paidAt: new Date().toISOString() });
    const card = order({ paidAt: new Date().toISOString(), kind: "gift_card", lines: [] });
    const waiting = order({
      paidAt: new Date().toISOString(),
      gift: { mode: "pick", token: randomUUID(), receiverName: "Asha", receiverPhone: null, senderName: null, message: "", wrap: "standard", deliverOn: null, colourChoice: false, status: "opened" },
    });
    const flagged = order({ status: "expired", attention: "Paid after the hold ended" });
    const done = order({ paidAt: new Date().toISOString(), status: "completed" });
    for (const o of [pack, card, waiting, flagged, done]) await save(o);
    const after = await staffQueueCounts();
    expect(after.toPack - before.toPack).toBe(1);
    expect(after.attention - before.attention).toBe(1);
    const ids = (await activeOrders()).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining([pack.id, card.id, waiting.id, flagged.id]));
    expect(ids).not.toContain(done.id);
  });

  it("lists expired orders with a payment attempt for checking", async () => {
    const tried = order({ status: "expired", payments: [{ provider: "esewa", ref: "x-1", startedAt: new Date().toISOString() }] });
    const never = order({ status: "expired" });
    await save(tried);
    await save(never);
    const ids = (await ordersWithPaymentAttempts(7)).map((o) => o.id);
    expect(ids).toContain(tried.id);
    expect(ids).not.toContain(never.id);
  });

  it("rewrites order lines only when they change", async () => {
    const o = order({ paidAt: new Date().toISOString() });
    await save(o);
    await db.update(schema.orderLines).set({ unitPrice: 1 }).where(eq(schema.orderLines.orderId, o.id));
    // Same lines: the stored rows are left alone (the marker survives).
    await db.transaction((tx) => writeOrder(tx, { ...o, packedAt: new Date().toISOString() }, null, false, o.lines));
    expect((await db.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, o.id)))[0].unitPrice).toBe(1);
    // Changed lines: rewritten.
    const lines = [{ ...o.lines[0], qty: 1 }];
    await db.transaction((tx) => writeOrder(tx, { ...o, lines }, null, false, o.lines));
    const rows = await db.select().from(schema.orderLines).where(eq(schema.orderLines.orderId, o.id));
    expect(rows.map((r) => [r.qty, r.unitPrice])).toEqual([[1, 1000]]);
  });
});

describe("staff search", () => {
  it("treats % and _ as plain characters and needs a few characters", async () => {
    await save(order({ paidAt: new Date().toISOString() }));
    expect(await searchOrders("%%%")).toEqual([]);
    expect(await searchOrders("___")).toEqual([]);
    expect(await searchOrders("EP")).toEqual([]);
    expect(await searchOrders("EP-")).toEqual([]);
    expect(await searchOrders("12")).toEqual([]);
  });

  it("finds by the last 4 digits of the phone", async () => {
    const o = order({ phone: "9812347391", paidAt: new Date().toISOString() });
    await save(o);
    expect((await searchOrders("7391")).map((x) => x.id)).toContain(o.id);
  });
});

describe("an account's orders", () => {
  it("includes guest orders with the phone, never another account's", async () => {
    const phone = "9811112222";
    const me = await user(phone);
    const other = await user("9811113333");
    const mine = order({ phone });
    const guest = order({ phone });
    const theirs = order({ phone });
    await save(mine, me);
    await save(guest, null);
    await save(theirs, other);
    const ids = (await ordersFor(me, phone)).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining([mine.id, guest.id]));
    expect(ids).not.toContain(theirs.id);
  });
});

describe("reports", () => {
  // A day in the past no other test writes to.
  const now = Date.parse("2020-01-10T12:00:00Z");

  it("uses Kathmandu calendar days and skips unpaid, fully refunded and converted gifts as sales", async () => {
    // 00:05 on 10 Jan in Kathmandu = 18:20 UTC on 9 Jan.
    const early = order({ paidAt: "2020-01-09T18:20:00.000Z", createdAt: "2020-01-09T18:10:00.000Z" });
    // 23:50 on 3 Jan in Kathmandu: just before a 7-day window that starts at midnight on the 4th.
    const outside = order({ paidAt: "2020-01-03T18:05:00.000Z", createdAt: "2020-01-03T18:00:00.000Z" });
    const unpaid = order({ status: "cancelled", createdAt: "2020-01-10T05:00:00.000Z" });
    const refunded = order({
      status: "cancelled",
      paidAt: "2020-01-10T05:00:00.000Z",
      createdAt: "2020-01-10T04:55:00.000Z",
      refunds: [{ at: "2020-01-10T06:00:00.000Z", by: "owner", amount: 2000, toGiftCard: 0, skus: ["CAP01-BLA-ONE"], lines: [{ i: 0, qty: 2 }] }],
    });
    const converted = order({
      paidAt: "2020-01-10T05:00:00.000Z",
      createdAt: "2020-01-10T04:55:00.000Z",
      gift: { mode: "pick", token: randomUUID(), receiverName: "Asha", receiverPhone: null, senderName: null, message: "", wrap: "standard", deliverOn: null, colourChoice: false, status: "converted", convertedCardCode: "EPG-TEST" },
    });
    for (const o of [early, outside, unpaid, refunded, converted]) await save(o);

    const r = await salesReport(7, now);
    expect(r.rows).toHaveLength(7);
    expect(r.rows[0].day).toBe("2020-01-10");
    expect(r.rows[6].day).toBe("2020-01-04");
    expect(r.rows[0]).toEqual({ day: "2020-01-10", sales: 2000, orders: 1, pieces: 2, cards: 2000 });
    expect(r.totals).toEqual({ sales: 2000, orders: 1, pieces: 2, cards: 2000 });

    expect(netSales(converted)).toBe(0);
    expect(cardSales(converted)).toBe(2000);

    const csv = await ordersCsv(7, now);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const rows = csv.slice(1).split("\n");
    expect(rows).toHaveLength(4); // header + early, refunded, converted
    expect(rows.find((l) => l.startsWith(early.number))).toContain(",2020-01-10 00:05:00,");
    expect(rows.find((l) => l.startsWith(converted.number))).toContain(",gift_to_card,");
    expect(csv).not.toContain(unpaid.number);
    expect(csv).not.toContain(outside.number);
  });

  it("guards CSV cells against spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@x")).toBe("'@x");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell(-2)).toBe("-2");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
});
