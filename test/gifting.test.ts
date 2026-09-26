import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Gifting guarantees: welcome credit once per person, card expiry from activation,
// send dates respected, and code guessing limited. Against a real PostgreSQL.

const h = vi.hoisted(() => ({
  pending: [] as Promise<unknown>[],
  sms: [] as { to: string | null | undefined; text: string }[],
  emails: [] as { to: string | null | undefined; text: string }[],
  ip: "203.0.113.9",
}));

// Run after() work so the messages it sends can be checked; collect it to await.
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    h.pending.push(Promise.resolve().then(fn));
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": h.ip }),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("@/lib/notify", () => ({
  notifySms: async (to: string | null | undefined, text: string) => {
    h.sms.push({ to, text });
  },
  notifyEmail: async (to: string | null | undefined, _subject: string, _html: string, text: string) => {
    h.emails.push({ to, text });
    return to ? "sent" : "skipped";
  },
}));

import { buyGiftCard, chooseGift, giftToCard, placeGiftOrder } from "@/app/gift-actions";
import { getDb, schema } from "@/lib/db";
import { sendDueGiftCards } from "@/lib/gift-card-delivery";
import { CARD_CHECK_FAILED, activateGiftCard, checkGiftCard, findGiftCard, issueGiftCard, maskCode, visitorKey } from "@/lib/gift-cards";
import { cleanGiftMessage, cleanSenderName } from "@/lib/gift-text";
import { kathmanduToday } from "@/lib/kathmandu-date";
import { createOrder, findOrder, type GiftInfo, type Order } from "@/lib/orders";
import { confirmPayment } from "@/lib/payments";

const SKU = "CAP01-BLA-ONE"; // from the sample catalogue
let db: Awaited<ReturnType<typeof getDb>>;

const flush = async () => {
  while (h.pending.length) await Promise.all(h.pending.splice(0));
};

function giftDraft(buyer: string, to: { email: string; phone?: string | null }, deliveryFee = 0): Omit<Order, "number" | "total"> {
  const now = new Date();
  const gift: GiftInfo = {
    mode: "pick",
    token: randomBytes(18).toString("base64url"),
    receiverName: "Sita Rai",
    receiverPhone: to.phone ?? null,
    receiverEmail: to.email,
    senderName: "Ram",
    message: "",
    wrap: "standard",
    deliverOn: null,
    colourChoice: false,
    showPrice: true,
    status: "sent",
  };
  return {
    id: randomUUID(),
    phone: buyer,
    method: "delivery",
    provider: "esewa",
    lines: [{ sku: SKU, slug: "six-panel-cap", name: "Six-Panel Cap", size: "ONE", colour: "Black", unitPrice: 999, qty: 1 }],
    subtotal: 999,
    deliveryFee,
    status: "awaiting_payment",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    gift,
    kind: "goods",
  };
}

async function paidGift(buyer: string, to: { email: string; phone?: string | null }, deliveryFee = 0) {
  const r = await createOrder(giftDraft(buyer, to, deliveryFee));
  if (!r.ok) throw new Error(r.message);
  await confirmPayment(r.order.id);
  await flush();
  return r.order;
}

function choose(token: string, method: "pickup" | "delivery" = "delivery") {
  const f = new FormData();
  f.set("token", token);
  f.set("size", "ONE");
  f.set("method", method);
  f.set("area", "Jhamsikhel");
  f.set("landmark", "Near the school");
  return chooseGift({ status: "idle" }, f);
}

beforeAll(async () => {
  db = await getDb();
});

beforeEach(async () => {
  await db.update(schema.variants).set({ stock: 50, lastPieceOnFloor: false }).where(eq(schema.variants.sku, SKU));
  await db.delete(schema.rateLimits);
  h.sms.length = 0;
  h.emails.length = 0;
});

