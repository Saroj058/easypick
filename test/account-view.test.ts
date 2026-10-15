import { describe, expect, it } from "vitest";

import { giftStage, giftsSent, nowOrder, orderStage, pastOrders, picksFor, usualSize } from "@/lib/account-view";
import type { Order } from "@/lib/orders";
import type { Product } from "@/lib/types";

// The account dashboard's choices: what needs the customer now, which orders and gifts to list,
// their usual size and the pieces picked for them.

const NOW = Date.parse("2026-10-15T08:00:00Z");
let n = 0;
function order(o: Partial<Order>): Order {
  n += 1;
  return {
    id: `o${n}`,
    number: `EP-${1000 + n}`,
    phone: "9800000000",
    method: "pickup",
    provider: "esewa",
    lines: [{ sku: `S${n}-M`, slug: `p${n}`, name: `Piece ${n}`, size: "M", colour: "Black", unitPrice: 1000, qty: 1 }],
    subtotal: 1000,
    deliveryFee: 0,
    total: 1000,
    status: "completed",
    createdAt: new Date(NOW - n * 86_400_000).toISOString(),
    expiresAt: new Date(NOW - n * 86_400_000 + 900_000).toISOString(),
    paidAt: new Date(NOW - n * 86_400_000).toISOString(),
    kind: "goods",
    ...o,
  } as Order;
}

describe("what needs them now", () => {
  it("an unpaid order still open comes first, then ready, on its way, then packing", () => {
    const ready = order({ status: "ready_for_pickup" });
    const unpaid = order({ status: "awaiting_payment", paidAt: undefined, expiresAt: new Date(NOW + 600_000).toISOString() });
    expect(nowOrder([ready, unpaid], NOW)?.id).toBe(unpaid.id);
    expect(nowOrder([ready, order({ status: "paid" })], NOW)?.id).toBe(ready.id);
  });
  it("ignores expired unpaid orders, gifts and gift cards", () => {
    const stale = order({ status: "awaiting_payment", paidAt: undefined, expiresAt: new Date(NOW - 1).toISOString() });
    const gift = order({ status: "paid", gift: { status: "sent" } as Order["gift"] });
    const card = order({ status: "paid", kind: "gift_card" });
    expect(nowOrder([stale, gift, card], NOW)).toBeNull();
  });
  it("lime only when there's something to do", () => {
    expect(orderStage(order({ status: "ready_for_pickup" })).act).toBe(true);
    expect(orderStage(order({ status: "completed" })).act).toBe(false);
  });
});

describe("lists", () => {
  it("orders: paid ones, not gifts, not unpaid or never-paid cancels", () => {
    const keep = order({});
    const gift = order({ gift: { status: "sent" } as Order["gift"] });
    const unpaid = order({ status: "awaiting_payment", paidAt: undefined });
    const cancelledUnpaid = order({ status: "cancelled", paidAt: undefined });
    expect(pastOrders([keep, gift, unpaid, cancelledUnpaid]).map((o) => o.id)).toEqual([keep.id]);
  });
  it("gifts sent, with a calm word for each stage", () => {
    const g = order({ status: "paid", gift: { status: "opened", receiverName: "Sita Rai" } as Order["gift"] });
    expect(giftsSent([g, order({})]).map((o) => o.id)).toEqual([g.id]);
    expect(giftStage(g)).toBe("Opened");
    expect(giftStage(order({ status: "paid", gift: { status: "converted" } as Order["gift"] }))).toBe("Turned into a gift card");
    expect(giftStage(order({ status: "paid", gift: { status: "sent", pendingSend: true, deliverOn: "2026-10-20" } as Order["gift"] }))).toBe("Sends on 2026-10-20");
  });
});

describe("for them", () => {
  it("their usual size is the one they buy most, one size not counted", () => {
    const o1 = order({ lines: [{ sku: "a", slug: "a", name: "A", size: "L", colour: "Black", unitPrice: 1, qty: 2 }] });
    const o2 = order({ lines: [{ sku: "b", slug: "b", name: "B", size: "ONE", colour: "Black", unitPrice: 1, qty: 5 }] });
    expect(usualSize([o1, o2, order({})])).toBe("L");
  });
  it("picks are in stock in their size and never something they bought", () => {
    const p = (slug: string, sizes: [string, number][]): Product =>
      ({
        id: slug, slug, name: slug, category: "tees", gender: "unisex", fit: "regular", dropSlug: null, shortDescription: "", details: [], tags: [],
        colours: [{ name: "Black", hex: "#000" }], images: [], price: 1000, measurements: {}, status: "live", showOn: { website: true, kiosk: true },
        variants: sizes.map(([size, stock]) => ({ sku: `${slug}-${size}`, size, colour: "Black", stock })),
      }) as Product;
    const products = [p("bought", [["L", 5]]), p("in-l", [["L", 5]]), p("only-s", [["S", 5], ["L", 0]]), p("cap", [["ONE", 5]])];
    const o = order({ lines: [{ sku: "bought-L", slug: "bought", name: "x", size: "L", colour: "Black", unitPrice: 1000, qty: 1 }] });
    expect(picksFor(products, [o]).map((x) => x.slug).sort()).toEqual(["cap", "in-l"]);
  });
});
