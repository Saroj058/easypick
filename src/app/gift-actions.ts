"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { after } from "next/server";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { moveStock, StockShortError } from "@/lib/catalogue";
import { normaliseNepaliMobile } from "@/lib/format";
import {
  GIFT_CARD_MAX,
  GIFT_CARD_MIN,
  checkGiftCard,
  issueGiftCard,
  type CardCheck,
} from "@/lib/gift-cards";
import { createOrder, event, findOrderByGiftToken, lockOrder, type GiftInfo, type Order } from "@/lib/orders";
import { sellable } from "@/lib/inventory";
import { clientIp } from "@/lib/rate-limit";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { giftEmailHtml, normaliseEmail } from "@/lib/email";
import { notifyEmail, notifySms as notify } from "@/lib/notify";
import { getProducts } from "@/lib/store";
import type { PaymentProvider, Size } from "@/lib/types";

const PROVIDERS: PaymentProvider[] = site.payments.enabled;

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
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
  const inStock = product.variants.filter((v) => v.colour === colour && sellable(v) > 0);
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

  const created = await createOrder(
    {
      id: randomUUID(),
      phone: buyerPhone,
      method: setPickup ? "pickup" : "delivery",
      address,
      provider,
      lines: [{ sku: variant.sku, slug: product.slug, name: product.name, size: variant.size, colour, unitPrice: price, qty: 1 }],
      subtotal: price,
      deliveryFee,
      wrapFee,
      status: "awaiting_payment",
      createdAt: new Date().toISOString(),
      expiresAt: in15min(),
      gift,
      kind: "goods",
    },
    { userId: (await getCurrentUser())?.id },
  );
  if (!created.ok) return { status: "error", message: created.message };
  const order = created.order;

  // The receiver is emailed the link once payment is confirmed (lib/payments.ts).
  redirect(`/pay/${order.id}`);
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
  const created = await createOrder(
    {
      id: randomUUID(),
      phone: buyerPhone,
      method: "pickup",
      provider,
      lines: [{ sku: `GIFTCARD-${value}`, slug: "gift-card", name: "Easypick gift card", size: "ONE", colour: "Digital", unitPrice: value, qty: 1 }],
      subtotal: value,
      deliveryFee: 0,
      status: "awaiting_payment",
      createdAt: new Date().toISOString(),
      expiresAt: in15min(),
      kind: "gift_card",
    },
    {
      userId: (await getCurrentUser())?.id,
      issueCard: { value, status: "pending_payment", purchaserPhone: buyerPhone, recipientName, recipientPhone, recipientEmail, message: str(form, "message", 200), senderName, sendOn },
    },
  );
  if (!created.ok) return { status: "error", message: created.message };
  const order = created.order;

  // The card is switched on and sent to them once payment is confirmed (lib/payments.ts).
  redirect(`/pay/${order.id}`);
}

// ---------- Using a card at checkout ----------

export async function previewGiftCard(code: string): Promise<CardCheck> {
  return await checkGiftCard(code, await clientIp());
}

// ---------- The receiver's gift page (/g/<token>) ----------
// Each action re-checks the gift inside the order lock, so a double tap (or many requests
// at once) can't pick twice, mint two cards or issue two welcome credits.

/** Gifts can be opened and chosen only once they're paid (and not cancelled). */
const livePaid = (o: Order) => o.status === "paid" || o.status === "ready_for_pickup" || o.status === "out_for_delivery" || o.status === "completed";

export async function openGift(token: string) {
  const found = await findOrderByGiftToken(token);
  if (!found?.gift || found.gift.status !== "sent") return;
  const opened = await lockOrder(found.id, async (o) => {
    if (!o.gift || o.gift.status !== "sent" || !livePaid(o)) return { save: false, result: false };
    o.gift.status = "opened";
    o.gift.openedAt = new Date().toISOString();
    return { save: true, result: true };
  });
  if (opened) after(() => notify(found.phone, `Your Easypick gift to ${found.gift!.receiverName} was just opened.`));
}

export type ChooseState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; welcomeCode?: string };

