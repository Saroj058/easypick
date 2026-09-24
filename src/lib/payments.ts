import "server-only";

import { db } from "./db";
import { giftEmailHtml } from "./email";
import { activateGiftCard } from "./gift-cards";
import { notifyEmail, notifySms } from "./notify";
import { findOrder, updateOrder } from "./orders";
import { site } from "./site";

/**
 * Everything that happens once a payment is confirmed:
 *   - the order becomes "paid"
 *   - a gift's receiver gets the private link by email (and SMS if we have their number)
 *   - a bought gift card is switched on and sent to its receiver
 *
 * Call this only from a verified source: the payment provider's server-to-server
 * confirmation (eSewa / Khalti / Fonepay webhook), or the test-mode "Pay now" button.
 * Never from the browser redirect after paying. Safe to call twice.
 */
export async function confirmPayment(orderId: string) {
  const order = findOrder(orderId);
  if (!order || order.status !== "awaiting_payment") return order;

  updateOrder(order.id, (o) => {
    o.status = "paid";
  });

  // ---- A piece sent as a gift ----
  if (order.gift) {
    const g = order.gift;
    const from = g.senderName ?? "Someone";
    const first = g.receiverName.split(" ")[0];
    const link = `${site.url}/g/${g.token}`;

    await notifySms(
      g.receiverPhone,
      g.mode === "pick"
        ? `${from} sent you a gift from Easypick. Open it to pick your size online, or try it on in our store: ${link}`
        : `${from} sent you a gift from Easypick. See it here: ${link}`,
    );
    const emailStatus = await notifyEmail(
      g.receiverEmail,
      `${from} sent you a gift from Easypick`,
      giftEmailHtml({
        heading: `Namaste ${first}, you've got a gift.`,
        intro:
          g.mode === "pick"
            ? `${from} picked something from Easypick for you. Open it to choose your size online, or try it on in our store in ${site.store.area}.`
            : `${from} picked something from Easypick for you. Open it to see what's on the way.`,
        quote: g.message || null,
        from: g.senderName,
        button: { label: "Open your gift", url: link },
        small: g.showPrice
          ? "This link is just for you. Swap the size within 14 days if it's not right."
          : "This link is just for you. You won't see the price. Swap the size within 14 days if it's not right.",
      }),
      `${from} sent you a gift from Easypick.${g.message ? `\n\n"${g.message}"` : ""}\n\nOpen your gift: ${link}`,
    );
    updateOrder(order.id, (o) => {
      o.gift!.emailStatus = emailStatus;
    });
  }

  // ---- A gift card ----
  if (order.kind === "gift_card" && order.issuedCardCode) {
    activateGiftCard(order.issuedCardCode);
    const card = db((d) => d.giftCards.find((c) => c.code === order.issuedCardCode));
    if (card) {
      const from = card.senderName ?? "Someone";
      const amount = `Rs ${card.value.toLocaleString("en-IN")}`;
      await notifySms(card.recipientPhone, `${from} sent you an Easypick gift card worth ${amount}. Code: ${card.code}. Use it online or in store.`);
      const cardEmailStatus = await notifyEmail(
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
      if (card.recipientEmail) {
        updateOrder(order.id, (o) => {
          o.cardEmail = { to: card.recipientEmail!, status: cardEmailStatus };
        });
      }
    }
  }

  // TODO: SMS the buyer their receipt once the SMS gateway is live.
  return findOrder(orderId);
}
