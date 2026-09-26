import "server-only";

import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { cache } from "react";

import { moveStock, StockShortError } from "./catalogue";
import { getDb, orderRow, schema, type Tx } from "./db";
import { creditGiftCard, issueGiftCard, spendGiftCard, type GiftCard } from "./gift-cards";
import type { FulfilmentMethod, PaymentProvider, Size } from "./types";

// Online orders, in PostgreSQL (orders + order_lines). Placing an order holds its pieces
// (stock goes down straight away) for 15 minutes while the customer pays; an unpaid order
// then expires and gives them back. A verified payment makes the hold a sale.

export type OrderStatus = "awaiting_payment" | "paid" | "ready_for_pickup" | "out_for_delivery" | "completed" | "expired" | "cancelled";

/** Something that happened to an order, for staff and the customer's tracker. */
export interface OrderEvent {
  at: string;
  by: string;
  what: string;
}

export interface PaymentAttempt {
  provider: PaymentProvider;
  ref: string;
  startedAt: string;
  gatewayRef?: string;
  verifiedAt?: string;
  amount?: number;
  /** Sandbox ("test") or real money ("live"), from the settings when the attempt started. */
  mode?: "test" | "live";
  /** Reconciliation: when the wallet was last asked, what it said, and when staff were told it's stuck. */
  lastCheckedAt?: string;
  lastStatus?: string;
  alertedAt?: string;
  /** This attempt gave the hold its one extra 10 minutes. */
  extendedHold?: boolean;
}

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
  /** The receiver sees what it cost (default: shown; the buyer can tick "Hide the price from them"). */
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
  /** The latest payment attempt, and what the provider confirmed. */
  payment?: PaymentAttempt;
  /** Every attempt: a customer may open the payment page twice and pay in the first tab. */
  payments?: PaymentAttempt[];
  /** True while this order's pieces are held off stock (placed, paid, or on its way). */
  stockHeld?: boolean;
  /** Gift card money went back to the card when the order expired. */
  giftCardReleased?: boolean;
  /** Staff must act (e.g. paid after the hold ended and the size had sold). */
  attention?: string | null;
  events?: OrderEvent[];
  /** Money given back (to the wallet by staff, or to a gift card). */
  refunds?: { at: string; by: string; amount: number; toGiftCard: number; walletRef?: string; note?: string; skus: string[]; lines?: { i: number; qty: number }[] }[];
  /** The delivery fee / gift box fee has been refunded (each can only be refunded once). */
  deliveryRefunded?: boolean;
  wrapRefunded?: boolean;
  /** Delivery rider, set when it goes out. */
  rider?: { name: string; phone: string };
  /** When each step of the order happened, for the tracker. */
  paidAt?: string;
  packedAt?: string;
  readyAt?: string;
  completedAt?: string;
  /** Where a goods order came from; a Buy now order leaves the bag alone. */
  source?: "bag" | "buy_now";
  /** Keyed hash of the visitor's IP, only to limit unpaid orders per visitor (never shown). */
  placedFrom?: string;
  /** For gift_card orders: the card that was issued. */
  issuedCardCode?: string;
  /** For gift_card orders: where the card was emailed and whether it went out. */
  cardEmail?: { to: string; status: "sent" | "failed" | "skipped" };
}

/** How many of each line have already been refunded. */
export function refundedQty(o: Order): number[] {
  const done = o.lines.map(() => 0);
  for (const r of o.refunds ?? []) for (const l of r.lines ?? []) done[l.i] += l.qty;
  return done;
}

// ---------- Writing ----------

const sameLines = (a: OrderLine[], b: OrderLine[]) =>
  a.length === b.length && a.every((l, i) => l.sku === b[i].sku && l.slug === b[i].slug && l.qty === b[i].qty && l.unitPrice === b[i].unitPrice);

/**
 * Saves an order row and keeps its order_lines in step. Pass `before` (the lines as they are
 * stored now) to skip rewriting order_lines when nothing about them changed.
 */