export async function chooseGift(_prev: ChooseState, form: FormData): Promise<ChooseState> {
  const found = await findOrderByGiftToken(str(form, "token", 64));
  if (!found?.gift || found.gift.mode !== "pick" || !livePaid(found)) return { status: "error", message: "This gift link isn't valid." };

  const product = (await getProducts()).find((p) => p.slug === found.lines[0].slug);
  if (!product) return { status: "error", message: "This piece isn't available any more. You can turn the gift into a gift card." };
  const colour = found.gift.colourChoice ? (product.colours.find((c) => c.name === str(form, "colour"))?.name ?? found.lines[0].colour) : found.lines[0].colour;
  const variant = product.variants.find((v) => v.colour === colour && v.size === (str(form, "size") as Size));
  if (!variant) return { status: "error", message: "Pick your size." };

  const method = str(form, "method") === "pickup" ? "pickup" : "delivery";
  let address: { area: string; landmark: string; details: string } | undefined;
  if (method === "delivery") {
    const area = str(form, "area", 80);
    const landmark = str(form, "landmark", 80);
    if (!area || !landmark) return { status: "error", message: "Add your area and a nearby landmark so the rider can find you." };
    address = { area, landmark, details: str(form, "details", 120) };
  }
  const slot = ["morning", "afternoon", "evening"].includes(str(form, "slot")) ? str(form, "slot") : undefined;

  try {
    const result = await lockOrder(found.id, async (o, tx): Promise<{ save: boolean; result: ChooseState }> => {
      const g = o.gift;
      if (!g || g.mode !== "pick" || !livePaid(o)) return { save: false, result: { status: "error", message: "This gift link isn't valid." } };
      if (g.status === "chosen" || g.status === "converted" || g.status === "delivered") return { save: false, result: { status: "done", welcomeCode: g.welcomeCode } };

      // The buyer's guess is held for this gift; swap it for the size actually chosen.
      if (variant.sku !== o.lines[0].sku) {
        await moveStock(tx, [{ sku: variant.sku, delta: -1 }], { reason: "gift_swap", source: "web", ref: o.number }, { online: true });
        await moveStock(tx, [{ sku: o.lines[0].sku, delta: 1 }], { reason: "gift_swap", source: "web", ref: o.number });
      }
      // Welcome credit for the receiver's own first order (once per gift).
      if (!g.welcomeCode) {
        const welcome = await issueGiftCard(
          {
            value: site.gifting.welcomeCredit,
            status: "active",
            purchaserPhone: o.phone,
            recipientName: g.receiverName,
            recipientPhone: g.receiverPhone,
            recipientEmail: g.receiverEmail ?? null,
            message: "Welcome to Easypick",
            senderName: null,
            sendOn: null,
            orderId: null,
          },
          site.gifting.welcomeCreditDays,
          tx,
        );
        g.welcomeCode = welcome.code;
      }
      o.lines[0] = { ...o.lines[0], sku: variant.sku, size: variant.size, colour };
      o.method = method;
      g.receiver = { method, address, slot };
      g.status = "chosen";
      g.chosenAt = new Date().toISOString();
      o.events = [...(o.events ?? []), event("receiver", `Chose ${colour}, ${variant.size}, ${method}`)];
      return { save: true, result: { status: "done", welcomeCode: g.welcomeCode } };
    });
    if (result?.status === "done") after(() => notify(found.phone, `${found.gift!.receiverName.split(" ")[0]} picked their size. We're packing your gift now.`));
    return result ?? { status: "error", message: "This gift link isn't valid." };
  } catch (e) {
    if (e instanceof StockShortError) return { status: "error", message: "That size just sold out. Pick another, or turn the gift into a gift card." };
    throw e;
  }
}

// ---------- Thank-you note back to the buyer ----------

export type ThanksState = { status: "idle" } | { status: "error"; message: string } | { status: "sent" };

export async function sendThanks(_prev: ThanksState, form: FormData): Promise<ThanksState> {
  const found = await findOrderByGiftToken(str(form, "token", 64));
  if (!found?.gift || !livePaid(found)) return { status: "error", message: "This gift link isn't valid." };
  const text = str(form, "thanks", 200);
  if (!text) return { status: "error", message: "Write a few words first." };
  const sent = await lockOrder(found.id, async (o) => {
    if (!o.gift || o.gift.thanks) return { save: false, result: false };
    o.gift.thanks = { text, at: new Date().toISOString() };
    return { save: true, result: true };
  });
  if (sent) after(() => notify(found.phone, `${found.gift!.receiverName.split(" ")[0]} says thank you: "${text}"`));
  return { status: "sent" };
}

