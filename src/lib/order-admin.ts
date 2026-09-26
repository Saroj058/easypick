import "server-only";

import { blockIfUnspent, reverseCard } from "./card-reversal";
import { findProduct, moveStock } from "./catalogue";
import { formatPrice } from "./format";
import { creditGiftCard } from "./gift-cards";
import { event, findOrder, lockOrder, refundedQty, type Order } from "./orders";

// Staff changes to a paid order that move money or stock: refunds and exchanges.
// The server actions check who is asking; these do the work in one transaction.

/** The card whose value is this order's goods: a bought gift card, or a gift turned into a card. */
export function cardBehindOrder(o: Order): string | null {
  if (o.kind === "gift_card") return o.issuedCardCode ?? null;
  if (o.gift?.status === "converted") return o.gift.convertedCardCode ?? null;
  return null;
}

/** True when the order's pieces are real stock this shop can put back on the rack. */
export const piecesOnHold = (o: Order) => Boolean(o.stockHeld) && o.kind !== "gift_card" && o.gift?.status !== "converted";

export interface RefundInput {
  /** Line index → how many to refund (capped at what's left). */
  qty: Record<number, number>;
  restock: boolean;
  includeDelivery: boolean;
  includeWrap: boolean;
  walletRef: string;
  note: string;
}

export type RefundResult =
  | { ok: false; message: string }
  | {
      ok: true;
      message: string;
      number: string;
      amount: number;
      toGiftCard: number;
      toWallet: number;
      delivery: number;
      wrap: number;
      lines: { sku: string; qty: number }[];
      restocked: boolean;
      cancelled: boolean;
      card?: { code: string; taken: number; blocked: boolean };
      welcome?: { code: string; outcome: string };
    };

/**
 * Cancel or refund some or all of a paid order. Puts pieces back in stock only when the order
 * really holds them, returns gift-card money to the card first, takes back a gift card this
 * order bought (or a gift turned into one), and refunds delivery and the gift box once each.
 */
export async function refundOrderAs(id: string, by: string, input: RefundInput): Promise<RefundResult | null> {
  return lockOrder(id, async (o, tx): Promise<{ save: boolean; result: RefundResult }> => {
    const no = (message: string) => ({ save: false, result: { ok: false as const, message } });
    if (!o.paidAt) return no("This order was never paid, so there's nothing to refund.");

    const done = refundedQty(o);
    const picked = o.lines
      .map((l, i) => ({ i, qty: Math.min(Math.max(0, Math.round(input.qty[i] || 0)), l.qty - done[i]) }))
      .filter((x) => x.qty > 0);
    const delivery = input.includeDelivery && !o.deliveryRefunded ? o.deliveryFee : 0;
    const wrap = input.includeWrap && !o.wrapRefunded ? (o.wrapFee ?? 0) : 0;
    if (!picked.length && !delivery && !wrap) return no("Choose what to refund.");

    const goods = picked.reduce((n, x) => n + o.lines[x.i].unitPrice * x.qty, 0);
    const value = goods + delivery + wrap;
    // Gift card part first (up to what the card paid and hasn't had back), the rest to the wallet.
    const cardPaid = o.giftCard?.applied ?? 0;
    const cardBack = (o.refunds ?? []).reduce((n, r) => n + r.toGiftCard, 0);
    const toGiftCard = Math.min(value, Math.max(0, cardPaid - cardBack));
    const toWallet = value - toGiftCard;
    if (toWallet > 0 && !input.walletRef) return no(`Refund ${formatPrice(toWallet)} in the eSewa merchant portal first, then enter its reference here.`);

    // Refunding a gift card (bought, or a gift turned into one) takes its money off the card.
    // Done first: when too much is spent nothing has changed yet.
    const code = cardBehindOrder(o);
    let card: { code: string; taken: number; blocked: boolean } | undefined;
    if (goods > 0 && (o.kind === "gift_card" || o.gift?.status === "converted")) {
      if (!code) return no("This order's gift card code is missing. Block the card by hand before refunding.");
      const rev = await reverseCard(tx, code, goods, o.id);
      if (!rev.ok) return no(rev.message);
      card = { code, taken: goods, blocked: rev.blocked };
    }

    const restocked = input.restock && picked.length > 0 && piecesOnHold(o);
    if (restocked) {
      await moveStock(
        tx,
        picked.map((x) => ({ sku: o.lines[x.i].sku, delta: x.qty })),
        { reason: "refund_restock", source: "admin", ref: o.number, actor: by },
      );
    }
    if (toGiftCard > 0 && o.giftCard) await creditGiftCard(o.giftCard.code, toGiftCard, o.id, tx);

    const lines = picked.map((x) => ({ sku: o.lines[x.i].sku, qty: x.qty }));
    o.refunds = [
      ...(o.refunds ?? []),
      { at: new Date().toISOString(), by, amount: value, toGiftCard, walletRef: input.walletRef || undefined, note: input.note || undefined, skus: lines.map((l) => l.sku), lines: picked },
    ];
    if (delivery) o.deliveryRefunded = true;
    if (wrap) o.wrapRefunded = true;
    const allBack = o.lines.every((l, i) => done[i] + (picked.find((x) => x.i === i)?.qty ?? 0) >= l.qty);
    let welcome: { code: string; outcome: string } | undefined;
    if (allBack) {
      o.status = "cancelled";
      o.stockHeld = false;
      // The receiver's welcome credit came with the gift; it goes with it unless already used.
      if (o.gift?.welcomeCode) welcome = { code: o.gift.welcomeCode, outcome: await blockIfUnspent(tx, o.gift.welcomeCode) };
    }
    o.attention = null;
    const notes = [
      toGiftCard ? `${formatPrice(toGiftCard)} to gift card` : "",
      input.walletRef ? `wallet ref ${input.walletRef}` : "",
      delivery ? "incl. delivery" : "",
      wrap ? "incl. gift box" : "",
      restocked ? "back in stock" : "",
      card ? `${formatPrice(card.taken)} taken off gift card ${card.code}${card.blocked ? " (blocked)" : ""}` : "",
      welcome ? (welcome.outcome === "spent" ? `welcome credit ${welcome.code} already used` : `welcome credit ${welcome.code} blocked`) : "",
    ].filter(Boolean);
    o.events = [...(o.events ?? []), event(by, `${allBack ? "Cancelled and refunded" : "Refunded"} ${formatPrice(value)}${notes.length ? `, ${notes.join(", ")}` : ""}`)];
    return {
      save: true,
      result: { ok: true, message: `Refunded ${formatPrice(value)}.`, number: o.number, amount: value, toGiftCard, toWallet, delivery, wrap, lines, restocked, cancelled: allBack, card, welcome },
    };
  });
}

