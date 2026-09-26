import "server-only";

import { revalidateTag } from "next/cache";
import { after } from "next/server";

import { alertStaff } from "./alerts";
import { moveStock, StockShortError } from "./catalogue";
import { giftEmailHtml } from "./email";
import { activateGiftCard, findGiftCard, markGiftCardSent, spendGiftCard } from "./gift-cards";
import { isFutureKathmanduDate } from "./kathmandu-date";
import { notifyEmail, notifySms } from "./notify";
import { event, lockOrder, updateOrder, type Order, type PaymentAttempt } from "./orders";
import { formatPrice } from "./format";
import { paymentMode } from "./gateways";
import { site } from "./site";

export interface VerifiedPayment {
  provider: PaymentAttempt["provider"];
  ref: string;
  gatewayRef: string;
  amount: number;
  /** Which wallet endpoints confirmed it (sandbox or real money). Defaults to the current settings. */
  mode?: "test" | "live";
}

const walletName = { esewa: "eSewa", khalti: "Khalti", fonepay: "Fonepay" } as const;
export const SANDBOX_ATTENTION = "Test (sandbox) payment – do not hand over.";

/** The real shop. Sandbox wallets are fine locally and on previews; here they must never ship goods. */
const onLiveSite = () => process.env.VERCEL_ENV === "production";

/** Adds a note for staff without losing one that's already there. */
function flag(o: Order, text: string) {
  o.attention = o.attention ? `${o.attention} ${text}` : text;
  o.events = [...(o.events ?? []), event("system", `Needs attention: ${text}`)];
}

/** Stock moved: refresh "2 left" on the shop. Next refuses this during a page render; the cron then notices the stock movement instead. */
function catalogueMoved() {
  try {
    revalidateTag("catalogue", "max");
  } catch {
    // Called while rendering the order page: /api/cron revalidates when it sees the movement.
  }
}

type Outcome = { order: Order; fresh: boolean; alert?: string; sandbox: boolean; restocked: boolean };

/**
 * Marks an order paid, exactly once. Call it only from a verified source: the wallet's
 * server-to-server check (return route or reconciliation), a fully gift-card-paid order,
 * or the development "Skip payment" button. Never from the browser coming back alone.
 *
 * - The order row is locked, so two calls at once can't both succeed.
 * - A payment that arrives after the 15-minute hold ran out is still taken: the pieces are
 *   held again, or, if they've sold meanwhile, the order is flagged for staff to refund.
 * - Money that arrives for an order that isn't waiting for it (cancelled, or already paid
 *   by another attempt) is never kept silently: the order is flagged and staff are told.
 * - A sandbox payment on the live site is flagged "do not hand over".
 * - Emails and texts go out after the response, so a slow mail server never blocks a customer.
 */
