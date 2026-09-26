import "server-only";

import { eq } from "drizzle-orm";

import { giftCardRow, schema, type Exec } from "./db";
import { formatPrice } from "./format";
import type { GiftCard } from "./gift-cards";

// When the money behind a gift card is refunded (a bought gift card, or a gift the receiver
// turned into a card), the card has to give that money up too, or it's paid out twice.

export type CardReversal = { ok: true; blocked: boolean; left: number } | { ok: false; left: number; message: string };

/**
 * Takes `amount` off the card for a refund on `orderId`. Blocks the card once nothing is left.
 * Refuses (changing nothing) when the holder has already spent too much of it.
 */
export async function reverseCard(exec: Exec, code: string, amount: number, orderId: string): Promise<CardReversal> {
  return exec.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.giftCards).where(eq(schema.giftCards.code, code)).for("update");
    if (!row) return { ok: false, left: 0, message: `Gift card ${code} wasn't found, so it can't be taken back. Check it before refunding.` };
    const c = row.data;
    if (amount <= 0) return { ok: true, blocked: c.status === "blocked", left: c.balance };
    if (amount > c.balance)
      return {
        ok: false,
        left: c.balance,
        message: c.balance > 0
          ? `Gift card ${code} has only ${formatPrice(c.balance)} left (the rest is spent). Refund at most ${formatPrice(c.balance)} of it.`
          : `Gift card ${code} has already been spent, so it can't be refunded.`,
      };
    const left = c.balance - amount;
    const next: GiftCard = {
      ...c,
      balance: left,
      status: left === 0 ? "blocked" : c.status,
      // Shown on the gift cards page as "given back", linked to the refunded order.
      uses: [...c.uses, { orderId, amount, at: new Date().toISOString(), refunded: true }],
    };
    await tx.update(schema.giftCards).set(giftCardRow(next)).where(eq(schema.giftCards.code, code));
    return { ok: true, blocked: next.status === "blocked", left };
  });
}

/** Blocks a card nobody has spent from yet (e.g. a gift's welcome credit when the gift is refunded). */
export async function blockIfUnspent(exec: Exec, code: string): Promise<"blocked" | "spent" | "missing"> {
  return exec.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.giftCards).where(eq(schema.giftCards.code, code)).for("update");
    if (!row) return "missing";
    const c = row.data;
    if (c.status === "blocked") return "blocked";
    const spent = c.uses.some((u) => !u.refunded) || c.balance < c.value;
    if (spent) return "spent";
    await tx.update(schema.giftCards).set(giftCardRow({ ...c, status: "blocked" })).where(eq(schema.giftCards.code, code));
    return "blocked";
  });
}
