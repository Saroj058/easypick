"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, isNotNull, or, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";

import { alertStaff } from "@/lib/alerts";
import { getCurrentUser } from "@/lib/auth";
import { moveStock, StockShortError } from "@/lib/catalogue";
import { getDb, schema } from "@/lib/db";
import { normaliseNepaliMobile } from "@/lib/format";
import {
  GIFT_CARD_MAX,
  GIFT_CARD_MIN,
  checkGiftCard,
  issueGiftCard,
  maskCode,
  visitorKey,
  type CardCheck,
} from "@/lib/gift-cards";
import { cleanGiftMessage, cleanSenderName } from "@/lib/gift-text";
import { issueWelcomeCredit } from "@/lib/gift-welcome";
import { isFutureKathmanduDate, kathmanduToday } from "@/lib/kathmandu-date";
import { createOrder, event, findOrderByGiftToken, lockOrder, type GiftInfo, type Order } from "@/lib/orders";
import { sellable } from "@/lib/inventory";
import { allow, clientIp } from "@/lib/rate-limit";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { giftEmailHtml, normaliseEmail } from "@/lib/email";
import { notifyEmail, notifySms as notify } from "@/lib/notify";
import { getProducts } from "@/lib/store";
import type { PaymentProvider, Size } from "@/lib/types";

const PROVIDERS: PaymentProvider[] = site.payments.enabled;

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const in15min = () => new Date(Date.now() + 15 * 60_000).toISOString();

/** yyyy-mm-dd between today and 60 days out (Kathmandu calendar), or null for "as soon as possible". */
function readDate(v: string): string | null | false {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== v) return false;
  const today = Date.parse(`${kathmanduToday()}T00:00:00Z`);
  return t >= today && t <= today + 60 * 86_400_000 ? v : false;
}

// ---------- Limits on unpaid gift orders ----------
// An unpaid order holds a piece for 15 minutes, so bots could otherwise hold every piece.

const TOO_MANY = "Too many gift orders at once. Wait a few minutes and try again.";

/** Counts this attempt (5 per visitor per 10 minutes) and caps open unpaid gifts per buyer phone at 2. */
async function giftOrderAllowed(buyerPhone: string): Promise<boolean> {
  if (!(await allow(`gift-order:${visitorKey(await clientIp())}`, 5, 10 * 60_000))) return false;
  const db = await getDb();
  const o = schema.orders;
  const [{ open }] = await db
    .select({ open: count() })
    .from(o)
    .where(
      and(
        eq(o.phone, buyerPhone),
        eq(o.status, "awaiting_payment"),
        sql`${o.data}->>'expiresAt' > ${new Date().toISOString()}`,
        or(isNotNull(o.giftToken), eq(o.kind, "gift_card")),
      ),
    );
  return open < 2;
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

  // Names and the message go into texts and emails to someone else: plain words only.
  const receiverName = cleanSenderName(str(form, "receiverName", 120), 60);
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
  const senderName = anonymous ? null : cleanSenderName(str(form, "senderName", 120));
  const message = cleanGiftMessage(str(form, "message", 400), site.gifting.messageMax);
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

  if (!(await giftOrderAllowed(buyerPhone))) return { status: "error", message: TOO_MANY };

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
  const value = preset > 0 ? preset : custom;
  if (!Number.isInteger(value) || value < GIFT_CARD_MIN || value > GIFT_CARD_MAX) {
    return { status: "error", message: `Choose a whole amount from Rs ${GIFT_CARD_MIN} to Rs ${GIFT_CARD_MAX.toLocaleString("en-IN")}.` };
  }
  const recipientName = cleanSenderName(str(form, "receiverName", 120), 60);
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
  const senderName = anonymous ? null : cleanSenderName(str(form, "senderName", 120));
  if (!(await giftOrderAllowed(buyerPhone))) return { status: "error", message: TOO_MANY };

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
      issueCard: {
        value,
        status: "pending_payment",
        purchaserPhone: buyerPhone,
        recipientName,
        recipientPhone,
        recipientEmail,
        message: cleanGiftMessage(str(form, "message", 400), site.gifting.messageMax),
        senderName,
        sendOn,
        // A later date: the cron sends it on that day (lib/gift-card-delivery.ts).
        pendingSend: isFutureKathmanduDate(sendOn) || undefined,
      },
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
// Card codes are returned only by the action that created them (and sent to the receiver's
// email and phone); asking again only ever gets the masked code, since the buyer has the link too.

/** Gifts can be opened and chosen only once they're paid (and not cancelled). */
const livePaid = (o: Order) => o.status === "paid" || o.status === "ready_for_pickup" || o.status === "out_for_delivery" || o.status === "completed";

/** The receiver chose pickup, but the buyer paid for delivery: ask the owner to refund it. */
function flagDeliveryRefund(o: Order): string | null {
  if (!(o.deliveryFee > 0)) return null;
  const note = `Refund delivery ${formatPrice(o.deliveryFee)} to the buyer – receiver chose pickup.`;
  o.attention = o.attention ? `${o.attention} ${note}` : note;
  o.events = [...(o.events ?? []), event("system", `Needs attention: ${note}`)];
  return note;
}

function alertDeliveryRefund(o: Order, note: string) {
  after(() => alertStaff(`Needs attention: ${o.number}`, `${o.number}\n\n${note}\n\n${site.url}/admin/orders/${o.id}`));
}

/** Texts and emails the receiver their new welcome credit. */
function sendWelcome(g: GiftInfo, code: string) {
  const amount = formatPrice(site.gifting.welcomeCredit);
  after(async () => {
    await notify(g.receiverPhone, `Welcome to Easypick: ${amount} off your first order. Code: ${code}. Valid ${site.gifting.welcomeCreditDays} days.`);
    await notifyEmail(
      g.receiverEmail,
      "A welcome from Easypick",
      giftEmailHtml({
        heading: `${amount} off your first order.`,
        intro: `A little welcome from Easypick. Use this code online or in store within ${site.gifting.welcomeCreditDays} days.`,
        extra: `<div style="margin:0 0 24px;background:#0a0a0a;color:#ffffff;padding:18px 22px;font-family:ui-monospace,Menlo,monospace;font-size:24px;font-weight:700;letter-spacing:0.1em">${code}</div>`,
        button: { label: "Start shopping", url: `${site.url}/shop` },
        small: "Enter the code at checkout, or show it at the counter.",
      }),
      `A welcome from Easypick: ${amount} off your first order.\nCode: ${code}\nValid ${site.gifting.welcomeCreditDays} days at ${site.url}/shop or in store.`,
    );
  });
}

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

/** `welcome.fresh`: the full code, shown once. Otherwise `code` is masked (EP-••••-2QXD). */
export type ChooseState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; welcome?: { code: string; fresh: boolean } };