export async function writeOrder(tx: Tx, order: Order, userId: string | null, insert = false, before?: OrderLine[]) {
  if (insert) await tx.insert(schema.orders).values(orderRow(order, userId));
  else await tx.update(schema.orders).set(orderRow(order, userId)).where(eq(schema.orders.id, order.id));
  if (!insert && before && sameLines(before, order.lines)) return;
  if (!insert) await tx.delete(schema.orderLines).where(eq(schema.orderLines.orderId, order.id));
  if (order.lines.length)
    await tx.insert(schema.orderLines).values(order.lines.map((l, i) => ({ orderId: order.id, lineNo: i, sku: l.sku, slug: l.slug, qty: l.qty, unitPrice: l.unitPrice })));
}

export const event = (by: string, what: string): OrderEvent => ({ at: new Date().toISOString(), by, what });

export type CreateResult = { ok: true; order: Order } | { ok: false; message: string };

/**
 * Places an order in one step: a number from the sequence, the pieces held off stock,
 * any gift card spent, a bought gift card issued. All or nothing.
 */
export async function createOrder(
  draft: Omit<Order, "number" | "total">,
  opts: {
    userId?: string | null;
    /** Gift card code to spend on this order. */
    giftCardCode?: string | null;
    /** For gift card purchases: the card to issue (switched on when paid). */
    issueCard?: Omit<GiftCard, "code" | "balance" | "createdAt" | "expiresAt" | "uses" | "orderId">;
  } = {},
): Promise<CreateResult> {
  const db = await getDb();
  try {
    const order = await db.transaction(async (tx) => {
      const [{ n }] = (await tx.execute(sql`select nextval('order_number_seq')::text as n`)) as unknown as { n: string }[];
      const o: Order = { ...draft, number: `EP-${n}`, total: 0, events: [...(draft.events ?? []), event("customer", "Order placed")] };

      if (o.kind !== "gift_card") {
        await moveStock(
          tx,
          o.lines.map((l) => ({ sku: l.sku, delta: -l.qty })),
          { reason: "order_hold", source: "web", ref: o.number },
          { online: true },
        );
        o.stockHeld = true;
      }
      const due = o.subtotal + o.deliveryFee + (o.wrapFee ?? 0);
      if (opts.giftCardCode) {
        const applied = await spendGiftCard(opts.giftCardCode, due, o.id, tx);
        if (applied > 0) o.giftCard = { code: opts.giftCardCode, applied };
      }
      o.total = due - (o.giftCard?.applied ?? 0);
      if (opts.issueCard) {
        const card = await issueGiftCard({ ...opts.issueCard, orderId: o.id }, 365, tx);
        o.issuedCardCode = card.code;
      }
      await writeOrder(tx, o, opts.userId ?? null, true);
      return o;
    });
    // Stock went down: pages showing "2 left" refresh (createOrder only runs in server actions).
    if (order.kind !== "gift_card") revalidateTag("catalogue", "max");
    return { ok: true, order };
  } catch (e) {
    if (e instanceof StockShortError) {
      const line = draft.lines.find((l) => l.sku === e.sku);
      const what = line ? `${line.name} in ${line.size === "ONE" ? line.colour : `${line.colour}, ${line.size}`}` : "one of the pieces";
      return { ok: false, message: e.left > 0 ? `Only ${e.left} left of ${what}. Update the quantity to continue.` : `${what} just sold out.` };
    }
    throw e;
  }
}

/** Gives back what an order holds: its pieces, and any gift card money. Used when it expires or is cancelled. */
export async function releaseHolds(tx: Tx, o: Order, reason: "order_release" | "refund_restock", by: string) {
  if (o.stockHeld && o.kind !== "gift_card") {
    await moveStock(
      tx,
      o.lines.map((l) => ({ sku: l.sku, delta: l.qty })),
      { reason, source: by === "customer" || by === "system" ? "web" : "admin", ref: o.number, actor: by },
    );
    o.stockHeld = false;
  }
  if (o.giftCard && !o.giftCardReleased) {
    await creditGiftCard(o.giftCard.code, o.giftCard.applied, o.id, tx);
    o.giftCardReleased = true;
  }
}

/** An unpaid order past its 15 minutes: expire it and give back what it held. */
async function expireIfLate(tx: Tx, o: Order, userId: string | null) {
  if (o.status !== "awaiting_payment" || Date.parse(o.expiresAt) >= Date.now()) return o;
  const order: Order = structuredClone(o);
  await releaseHolds(tx, order, "order_release", "system");
  order.status = "expired";
  order.events = [...(order.events ?? []), event("system", "Expired: not paid within 15 minutes")];
  await writeOrder(tx, order, userId, false, o.lines);
  return order;
}

