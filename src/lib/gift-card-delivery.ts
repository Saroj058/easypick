import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb, schema } from "./db";
import { giftEmailHtml } from "./email";
import { markGiftCardSent, type GiftCard } from "./gift-cards";
import { kathmanduToday } from "./kathmandu-date";
import { notifyEmail, notifySms } from "./notify";
import { lockOrder, updateOrder, type Order } from "./orders";
import { site } from "./site";
import { giftCardEmailBlock } from "./gift-card-designs";
import { formatPrice } from "./format";

// Bought gift cards with a send date wait until that Kathmandu day; the cron sends them.
// Cards sent at payment are marked sent there (lib/payments.ts), so nothing goes twice.
// A piece gift where the buyer chose the size and a later date waits the same way.

/**
 * A name for a text message. Plain Latin letters keep an SMS to one 160-character part;
 * one Devanagari letter would switch it to 70-character parts, so those names become "Someone".
 */
export function smsName(name: string | null | undefined, max = 18): string | null {
  const n = (name ?? "").trim();
  if (!n || !/^[\x20-\x7E]+$/.test(n)) return null;
  return n.length > max ? n.split(" ")[0].slice(0, max) : n;
}

/** Emails and texts the private gift link to the receiver, and records when. */
export async function sendGiftLink(order: Order): Promise<void> {
  const g = order.gift;
  if (!g) return;
  const from = g.senderName ?? "Someone";
  const first = g.receiverName.split(" ")[0];
  const link = `${site.url}/g/${g.token}`;
  const pick = g.mode === "pick";

  // One SMS part: "Namaste Asha! Ram sent you a gift from Easypick. Open it: <link>"
  const hi = smsName(first, 12);
  await notifySms(g.receiverPhone, `Namaste${hi ? ` ${hi}` : ""}! ${smsName(g.senderName) ?? "Someone"} sent you a gift from Easypick. Open it: ${link}`);
  const emailStatus = await notifyEmail(
    g.receiverEmail,
    g.senderName ? `${g.senderName} sent you a gift` : "A gift is waiting for you at Easypick",
    giftEmailHtml({
      preheader: pick ? "Open it to see what's inside, then pick your size." : "Open it to see what's on the way.",
      heading: `Namaste ${first}, you've got a gift.`,
      nepali: "तपाईंलाई एउटा उपहार आएको छ।",
      intro: pick
        ? `${from} picked something from Easypick for you. Open it to choose your size online, or try it on in our store in ${site.store.area}.`
        : `${from} picked something from Easypick for you. Open it to see what's on the way.`,
      quote: g.message || null,
      from: g.senderName,
      button: { label: "Open your gift", url: link },
      small: g.showPrice === false
        ? "This link is just for you. You won't see the price. Swap the size within 14 days if it's not right."
        : "This link is just for you. Swap the size within 14 days if it's not right.",
    }),
    `Namaste ${first}, you've got a gift.\n\n${from} sent you a gift from Easypick.${g.message ? `\n\n"${g.message}"` : ""}\n\nOpen your gift: ${link}\n\nThis link is just for you.`,
  );
  await updateOrder(order.id, (o) => {
    o.gift!.emailStatus = emailStatus;
    o.gift!.pendingSend = false;
    o.gift!.sentAt = new Date().toISOString();
  });
}

const PAID = ["paid", "ready_for_pickup", "out_for_delivery", "completed"] as const;

/**
 * Sends the link for every paid piece gift whose date has come (Kathmandu day). Each order is
 * claimed under its row lock first, so two cron runs can't both send it. Returns how many went.
 */
export async function sendDueGiftLinks(now: Date = new Date()): Promise<number> {
  const db = await getDb();
  const today = kathmanduToday(now);
  const due = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(
      and(
        inArray(schema.orders.status, [...PAID]),
        sql`${schema.orders.data}->'gift'->>'pendingSend' = 'true'`,
        sql`${schema.orders.data}->'gift'->>'deliverOn' <= ${today}`,
      ),
    );
  let sent = 0;
  for (const { id } of due) {
    try {
      const order = await lockOrder<Order | null>(id, async (o) => {
        if (!o.gift?.pendingSend) return { save: false, result: null };
        o.gift.pendingSend = false;
        return { save: true, result: o };
      });
      if (!order) continue;
      await sendGiftLink(order);
      sent++;
    } catch (e) {
      console.error("[gifts] scheduled link failed", id, e);
    }
  }
  return sent;
}

/** Texts and emails a bought card to its recipient. Returns the email outcome. */
export async function sendGiftCardToRecipient(card: GiftCard): Promise<"sent" | "failed" | "skipped"> {
  const from = card.senderName ?? "Someone";
  const amount = formatPrice(card.value);
  const first = card.recipientName.split(" ")[0];
  const hi = smsName(first, 12);
  await notifySms(card.recipientPhone, `Namaste${hi ? ` ${hi}` : ""}! ${smsName(card.senderName) ?? "Someone"} sent you an Easypick gift card: ${amount}. Code ${card.code}. Use it online or in store.`);
  return notifyEmail(
    card.recipientEmail,
    card.senderName ? `${card.senderName} sent you an Easypick gift card` : "You've got an Easypick gift card",
    giftEmailHtml({
      preheader: `${amount} to spend online or in store. Your code is inside.`,
      heading: `Namaste ${first}, here's ${amount} to spend.`,
      nepali: "तपाईंलाई Easypick गिफ्ट कार्ड आएको छ।",
      intro: `${from} sent you an Easypick gift card. Use it online or at the kiosk in our store. Any balance you don't use stays on the card.`,
      quote: card.message || null,
      from: card.senderName,
      extra: giftCardEmailBlock({ design: card.design, amount, code: card.code }),
      button: { label: "Start shopping", url: `${site.url}/shop` },
      small: "Valid for 12 months. Enter the code at checkout, or show it at the kiosk. Signed in? Save it to your account and it pays by itself.",
    }),
    `Namaste ${first}, here's ${amount} to spend.\n\n${from} sent you an Easypick gift card.${card.message ? `\n\n"${card.message}"` : ""}\n\nCode: ${card.code}\nUse it at ${site.url}/shop or in store. Valid 12 months.`,
  );
}

/**
 * Sends every paid card whose send date has come (Kathmandu date). Each card is claimed in
 * one UPDATE first, so two cron runs at once can't both send it. Returns how many went out.
 */
export async function sendDueGiftCards(now: Date = new Date()): Promise<number> {
  const db = await getDb();
  const today = kathmanduToday(now);
  const claimed = await db
    .update(schema.giftCards)
    .set({ data: sql`${schema.giftCards.data} || '{"pendingSend": false}'::jsonb` })
    .where(
      and(
        eq(schema.giftCards.status, "active"),
        sql`${schema.giftCards.data}->>'pendingSend' = 'true'`,
        sql`${schema.giftCards.data}->>'sendOn' <= ${today}`,
      ),
    )
    .returning({ data: schema.giftCards.data });

  let sent = 0;
  for (const { data: card } of claimed) {
    try {
      const emailStatus = await sendGiftCardToRecipient(card);
      await markGiftCardSent(card.code);
      if (card.orderId && card.recipientEmail) {
        await updateOrder(card.orderId, (o) => {
          o.cardEmail = { to: card.recipientEmail!, status: emailStatus };
        });
      }
      sent++;
    } catch (e) {
      console.error("[gift-cards] scheduled send failed", card.code.slice(-4), e);
    }
  }
  return sent;
}
