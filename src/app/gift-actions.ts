"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { adjustStock } from "@/lib/catalogue";
import { normaliseNepaliMobile } from "@/lib/format";
import {
  GIFT_CARD_MAX,
  GIFT_CARD_MIN,
  checkGiftCard,
  issueGiftCard,
  type CardCheck,
} from "@/lib/gift-cards";
import { findOrderByGiftToken, saveOrder, updateOrder, type GiftInfo, type Order } from "@/lib/orders";
import { site } from "@/lib/site";
import { giftEmailHtml, normaliseEmail } from "@/lib/email";
import { notifyEmail, notifySms as notify } from "@/lib/notify";
import { getProducts } from "@/lib/store";
import type { PaymentProvider, Size } from "@/lib/types";

const PROVIDERS: PaymentProvider[] = ["esewa", "khalti", "fonepay"];

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const orderNumber = () => `EP-${String(Math.floor(100000 + Math.random() * 900000))}`;
const in15min = () => new Date(Date.now() + 15 * 60_000).toISOString();

/** yyyy-mm-dd between today and 60 days out, or null for "as soon as possible". */
function readDate(v: string): string | null | false {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00+05:45`);
  const today = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00+05:45");
  return t >= today && t <= today + 60 * 86_400_000 ? v : false;
}

// ---------- Send a product as a gift ----------

export type GiftState = { status: "idle" } | { status: "error"; message: string };

export async function placeGiftOrder(_prev: GiftState, form: FormData): Promise<GiftState> {
  const product = (await getProducts()).find((p) => p.slug === str(form, "slug") && p.status === "live");
  if (!product) return { status: "error", message: "This piece isn't available to gift right now." };

  const mode = str(form, "mode") === "set" ? "set" : "pick";
  const colour = product.colours.find((c) => c.name === str(form, "colour"))?.name ?? product.colours[0].name;
  const inStock = product.variants.filter((v) => v.colour === colour && v.stock - (v.lastPieceOnFloor ? 1 : 0) > 0);
  if (inStock.length === 0) return { status: "error", message: `${product.name} is sold out in ${colour}. Try another colour.` };

  // "set": the buyer's size must be in stock. "pick": hold the buyer's best guess (or any size) until the receiver chooses.
  const wanted = str(form, "size") as Size;
  const variant = inStock.find((v) => v.size === wanted) ?? (mode === "pick" ? inStock[Math.floor(inStock.length / 2)] : undefined);
  if (!variant) return { status: "error", message: "Pick their size." };

  const receiverName = str(form, "receiverName", 60);
  const receiverEmail = normaliseEmail(str(form, "receiverEmail", 254));
  const phoneRaw = str(form, "receiverPhone");
  const receiverPhone = phoneRaw ? normaliseNepaliMobile(phoneRaw) : null;
  const buyerPhone = normaliseNepaliMobile(str(form, "buyerPhone"));
  if (!receiverName) return { status: "error", message: "Add the name of the person you're gifting." };
  if (!receiverEmail) return { status: "error", message: "Add their email address so we can send them the gift link." };
  if (phoneRaw && !receiverPhone) return { status: "error", message: "Their mobile number should be 10 digits, like 98XXXXXXXX, or leave it empty." };
  if (!buyerPhone) return { status: "error", message: "Add your own mobile number for order updates." };
  if (receiverPhone && receiverPhone === buyerPhone && process.env.NODE_ENV === "production") return { status: "error", message: "The receiver's number can't be your own." };

  const deliverOn = readDate(str(form, "deliverOn"));
  if (deliverOn === false) return { status: "error", message: "Pick a delivery date within the next 60 days." };

  const provider = str(form, "provider") as PaymentProvider;
  if (!PROVIDERS.includes(provider)) return { status: "error", message: "Choose how you'll pay." };

  const anonymous = form.get("anonymous") === "on";
  const senderName = anonymous ? null : str(form, "senderName", 40) || null;
  const message = str(form, "message", 200);
  const wrap = str(form, "wrap") === "premium" ? "premium" : "standard";

  // In "set" mode the buyer chooses pickup or delivery now; in "pick" mode the receiver does.
  const setPickup = mode === "set" && str(form, "method") === "pickup";
  let address: Order["address"];
  if (mode === "set" && !setPickup) {
    const area = str(form, "area", 80);
    const landmark = str(form, "landmark", 80);
    if (!area || !landmark) return { status: "error", message: "Add their area and a nearby landmark, or choose store pickup." };
    if (!receiverPhone) return { status: "error", message: "Add their mobile number so the rider can reach them." };
    address = { area, landmark, details: str(form, "details", 120) };
  }

  const price = product.salePrice ?? product.price;
  const wrapFee = wrap === "premium" ? site.gifting.premiumWrapFee : 0;
  const deliveryFee = setPickup || price >= site.delivery.freeAbove ? 0 : site.delivery.flatFee;
  const token = randomBytes(18).toString("base64url");

  const gift: GiftInfo = {
    mode,
    token,
    receiverName,
    receiverPhone,
    receiverEmail,
    senderName,
    message,
    wrap,
    deliverOn,
    colourChoice: mode === "pick" && form.get("colourChoice") === "on",
    showPrice: form.get("showPrice") === "on",
    status: "sent",
  };

  const order: Order = {
    id: randomUUID(),
    number: orderNumber(),
    phone: buyerPhone,
    method: setPickup ? "pickup" : "delivery",
    address,
    provider,
    lines: [{ sku: variant.sku, slug: product.slug, name: product.name, size: variant.size, colour, unitPrice: price, qty: 1 }],
    subtotal: price,
    deliveryFee,
    wrapFee,
    total: price + deliveryFee + wrapFee,
    status: "awaiting_payment",
    createdAt: new Date().toISOString(),
    expiresAt: in15min(),
    gift,
    kind: "goods",
  };
  saveOrder(order, (await getCurrentUser())?.id);

  // The receiver is emailed the link once payment is confirmed (lib/payments.ts).
  redirect(`/order/${order.id}`);
}

// ---------- Buy a gift card ----------

export async function buyGiftCard(_prev: GiftState, form: FormData): Promise<GiftState> {
  const preset = Number(str(form, "value"));
  const custom = Number(str(form, "custom"));
  const value = preset > 0 ? preset : Math.round(custom);
  if (!value || value < GIFT_CARD_MIN || value > GIFT_CARD_MAX) {
    return { status: "error", message: `Choose an amount from Rs ${GIFT_CARD_MIN} to Rs ${GIFT_CARD_MAX.toLocaleString("en-IN")}.` };
  }
  const recipientName = str(form, "receiverName", 60);
  const recipientEmail = normaliseEmail(str(form, "receiverEmail", 254));
  const phoneRaw = str(form, "receiverPhone");
  const recipientPhone = phoneRaw ? normaliseNepaliMobile(phoneRaw) : null;
  const buyerPhone = normaliseNepaliMobile(str(form, "buyerPhone"));
  if (!recipientName) return { status: "error", message: "Add the name of the person you're gifting." };
  if (!recipientEmail) return { status: "error", message: "Add their email address so we can send them the card." };
  if (phoneRaw && !recipientPhone) return { status: "error", message: "Their mobile number should be 10 digits, like 98XXXXXXXX, or leave it empty." };
  if (!buyerPhone) return { status: "error", message: "Add your own mobile number for the receipt." };
  const sendOn = readDate(str(form, "deliverOn"));
  if (sendOn === false) return { status: "error", message: "Pick a date within the next 60 days." };
  const provider = str(form, "provider") as PaymentProvider;
  if (!PROVIDERS.includes(provider)) return { status: "error", message: "Choose how you'll pay." };

  const anonymous = form.get("anonymous") === "on";
  const senderName = anonymous ? null : str(form, "senderName", 40) || null;
  const orderId = randomUUID();
  const card = issueGiftCard({
    value,
    status: "pending_payment",
    purchaserPhone: buyerPhone,
    recipientName,
    recipientPhone,
    recipientEmail,
    message: str(form, "message", 200),
    senderName,
    sendOn,
    orderId,
  });

  const order: Order = {
    id: orderId,
    number: orderNumber(),
    phone: buyerPhone,
    method: "pickup",
    provider,
    lines: [{ sku: `GIFTCARD-${value}`, slug: "gift-card", name: "Easypick gift card", size: "ONE", colour: "Digital", unitPrice: value, qty: 1 }],
    subtotal: value,
    deliveryFee: 0,
    total: value,
    status: "awaiting_payment",
    createdAt: new Date().toISOString(),
    expiresAt: in15min(),
    kind: "gift_card",
    issuedCardCode: card.code,
  };
  saveOrder(order, (await getCurrentUser())?.id);

  // The card is switched on and sent to them once payment is confirmed (lib/payments.ts).
  redirect(`/order/${order.id}`);
}

// ---------- Using a card at checkout ----------

async function who() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function previewGiftCard(code: string): Promise<CardCheck> {
  return checkGiftCard(code, await who());
}

// ---------- The receiver's gift page (/g/<token>) ----------

export async function openGift(token: string) {
  const order = findOrderByGiftToken(token);
  if (!order?.gift || order.gift.status !== "sent") return;
  updateOrder(order.id, (o) => {
    o.gift!.status = "opened";
    o.gift!.openedAt = new Date().toISOString();
  });
  await notify(order.phone, `Your Easypick gift to ${order.gift.receiverName} was just opened.`);
}

export type ChooseState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; welcomeCode?: string };

export async function chooseGift(_prev: ChooseState, form: FormData): Promise<ChooseState> {
  const order = findOrderByGiftToken(str(form, "token", 64));
  const gift = order?.gift;
  if (!order || !gift || gift.mode !== "pick") return { status: "error", message: "This gift link isn't valid." };
  if (gift.status === "chosen" || gift.status === "converted") return { status: "done" };

  const product = (await getProducts()).find((p) => p.slug === order.lines[0].slug);
  if (!product) return { status: "error", message: "This piece isn't available any more. You can turn the gift into a gift card." };
  const colour = gift.colourChoice ? (product.colours.find((c) => c.name === str(form, "colour"))?.name ?? order.lines[0].colour) : order.lines[0].colour;
  const variant = product.variants.find((v) => v.colour === colour && v.size === (str(form, "size") as Size));
  if (!variant) return { status: "error", message: "Pick your size." };
  const held = variant.sku === order.lines[0].sku; // the buyer's guess is already held for this gift
  if (!held && variant.stock - (variant.lastPieceOnFloor ? 1 : 0) <= 0) return { status: "error", message: "That size just sold out. Pick another, or turn the gift into a gift card." };

  const method = str(form, "method") === "pickup" ? "pickup" : "delivery";
  let address: { area: string; landmark: string; details: string } | undefined;
  if (method === "delivery") {
    const area = str(form, "area", 80);
    const landmark = str(form, "landmark", 80);
    if (!area || !landmark) return { status: "error", message: "Add your area and a nearby landmark so the rider can find you." };
    address = { area, landmark, details: str(form, "details", 120) };
  }
  const slot = ["morning", "afternoon", "evening"].includes(str(form, "slot")) ? str(form, "slot") : undefined;

  // Welcome credit for the receiver's own first order (once per gift).
  const welcome = gift.welcomeCode
    ? null
    : issueGiftCard(
        {
          value: site.gifting.welcomeCredit,
          status: "active",
          purchaserPhone: order.phone,
          recipientName: gift.receiverName,
          recipientPhone: gift.receiverPhone,
          recipientEmail: gift.receiverEmail ?? null,
          message: "Welcome to Easypick",
          senderName: null,
          sendOn: null,
          orderId: null,
        },
        site.gifting.welcomeCreditDays,
      );

  // The buyer's guess was taken off stock when they paid; swap it for the size actually chosen.
  if (!held && order.status !== "awaiting_payment") {
    adjustStock([{ sku: order.lines[0].sku, qty: 1 }], 1);
    adjustStock([{ sku: variant.sku, qty: 1 }], -1);
  }
  updateOrder(order.id, (o) => {
    o.lines[0] = { ...o.lines[0], sku: variant.sku, size: variant.size, colour };
    o.method = method;
    o.gift!.receiver = { method, address, slot };
    o.gift!.status = "chosen";
    o.gift!.chosenAt = new Date().toISOString();
    if (welcome) o.gift!.welcomeCode = welcome.code;
  });
  await notify(order.phone, `${gift.receiverName.split(" ")[0]} picked their size. We're packing your gift now.`);
  return { status: "done", welcomeCode: welcome?.code ?? gift.welcomeCode };
}