/**
 * Change an order safely: the row is locked while `fn` works on a copy (it may also use the
 * transaction for stock or gift cards). Return false from `fn` to leave the order unchanged.
 */
export async function lockOrder<T>(id: string, fn: (o: Order, tx: Tx) => Promise<{ save: boolean; result: T }>): Promise<T | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.orders).where(eq(schema.orders.id, id)).for("update");
    if (!row) return null;
    const current = await expireIfLate(tx, row.data, row.userId);
    const order = structuredClone(current);
    const { save, result } = await fn(order, tx);
    if (save) await writeOrder(tx, order, row.userId, false, current.lines);
    return result;
  });
}

/** Simple edits (no stock or cards involved). */
export async function updateOrder(id: string, fn: (o: Order) => void): Promise<Order | null> {
  return lockOrder(id, async (o) => {
    fn(o);
    return { save: true, result: o };
  });
}

export async function findOrder(id: string): Promise<Order | null> {
  const db = await getDb();
  const [row] = await db.select({ status: schema.orders.status, data: schema.orders.data }).from(schema.orders).where(eq(schema.orders.id, id));
  if (!row) return null;
  // Only unpaid orders can need expiring; everything else is a plain read.
  if (row.status !== "awaiting_payment" || Date.parse(row.data.expiresAt) >= Date.now()) return row.data;
  return lockOrder(id, async (o) => ({ save: false, result: o }));
}

/** For payment replies: eSewa and Fonepay references start with the order number (EP-1000001-…). */
export async function findOrderByPaymentRef(ref: string): Promise<Order | null> {
  const number = ref.slice(0, ref.lastIndexOf("-"));
  if (!/^EP-\d{6,9}$/.test(number)) return null;
  const db = await getDb();
  const [row] = await db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.number, number));
  const order = row ? await findOrder(row.id) : null;
  if (!order) return null;
  const attempts = order.payments ?? (order.payment ? [order.payment] : []);
  return attempts.some((a) => a.ref === ref) ? order : null;
}

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
  const [row] = await db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.giftToken, token));
  return row ? findOrder(row.id) : null;
}

const ord = schema.orders;

/**
 * Orders for an account: placed while signed in, or placed without an account using the
 * same phone number. Another account's orders never show, even with the same phone.
 */
export async function ordersFor(userId: string, phone: string | null): Promise<Order[]> {
  const db = await getDb();
  const rows = await db
    .select({ data: ord.data })
    .from(ord)
    .where(phone ? or(eq(ord.userId, userId), and(isNull(ord.userId), eq(ord.phone, phone))) : eq(ord.userId, userId))
    .orderBy(desc(ord.createdAt));
  return rows.map((r) => r.data);
}

// ---------- Staff lists ----------
// "Paid" means money actually arrived: paid_at is set. An order cancelled before payment
// never counts, whatever its status.

const isPaid = isNotNull(ord.paidAt);
/** Something needs the owner, whatever the order's status. */
const hasAttention = sql`coalesce(${ord.data}->>'attention', '') <> ''`;
/** Paid, not packed, has clothes, and not a pick-your-size gift still waiting on the receiver. */
const toPackSql = sql`${ord.status} = 'paid' and ${ord.data}->>'packedAt' is null and ${ord.kind} = 'goods'
  and coalesce(${ord.data}->'gift'->>'status', '') <> 'converted'
  and not (coalesce(${ord.data}->'gift'->>'mode', '') = 'pick' and coalesce(${ord.data}->'gift'->>'status', '') in ('sent', 'opened'))`;
const ACTIVE: Order["status"][] = ["paid", "ready_for_pickup", "out_for_delivery"];

const pick = async (where: SQL | undefined, limit?: number) => {
  const db = await getDb();
  const q = db.select({ data: ord.data }).from(ord).where(where).orderBy(desc(ord.paidAt), desc(ord.createdAt));
  return (await (limit ? q.limit(limit) : q)).map((r) => r.data);
};

/** Every paid order, newest payment first. Heavy: prefer the focused lists below. Cached per request. */
export const paidOrders = cache(async (): Promise<Order[]> => pick(isPaid));

