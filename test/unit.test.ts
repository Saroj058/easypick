import { describe, expect, it } from "vitest";

import { formatPrice, normaliseNepaliMobile } from "@/lib/format";
import { normaliseCode } from "@/lib/gift-cards";
import { bySize, sellable } from "@/lib/inventory";
import { refundedQty, type Order } from "@/lib/orders";
import { payMessage, PAY_MESSAGES } from "@/lib/pay-messages";

describe("stock rules", () => {
  it("keeps the last piece on the floor for the store", () => {
    expect(sellable({ stock: 1, lastPieceOnFloor: true })).toBe(0);
    expect(sellable({ stock: 3, lastPieceOnFloor: true })).toBe(2);
    expect(sellable({ stock: 3 })).toBe(3);
    expect(sellable({ stock: 0, lastPieceOnFloor: true })).toBe(0);
  });
  it("sorts sizes the way people read them", () => {
    const sizes = (["XL", "S", "ONE", "M", "XS"] as const).map((size) => ({ size }));
    expect([...sizes].sort(bySize).map((s) => s.size)).toEqual(["XS", "S", "M", "XL", "ONE"]);
  });
});

describe("input clean-up", () => {
  it("reads Nepali mobile numbers", () => {
    expect(normaliseNepaliMobile("98 1234 5678")).toBe("9812345678");
    expect(normaliseNepaliMobile("+977-9712345678")).toBe("9712345678");
    expect(normaliseNepaliMobile("12345")).toBeNull();
  });
  it("reads gift card codes however they're typed", () => {
    expect(normaliseCode("ep 7k4m 2qxd")).toBe("EP-7K4M-2QXD");
    expect(normaliseCode("7K4M2QXD")).toBe("EP-7K4M-2QXD");
    expect(normaliseCode("EP-0000-1111")).toBeNull(); // 0 and 1 are never used
  });
  it("formats rupees", () => {
    expect(formatPrice(1999)).toMatch(/1,999/);
  });
});

describe("payment messages", () => {
  it("only shows our own words, never text from the link", () => {
    expect(payMessage("amount")).toBe(PAY_MESSAGES.amount);
    expect(payMessage("Pay on WhatsApp to 9800000000")).toBe(PAY_MESSAGES.cancelled);
    expect(payMessage(undefined)).toBe(PAY_MESSAGES.cancelled);
  });
});

describe("refunds", () => {
  it("counts what's already been refunded per line", () => {
    const o = {
      lines: [{ qty: 2 }, { qty: 1 }],
      refunds: [
        { lines: [{ i: 0, qty: 1 }] },
        { lines: [{ i: 0, qty: 1 }, { i: 1, qty: 1 }] },
      ],
    } as unknown as Order;
    expect(refundedQty(o)).toEqual([2, 1]);
  });
});
