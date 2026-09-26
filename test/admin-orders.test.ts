import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { getDb, schema } from "@/lib/db";
import { findGiftCard, spendGiftCard } from "@/lib/gift-cards";
import { exchangeOnePiece, refundOrderAs, type RefundInput } from "@/lib/order-admin";
import { nextStepAllowed, stepProblem } from "@/lib/order-steps";
import { createOrder, findOrder, updateOrder, type Order, type OrderLine } from "@/lib/orders";
import { confirmPayment } from "@/lib/payments";

// Owner / helper tools on a paid order: order steps, refunds and exchanges.

let db: Awaited<ReturnType<typeof getDb>>;
const M = "TEE01-BLA-M";
const L = "TEE01-BLA-L";
const stock = async (sku: string) => (await db.select({ s: schema.variants.stock }).from(schema.variants).where(eq(schema.variants.sku, sku)))[0].s;
const setStock = (sku: string, n: number) => db.update(schema.variants).set({ stock: n, lastPieceOnFloor: false }).where(eq(schema.variants.sku, sku));

const tee = (sku: string, qty: number): OrderLine => ({ sku, slug: "oversized-heavy-tee", name: "Oversized Heavy Tee", size: sku.endsWith("-L") ? "L" : "M", colour: "Black", unitPrice: 999, qty });

function draft(lines: OrderLine[], extra: Partial<Order> = {}): Omit<Order, "number" | "total"> {
  const now = new Date();
  return {
    id: randomUUID(),
    phone: "9812300001",
    method: "delivery",
    address: { area: "Baneshwor", landmark: "Temple", details: "" },
    provider: "esewa",
    lines,
    subtotal: lines.reduce((n, l) => n + l.unitPrice * l.qty, 0),
    deliveryFee: 150,
    status: "awaiting_payment",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    kind: "goods",
    ...extra,
  };
}

async function paidOrder(lines: OrderLine[], extra: Partial<Order> = {}) {
  const r = await createOrder(draft(lines, extra));
  if (!r.ok) throw new Error(r.message);
  await confirmPayment(r.order.id);
  return r.order.id;
}

const refund = (qty: Record<number, number>, more: Partial<RefundInput> = {}): RefundInput => ({ qty, restock: true, includeDelivery: false, includeWrap: false, walletRef: "REF-1", note: "", ...more });
const owner = { username: "owner", owner: true };
const helper = { username: "helper", owner: false };

beforeAll(async () => {
  db = await getDb();
});

describe("order steps", () => {
  const base = { id: "x", number: "EP-1", phone: "", method: "pickup", provider: "esewa", lines: [], subtotal: 0, deliveryFee: 0, total: 0, createdAt: "", expiresAt: "" } as const;
  const o = (extra: Partial<Order>) => ({ ...base, status: "paid", ...extra }) as Order;

  it("only moves forwards, one step at a time", () => {
    expect(nextStepAllowed(o({}), "packed")).toBe(true);
    expect(nextStepAllowed(o({}), "ready")).toBe(false);
    expect(nextStepAllowed(o({}), "completed")).toBe(false);
    expect(nextStepAllowed(o({ packedAt: "t" }), "packed")).toBe(false);
    expect(nextStepAllowed(o({ packedAt: "t" }), "ready")).toBe(true);
    expect(nextStepAllowed(o({ status: "ready_for_pickup", packedAt: "t" }), "ready")).toBe(false);
    expect(nextStepAllowed(o({ status: "out_for_delivery", packedAt: "t" }), "completed")).toBe(true);
    expect(nextStepAllowed(o({ status: "completed" }), "completed")).toBe(false);
    expect(nextStepAllowed(o({ status: "awaiting_payment" }), "packed")).toBe(false);
    expect(nextStepAllowed(o({ status: "cancelled" }), "packed")).toBe(false);
    expect(nextStepAllowed(o({}), "shipped")).toBe(false);
  });

  it("never packs gift cards or gifts still waiting on the receiver", () => {
    expect(stepProblem(o({ kind: "gift_card" }), "packed")).toMatch(/gift card/);
    const gift = (status: NonNullable<Order["gift"]>["status"], mode: "pick" | "set" = "pick") => o({ gift: { mode, status } as Order["gift"] });
    expect(nextStepAllowed(gift("converted"), "packed")).toBe(false);
    expect(nextStepAllowed(gift("sent"), "packed")).toBe(false);
    expect(nextStepAllowed(gift("opened"), "packed")).toBe(false);
    expect(nextStepAllowed(gift("chosen"), "packed")).toBe(true);
    expect(nextStepAllowed(gift("sent", "set"), "packed")).toBe(true);
  });
});

