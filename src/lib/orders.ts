import "server-only";

import { and, desc, eq, notInArray, or } from "drizzle-orm";

import { getDb, giftCardRow, orderRow, schema, type DB } from "./db";
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
  /** When each step of the order happened, for the tracker. */
  paidAt?: string;
  packedAt?: string;
  readyAt?: string;
  completedAt?: string;
  /** Where a goods order came from; a Buy now order leaves the bag alone. */
  source?: "bag" | "buy_now";
  /** For gift_card orders: the card that was issued. */
  issuedCardCode?: string;
  /** For gift_card orders: where the card was emailed and whether it went out. */
  cardEmail?: { to: string; status: "sent" | "failed" | "skipped" };
}

export async function saveOrder(order: Order, userId?: string | null) {
  const db = await getDb();
  await db.insert(schema.orders).values(orderRow(order, userId ?? null));
}

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/** An unpaid order past its 15 minutes: mark it expired and give back any gift card balance it held. */
async function expireIfLate(tx: Tx, o: Order) {
  if (o.status !== "awaiting_payment" || Date.parse(o.expiresAt) >= Date.now()) return o;
  const order: Order = { ...o, status: "expired" };
  if (o.giftCard) {
    const [card] = await tx.select().from(schema.giftCards).where(eq(schema.giftCards.code, o.giftCard.code)).for("update");
    if (card && card.data.uses.some((u) => u.orderId === o.id && !u.refunded)) {
      const data = {
        ...card.data,
        balance: card.balance + o.giftCard.applied,
        uses: card.data.uses.map((u) => (u.orderId === o.id ? { ...u, refunded: true } : u)),
      };
      await tx.update(schema.giftCards).set(giftCardRow(data)).where(eq(schema.giftCards.code, card.code));
    }
  }
  await tx.update(schema.orders).set({ status: "expired", data: order }).where(eq(schema.orders.id, o.id));
  return order;
}

export async function findOrder(id: string): Promise<Order | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.orders).where(eq(schema.orders.id, id)).for("update");
    return row ? expireIfLate(tx, row.data) : null;
  });
}

/** For /track: the order number and the phone it was placed with must both match. */
export async function findOrderByNumber(number: string, phone: string): Promise<Order | null> {
  const n = number.trim().toUpperCase().replace(/^(EP-?)?/, "EP-");
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(eq(schema.orders.number, n), eq(schema.orders.phone, phone)));
  return row ? findOrder(row.id) : null;
}

export async function findOrderByGiftToken(token: string): Promise<Order | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.orders).where(eq(schema.orders.giftToken, token));
  return row?.data ?? null;
}

/** Change an order safely: the row is locked while `fn` edits it. */
export async function updateOrder(id: string, fn: (o: Order) => void): Promise<Order | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.orders).where(eq(schema.orders.id, id)).for("update");
    if (!row) return null;
    const order = structuredClone(row.data);
    fn(order);
    await tx.update(schema.orders).set(orderRow(order, row.userId)).where(eq(schema.orders.id, id));
    return order;
  });
}

/** Orders for an account: placed while signed in, or with the same phone number. */
export async function ordersFor(userId: string, phone: string | null): Promise<Order[]> {
  const db = await getDb();
  const rows = await db
    .select({ data: schema.orders.data })
    .from(schema.orders)
    .where(phone ? or(eq(schema.orders.userId, userId), eq(schema.orders.phone, phone)) : eq(schema.orders.userId, userId))
    .orderBy(desc(schema.orders.createdAt));
  return rows.map((r) => r.data);
}

/** Paid orders (anything past "awaiting payment"), for the admin screen. */
export async function paidOrders(): Promise<Order[]> {
  const db = await getDb();
  const rows = await db
    .select({ data: schema.orders.data })
    .from(schema.orders)
    .where(notInArray(schema.orders.status, ["awaiting_payment", "expired"]))
    .orderBy(desc(schema.orders.createdAt));
  return rows.map((r) => r.data);
}