/** Paid orders whose payment arrived in [since, until). For reports. */
export async function paidOrdersBetween(since: Date, until?: Date): Promise<Order[]> {
  return pick(and(isPaid, gte(ord.paidAt, since.toISOString()), until ? lt(ord.paidAt, until.toISOString()) : undefined));
}

/** The staff queues: paid and not finished, plus anything that needs attention. Cached per request. */
export const activeOrders = cache(async (): Promise<Order[]> => pick(or(and(isPaid, inArray(ord.status, ACTIVE)), hasAttention)));

/** Finished paid orders (collected, delivered or cancelled), newest payment first. */
export async function recentDoneOrders(limit = 200): Promise<Order[]> {
  return pick(and(isPaid, inArray(ord.status, ["completed", "cancelled"])), limit);
}

/** The latest paid orders of any status. */
export async function recentPaidOrders(limit = 200): Promise<Order[]> {
  return pick(isPaid, limit);
}

/** How many paid orders are done / exist at all (for the tabs, without loading them). */
export async function paidOrderCounts(): Promise<{ done: number; all: number }> {
  const db = await getDb();
  const [row] = await db
    .select({
      done: sql<number>`count(*) filter (where ${ord.status} in ('completed', 'cancelled'))::int`,
      all: sql<number>`count(*)::int`,
    })
    .from(ord)
    .where(isPaid);
  return row;
}

/** Badge numbers for staff screens, counted in the database. */
export const staffQueueCounts = cache(async (): Promise<{ toPack: number; attention: number }> => {
  const db = await getDb();
  const [row] = await db
    .select({
      toPack: sql<number>`count(*) filter (where ${toPackSql})::int`,
      attention: sql<number>`count(*) filter (where ${hasAttention})::int`,
    })
    .from(ord)
    .where(or(and(isPaid, eq(ord.status, "paid")), hasAttention));
  return row;
});

/** The newest payment, for the new-order watcher. */
export async function latestPaid(): Promise<{ number: string; paidAt: string } | null> {
  const db = await getDb();
  const [row] = await db.select({ number: ord.number, paidAt: ord.paidAt }).from(ord).where(isPaid).orderBy(desc(ord.paidAt)).limit(1);
  return row ? { number: row.number, paidAt: new Date(row.paidAt!).toISOString() } : null;
}

/**
 * Unpaid orders that expired or were cancelled although the customer opened a payment page
 * in the last `days` days. Money may have left their wallet: worth a check in the eSewa portal.
 */
export async function ordersWithPaymentAttempts(days = 7, limit = 50): Promise<Order[]> {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await db
    .select({ data: ord.data })
    .from(ord)
    .where(
      and(
        inArray(ord.status, ["expired", "cancelled"]),
        isNull(ord.paidAt),
        gte(ord.createdAt, since),
        sql`(jsonb_array_length(coalesce(${ord.data}->'payments', '[]'::jsonb)) > 0 or ${ord.data} ? 'payment')`,
      ),
    )
    .orderBy(desc(ord.createdAt))
    .limit(limit);
  return rows.map((r) => r.data);
}

/** For LIKE patterns: % _ and \ match themselves. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/** Staff search: order number, customer or receiver phone, or a gift card code used or bought. */
export async function searchOrders(q: string): Promise<Order[]> {
  const term = q.trim();
  // Too short to mean anything (and "%" or "1" would list everything).
  if (term.length < 3) return [];
  const db = await getDb();
  const digits = term.replace(/\D/g, "");
  const upper = term.toUpperCase();
  const numberPart = upper.replace(/^(EP-?)?/, "");
  const conds = [sql`${ord.data}->'giftCard'->>'code' = ${upper}`, sql`${ord.data}->>'issuedCardCode' = ${upper}`];
  if (numberPart.length >= 3) conds.push(sql`${ord.number} ilike ${`%${likeEscape(numberPart)}%`}`);
  if (digits.length >= 4) {
    const phone = `%${likeEscape(digits.slice(-10))}%`;
    conds.push(sql`${ord.phone} like ${phone}`);
    conds.push(sql`${ord.data}->'gift'->>'receiverPhone' like ${phone}`);
  }
  const rows = await db
    .select({ data: ord.data })
    .from(ord)
    .where(or(...conds))
    .orderBy(desc(ord.createdAt))
    .limit(30);
  return rows.map((r) => r.data);
}