// ---------- Thank-you note back to the buyer ----------

export type ThanksState = { status: "idle" } | { status: "error"; message: string } | { status: "sent" };

export async function sendThanks(_prev: ThanksState, form: FormData): Promise<ThanksState> {
  const order = findOrderByGiftToken(str(form, "token", 64));
  const gift = order?.gift;
  if (!order || !gift) return { status: "error", message: "This gift link isn't valid." };
  if (gift.thanks) return { status: "sent" };
  const text = str(form, "thanks", 200);
  if (!text) return { status: "error", message: "Write a few words first." };
  updateOrder(order.id, (o) => {
    o.gift!.thanks = { text, at: new Date().toISOString() };
  });
  await notify(order.phone, `${gift.receiverName.split(" ")[0]} says thank you: "${text}"`);
  return { status: "sent" };
}

/** Receiver's size is sold out (or they'd rather choose later): swap the gift for a card of the same value. */
export async function giftToCard(token: string): Promise<{ ok: boolean; code?: string }> {
  const order = findOrderByGiftToken(token);
  const gift = order?.gift;
  if (!order || !gift || gift.mode !== "pick" || gift.status === "chosen" || gift.status === "converted") return { ok: false };
  const line = order.lines[0];
  const card = issueGiftCard({
    value: line.unitPrice * line.qty,
    status: "active",
    purchaserPhone: order.phone,
    recipientName: gift.receiverName,
    recipientPhone: gift.receiverPhone,
    recipientEmail: gift.receiverEmail ?? null,
    message: gift.message,
    senderName: gift.senderName,
    sendOn: null,
    orderId: null,
  });
  updateOrder(order.id, (o) => {
    o.gift!.status = "converted";
    o.gift!.convertedCardCode = card.code;
  });
  await notify(gift.receiverPhone, `Your Easypick gift is now a gift card worth Rs ${card.value.toLocaleString("en-IN")}. Code: ${card.code}.`);
  await notifyEmail(
    gift.receiverEmail,
    "Your Easypick gift is now a gift card",
    giftEmailHtml({
      heading: `Rs ${card.value.toLocaleString("en-IN")} to spend on anything you like.`,
      intro: "Your gift is now an Easypick gift card of the same value. Use it online or in store.",
      extra: `<div style="margin:0 0 24px;background:#0a0a0a;color:#ffffff;padding:18px 22px;font-family:ui-monospace,Menlo,monospace;font-size:24px;font-weight:700;letter-spacing:0.1em">${card.code}</div>`,
      button: { label: "Start shopping", url: `${site.url}/shop` },
      small: "Valid for 12 months. Any balance you don't use stays on the card.",
    }),
    `Your Easypick gift is now a gift card worth Rs ${card.value.toLocaleString("en-IN")}. Code: ${card.code}`,
  );
  return { ok: true, code: card.code };
}