export async function chooseGift(_prev: ChooseState, form: FormData): Promise<ChooseState> {
  const found = await findOrderByGiftToken(str(form, "token", 64));
  if (!found?.gift || found.gift.mode !== "pick" || !livePaid(found)) return { status: "error", message: "This gift link isn't valid." };

  // Everything read from the catalogue happens before the order lock (no second connection inside it).
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
    const result = await lockOrder(
      found.id,
      async (o, tx): Promise<{ save: boolean; result: { state: ChooseState; moved: boolean; refundNote: string | null; order: Order; chosen: boolean } }> => {
        const g = o.gift;
        const done = (state: ChooseState) => ({ save: false, result: { state, moved: false, refundNote: null, order: o, chosen: false } });
        if (!g || g.mode !== "pick" || !livePaid(o)) return done({ status: "error", message: "This gift link isn't valid." });
        if (g.status === "chosen" || g.status === "converted" || g.status === "delivered") {
          return done({ status: "done", welcome: g.welcomeCode ? { code: maskCode(g.welcomeCode), fresh: false } : undefined });
        }

        let moved = false;
        if (!o.stockHeld) {
          // Nothing is held for this gift (it was paid after the hold ended): just take the chosen piece.
          await moveStock(tx, [{ sku: variant.sku, delta: -1 }], { reason: "gift_swap", source: "web", ref: o.number }, { online: true });
          o.stockHeld = true;
          moved = true;
        } else if (variant.sku !== o.lines[0].sku) {
          // The buyer's guess is held for this gift; swap it for the size actually chosen.
          // One call, so both SKUs are locked in a fixed order (no deadlock with another swap).
          await moveStock(
            tx,
            [
              { sku: variant.sku, delta: -1 },
              { sku: o.lines[0].sku, delta: 1 },
            ],
            { reason: "gift_swap", source: "web", ref: o.number },
            { online: true },
          );
          moved = true;
        }
        // Welcome credit for the receiver's own first order: once per person, only if they're new.
        let fresh: string | undefined;
        if (!g.welcomeCode) {
          const welcome = await issueWelcomeCredit(tx, g, o.phone, o.id);
          if (welcome) g.welcomeCode = fresh = welcome.code;
        }
        o.lines[0] = { ...o.lines[0], sku: variant.sku, size: variant.size, colour };
        o.method = method;
        g.receiver = { method, address, slot };
        g.status = "chosen";
        g.chosenAt = new Date().toISOString();
        o.events = [...(o.events ?? []), event("receiver", `Chose ${colour}, ${variant.size}, ${method}`)];
        const refundNote = method === "pickup" ? flagDeliveryRefund(o) : null;
        return { save: true, result: { state: { status: "done", welcome: fresh ? { code: fresh, fresh: true } : undefined }, moved, refundNote, order: o, chosen: true } };
      },
    );
    if (!result) return { status: "error", message: "This gift link isn't valid." };
    const { state, moved, refundNote, order, chosen } = result;
    if (moved) updateTag("catalogue"); // "2 left" and sold-out sizes refresh
    if (refundNote) alertDeliveryRefund(order, refundNote);
    if (state.status === "done" && state.welcome?.fresh) sendWelcome(found.gift, state.welcome.code);
    if (chosen) {
      after(() => notify(found.phone, `${found.gift!.receiverName.split(" ")[0]} picked their size. We're packing your gift now.`));
    }
    return state;
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
  const text = cleanGiftMessage(str(form, "thanks", 400), 200);
  if (!text) return { status: "error", message: "Write a few words first." };
  const sent = await lockOrder(found.id, async (o) => {
    if (!o.gift || o.gift.thanks || !livePaid(o)) return { save: false, result: false };
    o.gift.thanks = { text, at: new Date().toISOString() };
    return { save: true, result: true };
  });
  if (sent) after(() => notify(found.phone, `${found.gift!.receiverName.split(" ")[0]} says thank you: "${text}"`));
  return { status: "sent" };
}

