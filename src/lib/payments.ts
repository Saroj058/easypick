import "server-only";

import { revalidateTag } from "next/cache";
import { after } from "next/server";

import { alertStaff } from "./alerts";
import { moveStock, StockShortError } from "./catalogue";
import { sendGiftCardToRecipient, sendGiftLink } from "./gift-card-delivery";
import { activateGiftCard, findGiftCard, markGiftCardSent, spendGiftCard } from "./gift-cards";
import { isFutureKathmanduDate } from "./kathmandu-date";
import { notifySms } from "./notify";
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
  // ---- A piece sent as a gift ---- (a dated "I know their size" gift waits for the cron: lib/gift-card-delivery.ts)
  if (order.gift && !order.gift.pendingSend) await sendGiftLink(order);

  // ---- A gift card ----
  if (order.kind === "gift_card" && order.issuedCardCode) {
    await activateGiftCard(order.issuedCardCode);
    const card = await findGiftCard(order.issuedCardCode);
    // A card with a later send date waits for the cron (lib/gift-card-delivery.ts).
    if (card && !card.pendingSend && !isFutureKathmanduDate(card.sendOn)) {
      const cardEmailStatus = await sendGiftCardToRecipient(card);
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