describe("gift text", () => {
  it("keeps sender names to plain letters and strips links from messages", () => {
    expect(cleanSenderName("  Ram  Bahadur <b>")).toBe("Ram Bahadur b");
    expect(cleanSenderName("win at evil.com now")).toBe("win at now");
    expect(cleanSenderName("https://x.io")).toBeNull();
    expect(cleanSenderName("a".repeat(60))).toHaveLength(40);
    expect(cleanGiftMessage("Happy Dashain!\nClaim here: https://bit.ly/x or www.evil.com")).toBe("Happy Dashain! Claim here: [link removed] or [link removed]");
    expect(cleanGiftMessage("see evil.com/login")).toBe("see [link removed]");
  });

  it("masks codes and groups IPv6 visitors by /64", () => {
    expect(maskCode("EP-7K4M-2QXD")).toBe("EP-••••-2QXD");
    expect(visitorKey("2001:db8:1:2::5")).toBe(visitorKey("2001:db8:1:2:ffff::1"));
    expect(visitorKey("2001:db8:1:2::5")).not.toBe(visitorKey("2001:db8:1:3::5"));
    expect(visitorKey("1.2.3.4")).toBe("1.2.3.4");
  });

  it("uses the Kathmandu calendar day", () => {
    // 20:00 UTC is already the next morning in Kathmandu (+05:45).
    expect(kathmanduToday(new Date("2026-10-01T20:00:00Z"))).toBe("2026-10-02");
    expect(kathmanduToday(new Date("2026-10-01T18:00:00Z"))).toBe("2026-10-01");
  });
});

describe("welcome credit", () => {
  it("is given once per receiver, sent to them, and shown in full only once", async () => {
    const email = `new-${randomUUID()}@test.dev`;
    const first = await paidGift("9811000001", { email, phone: "9811000101" });
    const a = await choose(first.gift!.token);
    await flush();
    expect(a.status).toBe("done");
    const code = a.status === "done" ? a.welcome?.code : undefined;
    expect(a.status === "done" && a.welcome?.fresh).toBe(true);
    expect(code).toMatch(/^EP-/);
    expect(h.emails.some((m) => m.to === email && m.text.includes(code!))).toBe(true);
    expect(h.sms.some((m) => m.to === "9811000101" && m.text.includes(code!))).toBe(true);

    // Asking again only gets the masked code.
    const again = await choose(first.gift!.token);
    expect(again.status === "done" && again.welcome).toEqual({ code: maskCode(code!), fresh: false });

    // A second gift to the same email: no second credit.
    const second = await paidGift("9811000002", { email });
    const b = await choose(second.gift!.token);
    expect(b.status === "done" && b.welcome).toBeUndefined();
    expect((await findOrder(second.id))!.gift!.welcomeCode).toBeUndefined();

    // Same phone, different email: still the same person.
    const third = await paidGift("9811000003", { email: `other-${randomUUID()}@test.dev`, phone: "9811000101" });
    const c = await choose(third.gift!.token);
    expect(c.status === "done" && c.welcome).toBeUndefined();
  });

  it("isn't given to someone who has ordered before", async () => {
    const shopper = "9811000200";
    await paidGift(shopper, { email: `x-${randomUUID()}@test.dev` }); // the receiver-to-be has their own paid order
    const gift = await paidGift("9811000201", { email: `y-${randomUUID()}@test.dev`, phone: shopper });
    const r = await choose(gift.gift!.token);
    expect(r.status === "done" && r.welcome).toBeUndefined();
  });

  it("flags the delivery fee for refund when the receiver picks it up", async () => {
    const gift = await paidGift("9811000300", { email: `z-${randomUUID()}@test.dev` }, 150);
    await choose(gift.gift!.token, "pickup");
    const o = await findOrder(gift.id);
    expect(o!.attention).toMatch(/Refund delivery Rs\s?150 to the buyer/);
  });

  it("returns a converted card's code once, then only masked", async () => {
    const gift = await paidGift("9811000400", { email: `c-${randomUUID()}@test.dev` });
    const first = await giftToCard(gift.gift!.token);
    await flush();
    expect(first.fresh).toBe(true);
    expect(h.emails.some((m) => m.text.includes(first.code!))).toBe(true);
    const second = await giftToCard(gift.gift!.token);
    expect(second).toEqual({ ok: true, code: maskCode(first.code!), fresh: false });
  });
});