/**
 * Receiver's size is sold out (or they'd rather choose later): swap the gift for a card of the same value.
 * `code` is the full code only on the call that made the card; after that it's masked.
 */
export async function giftToCard(token: string): Promise<{ ok: boolean; code?: string; fresh?: boolean }> {
  const found = await findOrderByGiftToken(token);
  if (!found?.gift || found.gift.mode !== "pick" || !livePaid(found)) return { ok: false };
  const card = await lockOrder(found.id, async (o, tx) => {
    const g = o.gift;
    if (!g || g.mode !== "pick" || !livePaid(o)) return { save: false, result: null };
    if (g.status === "converted") return { save: false, result: { code: g.convertedCardCode!, value: o.lines[0].unitPrice * o.lines[0].qty, fresh: false, released: false } };
    if (g.status === "chosen" || g.status === "delivered") return { save: false, result: null };
    const line = o.lines[0];
    // The held piece goes back on the rack.
    let released = false;
    if (o.stockHeld) {
      await moveStock(tx, [{ sku: line.sku, delta: line.qty }], { reason: "order_release", source: "web", ref: o.number, actor: "receiver" });
      o.stockHeld = false;
      released = true;
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
        orderId: o.id, // the gift it replaced, for staff and refunds
      },
      365,
      tx,
    );
    g.status = "converted";
    g.convertedCardCode = issued.code;
    o.events = [...(o.events ?? []), event("receiver", `Turned into gift card ${maskCode(issued.code)}`)];
    return { save: true, result: { code: issued.code, value: issued.value, fresh: true, released } };
  });
  if (!card) return { ok: false };
  if (card.released) updateTag("catalogue"); // the piece is back on sale
  if (!card.fresh) return { ok: true, code: maskCode(card.code), fresh: false };

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
  return { ok: true, code: card.code, fresh: true };
}

/** Receiver would rather try sizes on in the store. The held piece waits at the counter under their gift code. */
export async function tryGiftInStore(token: string): Promise<{ ok: boolean; code?: string }> {
  const found = await findOrderByGiftToken(token);
  if (!found?.gift || found.gift.mode !== "pick" || !livePaid(found)) return { ok: false };
  const res = await lockOrder(found.id, async (o) => {
    const g = o.gift;
    // Checked again inside the lock: the order may have been cancelled a moment ago.
    if (!g || g.mode !== "pick" || !livePaid(o)) return { save: false, result: { ok: false, fresh: false, refundNote: null as string | null, order: o } };
    if (g.status === "chosen" || g.status === "converted" || g.status === "delivered") return { save: false, result: { ok: g.receiver?.tryInStore === true, fresh: false, refundNote: null, order: o } };
    o.method = "pickup";
    g.receiver = { method: "pickup", tryInStore: true };
    g.status = "chosen";
    g.chosenAt = new Date().toISOString();
    o.events = [...(o.events ?? []), event("receiver", "Will try it on in the store")];
    const refundNote = flagDeliveryRefund(o);
    return { save: true, result: { ok: true, fresh: true, refundNote, order: o } };
  });
  if (!res?.ok) return { ok: false };
  if (res.refundNote) alertDeliveryRefund(res.order, res.refundNote);
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
