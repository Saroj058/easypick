import "server-only";

import { randomInt } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb, giftCardRow, schema, type Exec } from "./db";
import { hit, isBlocked } from "./rate-limit";

// Digital gift cards, per the Gifting doc: 12-character codes (EP-XXXX-XXXX),
// usable online (and at the kiosk later), leftover balance kept, valid 12 months.
// Money on a card isn't a sale until it's spent; the CA decides how to book it.

export interface GiftCard {
  code: string; // EP-7K4M-2QXD
  value: number;
  balance: number;
  status: "pending_payment" | "active" | "blocked";
  createdAt: string;
  expiresAt: string;
  purchaserPhone: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail?: string | null;
  message: string;
  senderName: string | null;
  /** yyyy-mm-dd to send on, or null for now. */
  sendOn: string | null;
  /** Order that paid for it (null when issued from a sold-out gift). */
  orderId: string | null;
  uses: { orderId: string; amount: number; at: string; refunded?: boolean }[];
}

export const GIFT_CARD_VALUES = [1000, 2000, 3000, 5000];
export const GIFT_CARD_MIN = 500;
export const GIFT_CARD_MAX = 20000;

// No 0/O, 1/I/L: easy to read out loud and type from an SMS.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function newCode() {
  const pick = () => ALPHABET[randomInt(ALPHABET.length)];
  const part = () => Array.from({ length: 4 }, pick).join("");
  return `EP-${part()}-${part()}`;
}

/** "ep 7k4m 2qxd" → "EP-7K4M-2QXD". Returns null if it can't be a code. */
export function normaliseCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^EP/, "");
  if (raw.length !== 8 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return `EP-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export async function issueGiftCard(
  input: Omit<GiftCard, "code" | "balance" | "createdAt" | "expiresAt" | "uses">,
  validDays = 365,
  exec?: Exec,
): Promise<GiftCard> {
  const now = new Date();
  const expires = new Date(now.getTime() + validDays * 86_400_000);
  const db = exec ?? (await getDb());
  for (;;) {
    const card: GiftCard = { ...input, code: newCode(), balance: input.value, createdAt: now.toISOString(), expiresAt: expires.toISOString(), uses: [] };
    // A clash on the code (very unlikely) just tries another one.
    const inserted = await db.insert(schema.giftCards).values(giftCardRow(card)).onConflictDoNothing().returning({ code: schema.giftCards.code });
    if (inserted.length) return card;
  }
}

export async function findGiftCard(code: string): Promise<GiftCard | null> {
  const db = await getDb();
  const [row] = await db.select({ data: schema.giftCards.data }).from(schema.giftCards).where(eq(schema.giftCards.code, code));
  return row?.data ?? null;
}

export async function activateGiftCard(code: string, exec?: Exec) {
  const db = exec ?? (await getDb());
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(schema.giftCards).where(eq(schema.giftCards.code, code)).for("update");
    if (c && c.status === "pending_payment") await tx.update(schema.giftCards).set(giftCardRow({ ...c.data, status: "active" })).where(eq(schema.giftCards.code, code));
  });
}

export type CardCheck = { ok: true; code: string; balance: number; expiresAt: string } | { ok: false; message: string };

// Guard against guessing codes: 8 wrong tries per visitor per 10 minutes (kept in the
// database, so it holds across server instances).
export async function checkGiftCard(input: string, who: string): Promise<CardCheck> {
  const key = `giftcard:${who}`;
  if (await isBlocked(key, 8)) return { ok: false, message: "Too many tries. Wait 10 minutes and try again." };
  const code = normaliseCode(input);
  const card = code ? await findGiftCard(code) : null;
  const fail = async (message: string): Promise<CardCheck> => {
    await hit(key, 10 * 60_000);
    return { ok: false, message };
  };
  if (!card) return fail("We couldn't find that gift card. Check the code and try again.");
  if (card.status === "pending_payment") return fail("This gift card isn't active yet.");
  if (card.status === "blocked") return fail("This gift card has been blocked. Contact us for help.");
  if (Date.parse(card.expiresAt) < Date.now()) return fail("This gift card has expired.");
  if (card.balance <= 0) return fail("This gift card has no balance left.");
  return { ok: true, code: card.code, balance: card.balance, expiresAt: card.expiresAt };
}

/** Takes up to `amount` from the card for an order. Returns what was actually applied. */
export async function spendGiftCard(code: string, amount: number, orderId: string, exec?: Exec): Promise<number> {
  const db = exec ?? (await getDb());
  return db.transaction(async (tx) => {
    // Locked while spending, so two checkouts can't both use the same balance.
    const [row] = await tx.select().from(schema.giftCards).where(eq(schema.giftCards.code, code)).for("update");
    const c = row?.data;
    if (!c || c.status !== "active" || Date.parse(c.expiresAt) < Date.now()) return 0;
    const applied = Math.min(c.balance, amount);
    if (applied <= 0) return 0;
    const next: GiftCard = { ...c, balance: c.balance - applied, uses: [...c.uses, { orderId, amount: applied, at: new Date().toISOString() }] };
    await tx.update(schema.giftCards).set(giftCardRow(next)).where(eq(schema.giftCards.code, code));
    return applied;
  });
}

/** Puts money back on a card: an unpaid order expired, or an order paid by card was refunded. */
export async function creditGiftCard(code: string, amount: number, orderId: string, exec?: Exec) {
  if (amount <= 0) return;
  const db = exec ?? (await getDb());
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.giftCards).where(eq(schema.giftCards.code, code)).for("update");
    if (!row) return;
    const c = row.data;
    const next: GiftCard = {
      ...c,
      balance: c.balance + amount,
      uses: c.uses.map((u) => (u.orderId === orderId && !u.refunded ? { ...u, refunded: true } : u)),
    };
    await tx.update(schema.giftCards).set(giftCardRow(next)).where(eq(schema.giftCards.code, code));
  });
}

/** Staff: stop a card being used (lost, fraud). */
export async function blockGiftCard(code: string) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.giftCards).where(eq(schema.giftCards.code, code)).for("update");
    if (row) await tx.update(schema.giftCards).set(giftCardRow({ ...row.data, status: "blocked" })).where(eq(schema.giftCards.code, code));
  });
}