export async function confirmPayment(orderId: string, verified?: VerifiedPayment): Promise<Order | null> {
  const outcome = await lockOrder<Outcome>(orderId, async (o, tx) => {
    const unchanged = { save: false, result: { order: o, fresh: false, sandbox: false, restocked: false } };
    let sandbox = false;
    let earlierRefs: string[] = [];
    // Record what the wallet confirmed, even on an order that's already paid.
    if (verified) {
      const attempts = o.payments ?? (o.payment ? [o.payment] : []);
      const known = attempts.find((x) => x.ref === verified.ref);
      if (known?.verifiedAt) return unchanged; // the same payment reported again (return page and cron)
      earlierRefs = attempts.filter((x) => x.verifiedAt).map((x) => x.gatewayRef ?? x.ref);
      const a: PaymentAttempt = known ?? { provider: verified.provider, ref: verified.ref, startedAt: new Date().toISOString() };
      // Test if either the attempt was started, or the reply was checked, against a sandbox.
      const mode = (verified.mode ?? paymentMode()) === "live" && a.mode !== "test" ? "live" : "test";
      Object.assign(a, { gatewayRef: verified.gatewayRef, verifiedAt: new Date().toISOString(), amount: verified.amount, mode });
      o.payments = known ? attempts : [...attempts, a];
      o.payment = a;
      sandbox = mode === "test" && onLiveSite();
    }

    if (o.status !== "awaiting_payment" && o.status !== "expired") {
      if (!verified) return unchanged;
      // Money for an order that isn't waiting for it: keep the record and get a person to refund it.
      const wallet = walletName[verified.provider];
      const paid = `${formatPrice(verified.amount)} with ${wallet} (ref ${verified.gatewayRef})`;
      const note =
        o.status === "cancelled" && !o.paidAt
          ? `Paid ${paid} after the order was cancelled. Refund it in ${wallet}.`
          : `Paid twice: ${paid} arrived after the order was already paid${earlierRefs.length ? ` (ref ${earlierRefs.join(", ")})` : ""}. Refund one in ${wallet}.`;
      flag(o, sandbox ? `${SANDBOX_ATTENTION} ${note}` : note);
      return { save: true, result: { order: o, fresh: false, alert: note, sandbox, restocked: false } };
    }

    const problems: string[] = [];
    let restocked = false;
    if (sandbox) problems.push(SANDBOX_ATTENTION);
    if (o.status === "expired") {
      // The hold ended before the money arrived: take the pieces and card balance again.
      if (o.kind !== "gift_card" && !o.stockHeld) {
        try {
          await tx.transaction(async (sp) => {
            // online: a last piece kept on the shop floor isn't the website's to take.
            await moveStock(sp, o.lines.map((l) => ({ sku: l.sku, delta: -l.qty })), { reason: "order_hold", source: "web", ref: o.number }, { online: true });
          });
          o.stockHeld = true;
          restocked = true;
        } catch (e) {
          if (!(e instanceof StockShortError)) throw e;
          problems.push("Paid after the 15-minute hold ended, and a size has sold out since. Offer another size or refund it.");
        }
      }
      if (o.giftCard && o.giftCardReleased) {
        const again = await spendGiftCard(o.giftCard.code, o.giftCard.applied, o.id, tx);
        if (again < o.giftCard.applied) problems.push(`The gift card only had ${formatPrice(again)} of the ${formatPrice(o.giftCard.applied)} left. Collect the difference or refund.`);
        // What the card really paid this time, so a refund puts back only that.
        o.giftCard = { ...o.giftCard, applied: again };
        o.giftCardReleased = false;
      }
    }

    o.status = "paid";
    o.paidAt = new Date().toISOString();
    o.events = [...(o.events ?? []), event("system", verified ? `Paid with ${verified.provider} (${verified.gatewayRef})` : o.total <= 0 ? "Paid by gift card" : "Marked paid")];
    if (problems.length) flag(o, problems.join(" "));
    if (o.kind === "gift_card" && o.issuedCardCode) await activateGiftCard(o.issuedCardCode, tx);
    return { save: true, result: { order: o, fresh: true, sandbox, restocked } };
  });
  if (!outcome) return null;
  const order = outcome.order;
  const tag = outcome.sandbox ? "TEST (sandbox) payment – " : "";
  if (outcome.restocked) catalogueMoved();
  if (outcome.fresh) {
    after(() => sendPaidMessages(order).catch((e) => console.error("[payments] messages failed", order.number, e)));
    after(() =>
      alertStaff(
        `${tag}${order.attention ? `Needs attention: ${order.number}` : `New order ${order.number}`}`,
        `${order.number} · ${formatPrice(order.total)} · ${order.lines.map((l) => `${l.name} ${l.size}`).join(", ")}${order.attention ? `\n\n${order.attention}` : ""}\n\n${site.url}/admin/orders/${order.id}`,
      ),
    );
  } else if (outcome.alert) {
    const note = outcome.alert;
    after(() => alertStaff(`${tag}Needs attention: ${order.number}`, `${order.number}: ${note}\n\n${site.url}/admin/orders/${order.id}`));
  }
  return order;
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
    // A card with a later send date waits for the cron (lib/gift-card-delivery.ts).
    if (card && !card.pendingSend && !isFutureKathmanduDate(card.sendOn)) {
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
      await markGiftCardSent(card.code);
      if (card.recipientEmail) {
        await updateOrder(order.id, (o) => {
          o.cardEmail = { to: card.recipientEmail!, status: cardEmailStatus };
        });
      }
    }
  }

  await notifySms(order.phone, `Easypick: payment received for ${order.number}. Track it at ${site.url}/order/${order.id}`);
}