describe("refunds", () => {
  it("refuses an order that was never paid", async () => {
    await setStock(M, 5);
    const r = await createOrder(draft([tee(M, 1)]));
    if (!r.ok) throw new Error(r.message);
    const res = await refundOrderAs(r.order.id, "owner", refund({ 0: 1 }));
    expect(res).toMatchObject({ ok: false });
    expect(await stock(M)).toBe(4); // still just the hold
  });

  it("puts pieces back only when the order holds them", async () => {
    await setStock(M, 5);
    const id = await paidOrder([tee(M, 2)]);
    expect(await stock(M)).toBe(3);
    const a = await refundOrderAs(id, "owner", refund({ 0: 1 }));
    expect(a).toMatchObject({ ok: true, restocked: true });
    expect(await stock(M)).toBe(4);

    // Not holding its pieces (e.g. a late payment couldn't take them again): no phantom stock.
    await updateOrder(id, (o) => {
      o.stockHeld = false;
    });
    const b = await refundOrderAs(id, "owner", refund({ 0: 1 }));
    expect(b).toMatchObject({ ok: true, restocked: false, cancelled: true });
    expect(await stock(M)).toBe(4);
  });

  it("refunds delivery only once", async () => {
    await setStock(M, 5);
    const id = await paidOrder([tee(M, 2)]);
    expect(await refundOrderAs(id, "owner", refund({ 0: 1 }, { includeDelivery: true }))).toMatchObject({ ok: true, amount: 999 + 150, delivery: 150 });
    expect(await refundOrderAs(id, "owner", refund({}, { includeDelivery: true }))).toMatchObject({ ok: false });
    expect(await refundOrderAs(id, "owner", refund({ 0: 1 }, { includeDelivery: true }))).toMatchObject({ ok: true, amount: 999, delivery: 0 });
  });

  it("takes a bought gift card back: blocked when unspent, refused when spent", async () => {
    const buy = async () => {
      const r = await createOrder(
        { ...draft([{ sku: "GIFTCARD-2000", slug: "gift-card", name: "Easypick gift card", size: "ONE", colour: "Digital", unitPrice: 2000, qty: 1 }], { method: "pickup", address: undefined }), deliveryFee: 0, kind: "gift_card" },
        { issueCard: { value: 2000, status: "pending_payment", purchaserPhone: "9812300001", recipientName: "Asha", recipientPhone: null, recipientEmail: "a@example.com", message: "", senderName: null, sendOn: null } },
      );
      if (!r.ok) throw new Error(r.message);
      await confirmPayment(r.order.id);
      return (await findOrder(r.order.id))!;
    };

    const fresh = await buy();
    const ok = await refundOrderAs(fresh.id, "owner", refund({ 0: 1 }));
    expect(ok).toMatchObject({ ok: true, card: { code: fresh.issuedCardCode, blocked: true } });
    const card = (await findGiftCard(fresh.issuedCardCode!))!;
    expect(card.status).toBe("blocked");
    expect(card.balance).toBe(0);

    const spent = await buy();
    expect(await spendGiftCard(spent.issuedCardCode!, 500, randomUUID())).toBe(500);
    const no = await refundOrderAs(spent.id, "owner", refund({ 0: 1 }));
    expect(no).toMatchObject({ ok: false });
    expect(no && !no.ok && no.message).toMatch(/Rs 1,500/);
    const after = (await findOrder(spent.id))!;
    expect(after.refunds ?? []).toHaveLength(0);
    expect((await findGiftCard(spent.issuedCardCode!))!.status).toBe("active");
  });
});

describe("exchanges", () => {
  it("swaps one piece of a line of two", async () => {
    await setStock(M, 5);
    await setStock(L, 5);
    const id = await paidOrder([tee(M, 2)]);
    const res = await exchangeOnePiece(id, helper, { line: 0, newSku: L, override: false });
    expect(res).toMatchObject({ ok: true, fromSku: M, toSku: L });
    const o = (await findOrder(id))!;
    expect(o.lines.map((l) => [l.sku, l.qty])).toEqual([
      [M, 1],
      [L, 1],
    ]);
    expect(await stock(M)).toBe(4);
    expect(await stock(L)).toBe(4);
  });

  it("won't exchange a refunded piece", async () => {
    await setStock(M, 5);
    await setStock(L, 5);
    const id = await paidOrder([tee(M, 1), tee(L, 1)]);
    await refundOrderAs(id, "owner", refund({ 0: 1 }));
    expect(await exchangeOnePiece(id, helper, { line: 0, newSku: L, override: false })).toMatchObject({ ok: false });
  });

  it("doesn't invent stock when the order isn't holding its pieces", async () => {
    await setStock(M, 5);
    await setStock(L, 5);
    const id = await paidOrder([tee(M, 1)]);
    await updateOrder(id, (o) => {
      o.stockHeld = false;
    });
    await setStock(M, 0); // the held piece was lost, e.g. the late payment couldn't re-hold it
    const res = await exchangeOnePiece(id, helper, { line: 0, newSku: L, override: false });
    expect(res).toMatchObject({ ok: true, reheld: true });
    expect(await stock(M)).toBe(0);
    expect(await stock(L)).toBe(4);
    expect((await findOrder(id))!.stockHeld).toBe(true);
  });

  it("only the owner can allow an exchange after the window", async () => {
    await setStock(M, 5);
    await setStock(L, 5);
    const id = await paidOrder([tee(M, 1)]);
    await updateOrder(id, (o) => {
      o.paidAt = new Date(Date.now() - 10 * 86_400_000).toISOString();
    });
    expect(await exchangeOnePiece(id, helper, { line: 0, newSku: L, override: true })).toMatchObject({ ok: false, message: expect.stringMatching(/owner/) });
    expect(await exchangeOnePiece(id, owner, { line: 0, newSku: L, override: false })).toMatchObject({ ok: false });
    expect(await exchangeOnePiece(id, owner, { line: 0, newSku: L, override: true })).toMatchObject({ ok: true, override: true });
  });
});
