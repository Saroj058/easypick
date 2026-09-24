import "server-only";

import { db } from "./db";
import type { FulfilmentMethod, PaymentProvider, Size } from "./types";

// Online orders. The real ledger lives in the Store API (one stock ledger for web
// and kiosk). Until then orders are kept in the local JSON store (lib/db.ts).

export type OrderStatus = "awaiting_payment" | "paid" | "ready_for_pickup" | "out_for_delivery" | "completed" | "expired";

export interface OrderLine {
  sku: string;
  slug: string;
  name: string;
  size: Size;
  colour: string;
  unitPrice: number;
  qty: number;
}

export type GiftWrap = "standard" | "premium";

/** Gift details on an order. The receiver's address lives here and is never shown to the buyer. */
export interface GiftInfo {
  /** "pick": the receiver chooses size (and maybe colour) on the gift page. "set": the buyer chose. */
  mode: "pick" | "set";
  /** Private link for the receiver: /g/<token>. */
  token: string;
  receiverName: string;
  /** Optional since email was added; needed for SMS and the delivery rider. */
  receiverPhone: string | null;
  /** Where the gift link is emailed. */
  receiverEmail?: string | null;
  /** Whether the gift email reached the provider ("failed" → buyer is asked to share the link). */
  emailStatus?: "sent" | "failed" | "skipped";
  /** Null when sent anonymously. */
  senderName: string | null;
  message: string;
  wrap: GiftWrap;
  /** yyyy-mm-dd, or null for as soon as possible. */
  deliverOn: string | null;
  /** Buyer chose to let the receiver see what it cost (default: hidden). */
  showPrice?: boolean;
  /** Receiver may also change the colour (pick mode only). */
  colourChoice: boolean;
  status: "sent" | "opened" | "chosen" | "converted" | "delivered";
  openedAt?: string;
  chosenAt?: string;
  /** Filled by the receiver. */
  receiver?: {
    method: FulfilmentMethod;
    address?: { area: string; landmark: string; details: string };
    slot?: string;
    /** They'll come to the store, try sizes on, and take the one that fits. */
    tryInStore?: boolean;
  };
  /** When a sold-out gift was turned into a gift card. */
  convertedCardCode?: string;
  /** Thank-you note from the receiver back to the buyer. */
  thanks?: { text: string; at: string };
  /** Rs-off credit for the receiver's own first order. */
  welcomeCode?: string;
  packedAt?: string;
  deliveredAt?: string;
}

export interface Order {
  id: string;
  number: string; // shown to customers, e.g. EP-104233
  phone: string;
  method: FulfilmentMethod;
  address?: { area: string; landmark: string; details: string };
  provider: PaymentProvider;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  /** Premium gift box, when chosen. */
  wrapFee?: number;
  /** Paid with an Easypick gift card. */
  giftCard?: { code: string; applied: number };
  total: number;
  status: OrderStatus;
  createdAt: string;
  /** Unpaid orders release their stock after 15 minutes. */
  expiresAt: string;
  gift?: GiftInfo;
  /** "gift_card" orders buy a digital gift card instead of clothes. */
  kind?: "goods" | "gift_card";
  /** For gift_card orders: the card that was issued. */
  issuedCardCode?: string;
  /** For gift_card orders: where the card was emailed and whether it went out. */
  cardEmail?: { to: string; status: "sent" | "failed" | "skipped" };
}

export function saveOrder(order: Order, userId?: string | null) {
  db((d) => {
    d.orders.push({ ...order, userId: userId ?? null });
  }, true);
}

export function findOrder(id: string): Order | null {
  return db((d) => {
    const o = d.orders.find((x) => x.id === id);
    if (!o) return null;
    if (o.status === "awaiting_payment" && Date.parse(o.expiresAt) < Date.now()) {
      o.status = "expired";
      // Give back any gift card balance this unpaid order had reserved.
      if (o.giftCard) {
        const card = d.giftCards.find((c) => c.code === o.giftCard!.code);
        if (card && card.uses.some((u) => u.orderId === o.id && !u.refunded)) {
          card.balance += o.giftCard.applied;
          card.uses = card.uses.map((u) => (u.orderId === o.id ? { ...u, refunded: true } : u));
        }
      }
    }
    return o;
  }, true);
}

export function findOrderByGiftToken(token: string): Order | null {
  return db((d) => d.orders.find((o) => o.gift?.token === token) ?? null);
}

export function updateOrder(id: string, fn: (o: Order) => void): Order | null {
  return db((d) => {
    const o = d.orders.find((x) => x.id === id);
    if (!o) return null;
    fn(o);
    return o;
  }, true);
}

/** Orders for an account: placed while signed in, or with the same phone number. */
export function ordersFor(userId: string, phone: string | null): Order[] {
  return db((d) =>
    d.orders.filter((o) => o.userId === userId || (phone !== null && o.phone === phone)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  );
}