export type ExchangeResult =
  | { ok: false; message: string }
  | { ok: true; message: string; number: string; name: string; fromSku: string; toSku: string; override: boolean; reheld: boolean };

const LIVE = ["paid", "ready_for_pickup", "out_for_delivery", "completed"];

/**
 * Swap ONE piece of a line for another size or colour of the same product (within 7 days,
 * 14 for gifts; only an owner can allow it later). A line of 2 becomes 1 of the old + 1 of the new.
 */
export async function exchangeOnePiece(
  id: string,
  who: { username: string; owner: boolean },
  input: { line: number; newSku: string; override: boolean },
): Promise<ExchangeResult | null> {
  // Read the product before locking the order: no second connection inside the transaction.
  const before = await findOrder(id);
  if (!before) return null;
  const slug = before.lines[input.line]?.slug;
  const product = slug ? await findProduct(slug) : null;

  return lockOrder(id, async (o, tx): Promise<{ save: boolean; result: ExchangeResult }> => {
    const no = (message: string) => ({ save: false, result: { ok: false as const, message } });
    const i = input.line;
    const line = o.lines[i];
    if (!line || o.kind === "gift_card" || o.gift?.status === "converted") return no("Choose a piece to exchange.");
    if (!LIVE.includes(o.status) || !o.paidAt) return no("Only paid orders can be exchanged.");
    if (o.gift?.mode === "pick" && (o.gift.status === "sent" || o.gift.status === "opened")) return no("The receiver hasn't picked their size yet.");
    const done = refundedQty(o);
    if (done[i] >= line.qty) return no("That piece has been refunded.");

    const days = o.gift ? 14 : 7;
    const since = Date.parse(o.completedAt ?? o.paidAt);
    const late = Date.now() - since > days * 86_400_000;
    if (late && !who.owner) return no(`It's past the ${days}-day exchange window. Only the owner can allow it.`);
    if (late && !input.override) return no(`It's past the ${days}-day exchange window. Tick "Allow anyway" if you agree to it.`);

    const target = product?.slug === line.slug ? product.variants.find((v) => v.sku === input.newSku) : undefined;
    if (!target || target.sku === line.sku) return no("Pick a different size or colour.");

    // One piece changes; the rest of the line stays as it was.
    const swapped = { ...line, sku: target.sku, size: target.size, colour: target.colour, qty: 1 };
    const lines = line.qty > 1 ? o.lines.map((l, j) => (j === i ? { ...l, qty: l.qty - 1 } : l)).concat(swapped) : o.lines.map((l, j) => (j === i ? swapped : l));

    const meta = { source: "admin" as const, ref: o.number, actor: who.username };
    const wasHeld = Boolean(o.stockHeld);
    if (wasHeld) {
      // Two reasons, so two calls, always in SKU order so two exchanges can't deadlock each other.
      const moves = [
        { sku: target.sku, delta: -1, reason: "exchange_out" as const },
        { sku: line.sku, delta: 1, reason: "exchange_in" as const },
      ].sort((a, b) => a.sku.localeCompare(b.sku));
      for (const m of moves) await moveStock(tx, [{ sku: m.sku, delta: m.delta }], { ...meta, reason: m.reason });
    } else {
      // The order isn't holding its pieces (e.g. paid after its hold ended and a size sold out):
      // putting the old piece "back" would invent stock. Take the new piece and hold the rest now.
      const need = new Map<string, number>();
      lines.forEach((l, j) => need.set(l.sku, (need.get(l.sku) ?? 0) + l.qty - (j < done.length ? done[j] : 0)));
      const moves = [...need].filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b)).map(([sku, n]) => ({ sku, delta: -n }));
      await moveStock(tx, moves, { ...meta, reason: "order_hold" });
      o.stockHeld = true;
    }
    o.lines = lines;
    const override = late && input.override;
    o.events = [
      ...(o.events ?? []),
      event(who.username, `Exchanged 1 ${line.name}: ${line.colour} ${line.size} → ${target.colour} ${target.size}${override ? ` (past the ${days}-day window, allowed by the owner)` : ""}`),
    ];
    return {
      save: true,
      result: { ok: true, message: `Exchanged for ${target.colour} ${target.size}.`, number: o.number, name: line.name, fromSku: line.sku, toSku: target.sku, override, reheld: !wasHeld },
    };
  });
}
