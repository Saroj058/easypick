import "server-only";

import { after } from "next/server";

import { alertStaff } from "./alerts";
import { moveStock, StockShortError } from "./catalogue";
import { giftEmailHtml } from "./email";
import { activateGiftCard, findGiftCard, spendGiftCard } from "./gift-cards";
import { notifyEmail, notifySms } from "./notify";
import { event, lockOrder, updateOrder, type Order, type PaymentAttempt } from "./orders";
import { formatPrice } from "./format";
import { site } from "./site";

export interface VerifiedPayment {
  provider: PaymentAttempt["provider"];
  ref: string;
  gatewayRef: string;
  amount: number;
}

/**
 * Marks an order paid, exactly once. Call it only from a verified source: the wallet's
 * server-to-server check (return route or reconciliation), a fully gift-card-paid order,
 * or the development "Skip payment" button. Never from the browser coming back alone.
 *
 * - The order row is locked, so two calls at once can't both succeed.
 * - A payment that arrives after the 15-minute hold ran out is still taken: the pieces are
 *   held again, or, if they've sold meanwhile, the order is flagged for staff to refund.
 * - Emails and texts go out after the response, so a slow mail server never blocks a customer.
 */
export async function confirmPayment(orderId: string, verified?: VerifiedPayment): Promise<Order | null> {
  const outcome = await lockOrder(orderId, async (o, tx) => {
    // Record what the wallet confirmed, even on an order that's already paid.
    if (verified) {
      const attempts = o.payments ?? (o.payment ? [o.payment] : []);
      const a = attempts.find((x) => x.ref === verified.ref) ?? { provider: verified.provider, ref: verified.ref, startedAt: new Date().toISOString() };
      Object.assign(a, { gatewayRef: verified.gatewayRef, verifiedAt: new Date().toISOString(), amount: verified.amount });
      o.payments = attempts.some((x) => x.ref === a.ref) ? attempts : [...attempts, a];
      o.payment = a;
    }
    if (o.status !== "awaiting_payment" && o.status !== "expired") return { save: Boolean(verified), result: { order: o, fresh: false } };

    const problems: string[] = [];
    if (o.status === "expired") {
      // The hold ended before the money arrived: take the pieces and card balance again.
      if (o.kind !== "gift_card" && !o.stockHeld) {
        try {
          await tx.transaction(async (sp) => {
            await moveStock(sp, o.lines.map((l) => ({ sku: l.sku, delta: -l.qty })), { reason: "order_hold", source: "web", ref: o.number }, { online: false });
          });
          o.stockHeld = true;
        } catch (e) {
          if (!(e instanceof StockShortError)) throw e;
          problems.push("Paid after the 15-minute hold ended, and a size has sold out since. Offer another size or refund it.");
        }
      }
      if (o.giftCard && o.giftCardReleased) {
        const again = await spendGiftCard(o.giftCard.code, o.giftCard.applied, o.id, tx);
        if (again < o.giftCard.applied) problems.push(`The gift card only had ${formatPrice(again)} of the ${formatPrice(o.giftCard.applied)} left. Collect the difference or refund.`);
        o.giftCardReleased = false;
      }
    }

    o.status = "paid";
    o.paidAt = new Date().toISOString();
    o.events = [...(o.events ?? []), event("system", verified ? `Paid with ${verified.provider} (${verified.gatewayRef})` : o.total <= 0 ? "Paid by gift card" : "Marked paid")];
    if (problems.length) {
      o.attention = problems.join(" ");
      o.events.push(event("system", `Needs attention: ${o.attention}`));
    }
    if (o.kind === "gift_card" && o.issuedCardCode) await activateGiftCard(o.issuedCardCode, tx);
    return { save: true, result: { order: o, fresh: true } };
  });
  if (!outcome) return null;
  if (outcome.fresh) {
    const order = outcome.order;
    after(() => sendPaidMessages(order).catch((e) => console.error("[payments] messages failed", order.number, e)));
    after(() =>
      alertStaff(
        order.attention ? `Needs attention: ${order.number}` : `New order ${order.number}`,
        `${order.number} · ${formatPrice(order.total)} · ${order.lines.map((l) => `${l.name} ${l.size}`).join(", ")}${order.attention ? `\n\n${order.attention}` : ""}\n\n${site.url}/admin/orders/${order.id}`,
      ),
    );
  }
  return outcome.order;
}

/** The emails and texts that follow a payment (gift link, gift card). Never throws for a failed send. */
async function sendPaidMessages(order: Order) {
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
    await updateOrder(order.id, (o) => {
      o.gift!.emailStatus = emailStatus;
    });
  }

  // ---- A gift card ----
  if (order.kind === "gift_card" && order.issuedCardCode) {
    await activateGiftCard(order.issuedCardCode);
    const card = await findGiftCard(order.issuedCardCode);
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
        await updateOrder(order.id, (o) => {
          o.cardEmail = { to: card.recipientEmail!, status: cardEmailStatus };
        });
      }
    }
  }

  await notifySms(order.phone, `Easypick: payment received for ${order.number}. Track it at ${site.url}/order/${order.id}`);
}