/** Receiver's size is sold out (or they'd rather choose later): swap the gift for a card of the same value. */
export async function giftToCard(token: string): Promise<{ ok: boolean; code?: string }> {
  const found = await findOrderByGiftToken(token);
  if (!found?.gift || found.gift.mode !== "pick" || !livePaid(found)) return { ok: false };
  const card = await lockOrder(found.id, async (o, tx) => {
    const g = o.gift;
    if (!g || g.mode !== "pick" || !livePaid(o)) return { save: false, result: null };
    if (g.status === "converted") return { save: false, result: { code: g.convertedCardCode!, value: o.lines[0].unitPrice * o.lines[0].qty, fresh: false } };
    if (g.status === "chosen" || g.status === "delivered") return { save: false, result: null };
    const line = o.lines[0];
    // The held piece goes back on the rack.
    if (o.stockHeld) {
      await moveStock(tx, [{ sku: line.sku, delta: line.qty }], { reason: "order_release", source: "web", ref: o.number, actor: "receiver" });
      o.stockHeld = false;
    }
    const issued = await issueGiftCard(
      {
        value: line.unitPrice * line.qty,
        status: "active",
        purchaserPhone: o.phone,
        recipientName: g.receiverName,
        recipientPhone: g.receiverPhone,
        recipientEmail: g.receiverEmail ?? null,
        message: g.message,
        senderName: g.senderName,
        sendOn: null,
        orderId: null,
      },
      365,
      tx,
    );
    g.status = "converted";
    g.convertedCardCode = issued.code;
    o.events = [...(o.events ?? []), event("receiver", `Turned into gift card ${issued.code}`)];
    return { save: true, result: { code: issued.code, value: issued.value, fresh: true } };
  });
  if (!card) return { ok: false };
  if (card.fresh) {
    const g = found.gift;
    const amount = formatPrice(card.value);
    after(async () => {
      await notify(g.receiverPhone, `Your Easypick gift is now a gift card worth ${amount}. Code: ${card.code}.`);
      await notifyEmail(
        g.receiverEmail,
        "Your Easypick gift is now a gift card",
        giftEmailHtml({
          heading: `${amount} to spend on anything you like.`,
          intro: "Your gift is now an Easypick gift card of the same value. Use it online or in store.",
          extra: `<div style="margin:0 0 24px;background:#0a0a0a;color:#ffffff;padding:18px 22px;font-family:ui-monospace,Menlo,monospace;font-size:24px;font-weight:700;letter-spacing:0.1em">${card.code}</div>`,
          button: { label: "Start shopping", url: `${site.url}/shop` },
          small: "Valid for 12 months. Any balance you don't use stays on the card.",
        }),
        `Your Easypick gift is now a gift card worth ${amount}. Code: ${card.code}`,
      );
    });
  }
  return { ok: true, code: card.code };
}

/** Receiver would rather try sizes on in the store. The held piece waits at the counter under their gift code. */
export async function tryGiftInStore(token: string): Promise<{ ok: boolean; code?: string }> {
  const found = await findOrderByGiftToken(token);
  if (!found?.gift || found.gift.mode !== "pick" || !livePaid(found)) return { ok: false };
  const res = await lockOrder(found.id, async (o) => {
    const g = o.gift;
    if (!g || g.mode !== "pick") return { save: false, result: { ok: false, fresh: false } };
    if (g.status === "chosen" || g.status === "converted" || g.status === "delivered") return { save: false, result: { ok: g.receiver?.tryInStore === true, fresh: false } };
    o.method = "pickup";
    g.receiver = { method: "pickup", tryInStore: true };
    g.status = "chosen";
    g.chosenAt = new Date().toISOString();
    o.events = [...(o.events ?? []), event("receiver", "Will try it on in the store")];
    return { save: true, result: { ok: true, fresh: true } };
  });
  if (!res?.ok) return { ok: false };
  if (res.fresh) {
    const g = found.gift;
    after(async () => {
      await notify(g.receiverPhone, `Your Easypick gift is waiting for you. Show code ${found.number} at the counter to try it on.`);
      await notifyEmail(
        g.receiverEmail,
        "Your Easypick gift is waiting in the store",
        giftEmailHtml({
          heading: "It's waiting for you in the store.",
          intro: `Show this code at the counter. We'll bring it in your sizes to try on, and you take the one that fits. We hold it for 14 days.`,
          extra: `<div style="margin:0 0 24px;background:#0a0a0a;color:#ffffff;padding:18px 22px;font-family:ui-monospace,Menlo,monospace;font-size:24px;font-weight:700;letter-spacing:0.1em">${found.number}</div>`,
          button: { label: "Directions", url: `${site.url}/visit` },
          small: `Open every day, ${site.store.hours.open} to ${site.store.hours.close}.`,
        }),
        `Your Easypick gift is waiting in the store. Show code ${found.number} at the counter. Directions: ${site.url}/visit`,
      );
      await notify(found.phone, `${g.receiverName.split(" ")[0]} will try your gift on in the store.`);
    });
  }
  return { ok: true, code: found.number };
}
