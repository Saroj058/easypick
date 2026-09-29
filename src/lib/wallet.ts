import "server-only";

import { eq, sql } from "drizzle-orm";

import { getDb, giftCardRow, schema } from "./db";
import type { GiftCard } from "./gift-cards";

// Gift cards saved to an account ("Add to my account"). The code is checked first (with the
// usual guessing limit); after that the card lives in the person's wallet and its balance is
// offered at checkout without typing the code again.

export interface WalletCard {
  code: string;
  value: number;
  balance: number;
  expiresAt: string;
  status: GiftCard["status"];
  usable: boolean;
}

export async function walletFor(userId: string): Promise<WalletCard[]> {
  const db = await getDb();
  const rows = await db
    .select({ data: schema.giftCards.data })
    .from(schema.giftCards)
    .where(sql`${schema.giftCards.data}->>'ownerUserId' = ${userId}`);
  const now = Date.now();
  return rows
    .map(({ data: c }) => ({ code: c.code, value: c.value, balance: c.balance, expiresAt: c.expiresAt, status: c.status, usable: c.status === "active" && c.balance > 0 && Date.parse(c.expiresAt) > now }))
    .sort((a, b) => Number(b.usable) - Number(a.usable) || Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}

export type ClaimResult = { ok: true; card: WalletCard } | { ok: false; message: string };

/** Saves a (checked, usable) card to this account. A card saved to someone else stays theirs. */
export async function claimCard(code: string, userId: string): Promise<ClaimResult> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.giftCards).where(eq(schema.giftCards.code, code)).for("update");
    if (!row) return { ok: false, message: "That code can't be used. Check it and try again." };
    const c = row.data;
    if (c.ownerUserId && c.ownerUserId !== userId) return { ok: false, message: "That card is already saved to another account." };
    if (!c.ownerUserId) await tx.update(schema.giftCards).set(giftCardRow({ ...c, ownerUserId: userId })).where(eq(schema.giftCards.code, code));
    return { ok: true, card: { code: c.code, value: c.value, balance: c.balance, expiresAt: c.expiresAt, status: c.status, usable: true } };
  });
}
