import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { getDb, schema } from "@/lib/db";
import { activateGiftCard, findGiftCard, issueGiftCard, spendGiftCard } from "@/lib/gift-cards";
import { createOrder, event, findOrder, lockOrder, releaseHolds, type Order, type PaymentAttempt } from "@/lib/orders";
import { confirmPayment, SANDBOX_ATTENTION } from "@/lib/payments";
import { ordersWithUnconfirmedAttempts } from "@/lib/payment-watch";
import { checkDue, reconcileOrder } from "@/lib/reconcile";

// Money arriving where it isn't expected: after a cancel, twice, late, from a sandbox.

const SKU = "CAP01-BLA-ONE"; // from the sample catalogue
let db: Awaited<ReturnType<typeof getDb>>;

const stock = async () => (await db.select({ s: schema.variants.stock }).from(schema.variants).where(eq(schema.variants.sku, SKU)))[0].s;
const setStock = (n: number, floor = false) => db.update(schema.variants).set({ stock: n, lastPieceOnFloor: floor }).where(eq(schema.variants.sku, SKU));

let phoneN = 0;
function draft(): Omit<Order, "number" | "total"> {
  const now = new Date();
  return {
    id: randomUUID(),
    phone: `98130${String(++phoneN).padStart(5, "0")}`,
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

async function place(opts: Parameters<typeof createOrder>[1] = {}) {
  const r = await createOrder(draft(), opts);
  if (!r.ok) throw new Error(r.message);
  return r.order;
}

const expireNow = (id: string) =>
  db
    .update(schema.orders)
    .set({ data: sql`jsonb_set(${schema.orders.data}, '{expiresAt}', to_jsonb((now() - interval '1 minute')::text))` })
    .where(eq(schema.orders.id, id));

/** Records a payment attempt the way /pay/[id] does. */
const addAttempt = (id: string, ref: string, startedAt = new Date().toISOString()) =>
  lockOrder(id, async (o) => {
    const a: PaymentAttempt = { provider: "esewa", ref, startedAt, mode: "test" };
    o.payments = [...(o.payments ?? []), a];
    o.payment = a;
    return { save: true, result: null };
  });

/** What the owner's "Cancel" button does. */
const cancel = (id: string) =>
  lockOrder(id, async (o, tx) => {
    await releaseHolds(tx, o, "order_release", "owner");
    o.status = "cancelled";
    o.events = [...(o.events ?? []), event("owner", "Cancelled before payment")];
    return { save: true, result: null };
  });

const paid = (o: Order, ref: string, gatewayRef = `G-${ref}`) => ({ provider: "esewa" as const, ref, gatewayRef, amount: o.total });

beforeAll(async () => {
  db = await getDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("money for an order that isn't waiting for it", () => {
  it("flags a payment that arrives after the order was cancelled, without taking stock again", async () => {
    await setStock(3);
    const o = await place();
    await addAttempt(o.id, `${o.number}-aaaa0001`);
    await cancel(o.id);
    expect(await stock()).toBe(3);

    await confirmPayment(o.id, paid(o, `${o.number}-aaaa0001`, "000AFTER"));
    const after = (await findOrder(o.id))!;
    expect(after.status).toBe("cancelled");
    expect(after.attention).toMatch(/after the order was cancelled/);
    expect(after.attention).toMatch(/000AFTER/);
    expect(after.payment?.verifiedAt).toBeTruthy();
    expect(await stock()).toBe(3);
  });

  it("flags a second verified payment on a paid order, but not the same payment reported twice", async () => {
    await setStock(3);
    const o = await place();
    await addAttempt(o.id, `${o.number}-bbbb0001`);
    await addAttempt(o.id, `${o.number}-bbbb0002`);
    await confirmPayment(o.id, paid(o, `${o.number}-bbbb0001`, "000FIRST"));
    await confirmPayment(o.id, paid(o, `${o.number}-bbbb0001`, "000FIRST")); // return page + cron
    expect((await findOrder(o.id))!.attention).toBeFalsy();

    await confirmPayment(o.id, paid(o, `${o.number}-bbbb0002`, "000SECOND"));
    const after = (await findOrder(o.id))!;
    expect(after.status).toBe("paid");
    expect(after.attention).toMatch(/Paid twice/);
    expect(after.attention).toMatch(/000FIRST/);
    expect(after.attention).toMatch(/000SECOND/);
    expect(await stock()).toBe(2); // one piece, held once
  });
});

describe("late payment", () => {
  it("doesn't take the last piece kept on the shop floor", async () => {
    await setStock(2);
    const o = await place();
    await expireNow(o.id);
    expect((await findOrder(o.id))!.status).toBe("expired");
    await setStock(1, true); // one left, and it's the one on the floor
    await confirmPayment(o.id);
    const after = (await findOrder(o.id))!;
    expect(after.status).toBe("paid");
    expect(after.stockHeld).toBeFalsy();
    expect(after.attention).toMatch(/sold out/);
    expect(await stock()).toBe(1);
  });

  it("sets the gift card share to what the card could pay again", async () => {
    await setStock(3);
    const card = await issueGiftCard({
      value: 500,
      status: "pending_payment",
      purchaserPhone: "9813099999",
      recipientName: "Test",
      recipientPhone: null,
      message: "",
      senderName: null,
      sendOn: null,
      orderId: null,
    });
    await activateGiftCard(card.code);
    const o = await place({ giftCardCode: card.code });
    expect(o.giftCard).toEqual({ code: card.code, applied: 500 });
    await expireNow(o.id);
    await findOrder(o.id); // expires: 500 back on the card
    expect((await findGiftCard(card.code))!.balance).toBe(500);
    await spendGiftCard(card.code, 300, randomUUID()); // spent elsewhere meanwhile

    await confirmPayment(o.id);
    const after = (await findOrder(o.id))!;
    expect(after.status).toBe("paid");
    expect(after.giftCard).toEqual({ code: card.code, applied: 200 });
    expect(after.attention).toMatch(/gift card only had/);
    expect((await findGiftCard(card.code))!.balance).toBe(0);
  });
});

describe("sandbox payments", () => {
  it("flags a sandbox payment on the live site", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await setStock(3);
    const o = await place();
    await addAttempt(o.id, `${o.number}-cccc0001`);
    await confirmPayment(o.id, paid(o, `${o.number}-cccc0001`));
    const after = (await findOrder(o.id))!;
    expect(after.status).toBe("paid");
    expect(after.attention).toContain(SANDBOX_ATTENTION);
    expect(after.payment?.mode).toBe("test");
  });

  it("allows it quietly off the live site", async () => {
    await setStock(3);
    const o = await place();
    await addAttempt(o.id, `${o.number}-dddd0001`);
    await confirmPayment(o.id, paid(o, `${o.number}-dddd0001`));
    expect((await findOrder(o.id))!.attention).toBeFalsy();
  });
});

describe("reconciliation", () => {
  const now = Date.parse("2026-09-26T12:00:00Z");
  const at = (msAgo: number) => new Date(now - msAgo).toISOString();
  const attempt = (p: Partial<PaymentAttempt>): PaymentAttempt => ({ provider: "esewa", ref: "EP-1-x", startedAt: at(0), ...p });

  it("checks often at first, then less, and stops after 7 days or a final answer", () => {
    expect(checkDue(attempt({ startedAt: at(5 * 60_000), lastCheckedAt: at(60_000) }), now)).toBe(true);
    expect(checkDue(attempt({ startedAt: at(5 * 3600_000), lastCheckedAt: at(10 * 60_000) }), now)).toBe(false);
    expect(checkDue(attempt({ startedAt: at(5 * 3600_000), lastCheckedAt: at(40 * 60_000) }), now)).toBe(true);
    expect(checkDue(attempt({ startedAt: at(8 * 86_400_000) }), now)).toBe(false);
    expect(checkDue(attempt({ startedAt: at(3 * 3600_000), lastCheckedAt: at(3600_000), lastStatus: "CANCELED" }), now)).toBe(false);
    // NOT_FOUND seen while eSewa's session might still be open isn't final.
    expect(checkDue(attempt({ startedAt: at(3 * 3600_000), lastCheckedAt: at(179 * 60_000), lastStatus: "NOT_FOUND" }), now)).toBe(true);
    expect(checkDue(attempt({ verifiedAt: at(0) }), now)).toBe(false);
    expect(checkDue(attempt({ startedAt: at(60_000), lastCheckedAt: at(10_000) }), now, 30_000)).toBe(false);
  });

  it("finds a payment for a cancelled order and flags it; lists unconfirmed attempts for the owner", async () => {
    await setStock(3);
    const o = await place();
    const ref = `${o.number}-eeee0001`;
    await addAttempt(o.id, ref);
    await cancel(o.id);
    expect((await ordersWithUnconfirmedAttempts()).some((r) => r.order.id === o.id)).toBe(true);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "COMPLETE", ref_id: "000LATE", total_amount: o.total }))));
    expect(await reconcileOrder((await findOrder(o.id))!)).toBe(true);
    const after = (await findOrder(o.id))!;
    expect(after.status).toBe("cancelled");
    expect(after.attention).toMatch(/after the order was cancelled/);
    expect((await ordersWithUnconfirmedAttempts()).some((r) => r.order.id === o.id)).toBe(false);
  });

  it("stamps attempts it asked about, so the next check waits", async () => {
    await setStock(3);
    const o = await place();
    const ref = `${o.number}-ffff0001`;
    await addAttempt(o.id, ref, new Date(Date.now() - 2 * 3600_000).toISOString());
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "NOT_FOUND" })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await reconcileOrder((await findOrder(o.id))!)).toBe(false);
    const a = (await findOrder(o.id))!.payment!;
    expect(a.lastStatus).toBe("NOT_FOUND");
    expect(a.lastCheckedAt).toBeTruthy();
    expect(await reconcileOrder((await findOrder(o.id))!)).toBe(false); // final now: not asked again
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
