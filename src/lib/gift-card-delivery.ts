import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb, schema } from "./db";
import { giftEmailHtml } from "./email";
import { markGiftCardSent, type GiftCard } from "./gift-cards";
import { kathmanduToday } from "./kathmandu-date";
import { notifyEmail, notifySms } from "./notify";
import { updateOrder } from "./orders";
import { site } from "./site";

// Bought gift cards with a send date wait until that Kathmandu day; the cron sends them.
// Cards sent at payment are marked sent there (lib/payments.ts), so nothing goes twice.

/** Texts and emails a bought card to its recipient. Returns the email outcome. */
export async function sendGiftCardToRecipient(card: GiftCard): Promise<"sent" | "failed" | "skipped"> {
  const from = card.senderName ?? "Someone";
  const amount = `Rs ${card.value.toLocaleString("en-IN")}`;
  await notifySms(card.recipientPhone, `${from} sent you an Easypick gift card worth ${amount}. Code: ${card.code}. Use it online or in store.`);
  return notifyEmail(
    card.recipientEmail,
    `${from} sent you an Easypick gift card`,
    giftEmailHtml({
      heading: `Namaste ${card.recipientName.split(" ")[0]}, here's ${amount} to spend.`,
      intro: `${from} sent you an Easypick gift card. Use it online or at the kiosk in our store. Any balance you don't use stays on the card.`,
      quote: card.message || null,
      from: card.senderName,
      extra: `<div style="margin:0 0 24px;background:#0a0a0a;color:#ffffff;padding:18px 22px;font-family:ui-monospace,Menlo,monospace;font-size:24px;font-weight:700;letter-spacing:0.1em">${card.code}</div>`,
      button: { label: "Start shopping", url: `${site.url}/shop` },
      small: "Valid for 12 months. Enter the code at checkout, or show it at the kiosk.",
    }),
    `${from} sent you an Easypick gift card worth ${amount}.\nCode: ${card.code}\nUse it at ${site.url}/shop or in store. Valid 12 months.`,
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