describe("bought gift cards", () => {
  it("start their 12 months when activated, not when ordered", async () => {
    const card = await issueGiftCard(
      { value: 1000, status: "pending_payment", purchaserPhone: "9811000500", recipientName: "Hari", recipientPhone: null, recipientEmail: null, message: "", senderName: null, sendOn: null, orderId: null },
      1,
    );
    await activateGiftCard(card.code);
    const after = await findGiftCard(card.code);
    expect(after!.status).toBe("active");
    expect(Date.parse(after!.expiresAt) - Date.now()).toBeGreaterThan(364 * 86_400_000);
    const [row] = await db.select().from(schema.giftCards).where(eq(schema.giftCards.code, card.code));
    expect(Date.parse(row.expiresAt)).toBe(Date.parse(after!.expiresAt));
  });

  it("with a later send date are not sent at payment, then sent once on the day", async () => {
    const tomorrow = kathmanduToday(new Date(Date.now() + 86_400_000));
    const now = new Date();
    const r = await createOrder(
      {
        id: randomUUID(),
        phone: "9811000600",
        method: "pickup",
        provider: "esewa",
        lines: [{ sku: "GIFTCARD-1000", slug: "gift-card", name: "Easypick gift card", size: "ONE", colour: "Digital", unitPrice: 1000, qty: 1 }],
        subtotal: 1000,
        deliveryFee: 0,
        status: "awaiting_payment",
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
        kind: "gift_card",
      },
      {
        issueCard: { value: 1000, status: "pending_payment", purchaserPhone: "9811000600", recipientName: "Gita", recipientPhone: "9811000601", recipientEmail: "gita@test.dev", message: "", senderName: "Ram", sendOn: tomorrow, pendingSend: true },
      },
    );
    if (!r.ok) throw new Error(r.message);
    const code = r.order.issuedCardCode!;
    await confirmPayment(r.order.id);
    await flush();
    const sentNow = [...h.sms, ...h.emails].filter((m) => m.text.includes(code));
    expect(sentNow).toHaveLength(0);
    expect((await findGiftCard(code))!.status).toBe("active");

    expect(await sendDueGiftCards()).toBe(0); // not today yet
    const onTheDay = new Date(Date.parse(`${tomorrow}T09:00:00+05:45`));
    expect(await sendDueGiftCards(onTheDay)).toBe(1);
    expect(h.sms.some((m) => m.to === "9811000601" && m.text.includes(code))).toBe(true);
    expect(h.emails.some((m) => m.to === "gita@test.dev" && m.text.includes(code))).toBe(true);
    const card = await findGiftCard(code);
    expect(card!.sentAt).toBeTruthy();
    expect(card!.pendingSend).toBe(false);
    expect(await sendDueGiftCards(onTheDay)).toBe(0); // never twice
  });

  it("must be a whole amount within the limits", async () => {
    const f = new FormData();
    f.set("custom", "750.5");
    const r = await buyGiftCard({ status: "idle" }, f);
    expect(r.status === "error" && r.message).toMatch(/whole amount/);
  });
});

describe("limits", () => {
  it("counts every code check first and gives one message for every failure", async () => {
    const who = "198.51.100.7";
    for (let i = 0; i < 10; i++) expect(await checkGiftCard("EP-2222-2222", who)).toEqual({ ok: false, message: CARD_CHECK_FAILED });
    const blocked = await checkGiftCard("EP-2222-2222", who);
    expect(blocked.ok === false && blocked.message).toMatch(/Too many tries/);
  });

  it("limits gift orders per visitor", async () => {
    h.ip = "192.0.2.44";
    const form = (i: number) => {
      const f = new FormData();
      f.set("slug", "six-panel-cap");
      f.set("mode", "pick");
      f.set("receiverName", "Sita");
      f.set("receiverEmail", "sita@test.dev");
      f.set("buyerPhone", `981100070${i}`);
      f.set("provider", "esewa");
      return f;
    };
    const results: string[] = [];
    for (let i = 0; i < 6; i++) {
      try {
        const r = await placeGiftOrder({ status: "idle" }, form(i));
        results.push(r.status === "error" ? r.message : r.status);
      } catch (e) {
        results.push((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") ? "redirect" : String(e));
      }
    }
    expect(results.slice(0, 5)).toEqual(Array(5).fill("redirect"));
    expect(results[5]).toMatch(/Too many gift orders/);
  });

  it("allows at most two unpaid gift orders per buyer phone", async () => {
    const phone = "9811000800";
    const form = () => {
      const f = new FormData();
      f.set("slug", "six-panel-cap");
      f.set("mode", "pick");
      f.set("receiverName", "Sita");
      f.set("receiverEmail", "sita@test.dev");
      f.set("buyerPhone", phone);
      f.set("provider", "esewa");
      return f;
    };
    const results: string[] = [];
    for (let i = 0; i < 3; i++) {
      h.ip = `192.0.2.${100 + i}`;
      try {
        const r = await placeGiftOrder({ status: "idle" }, form());
        results.push(r.status === "error" ? r.message : r.status);
      } catch (e) {
        results.push((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") ? "redirect" : String(e));
      }
    }
    expect(results).toEqual(["redirect", "redirect", expect.stringMatching(/Too many gift orders/)]);
  });
});