/** Receiver would rather try sizes on in the store. The held piece waits at the counter under their gift code. */
export async function tryGiftInStore(token: string): Promise<{ ok: boolean; code?: string }> {
  const order = findOrderByGiftToken(token);
  const gift = order?.gift;
  if (!order || !gift || gift.mode !== "pick") return { ok: false };
  if (gift.status === "chosen" || gift.status === "converted") return { ok: gift.receiver?.tryInStore === true, code: order.number };
  updateOrder(order.id, (o) => {
    o.method = "pickup";
    o.gift!.receiver = { method: "pickup", tryInStore: true };
    o.gift!.status = "chosen";
    o.gift!.chosenAt = new Date().toISOString();
  });
  await notify(gift.receiverPhone, `Your Easypick gift is waiting for you. Show code ${order.number} at the counter to try it on.`);
  await notifyEmail(
    gift.receiverEmail,
    "Your Easypick gift is waiting in the store",
    giftEmailHtml({
      heading: "It's waiting for you in the store.",
      intro: `Show this code at the counter. We'll bring it in your sizes to try on, and you take the one that fits. We hold it for 14 days.`,
      extra: `<div style="margin:0 0 24px;background:#0a0a0a;color:#ffffff;padding:18px 22px;font-family:ui-monospace,Menlo,monospace;font-size:24px;font-weight:700;letter-spacing:0.1em">${order.number}</div>`,
      button: { label: "Directions", url: `${site.url}/visit` },
      small: `Open every day, ${site.store.hours.open} to ${site.store.hours.close}.`,
    }),
    `Your Easypick gift is waiting in the store. Show code ${order.number} at the counter. Directions: ${site.url}/visit`,
  );
  await notify(order.phone, `${gift.receiverName.split(" ")[0]} will try your gift on in the store.`);
  return { ok: true, code: order.number };
}
