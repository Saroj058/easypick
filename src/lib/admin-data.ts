import "server-only";

import { desc, eq, ilike, or, sql } from "drizzle-orm";

import { getDb, schema } from "./db";
import type { GiftCard } from "./gift-cards";

// Read-only lists for the admin screens (activity log, gift cards).

export async function staffActivity(limit = 100, who?: string) {
  const db = await getDb();
  return db
    .select()
    .from(schema.staffEvents)
    .where(who ? eq(schema.staffEvents.staffName, who) : undefined)
    .orderBy(desc(schema.staffEvents.at))
    .limit(limit);
}

/** Gift cards by code, or buyer / receiver phone; newest first when there's no search. */
export async function giftCardList(q: string, limit = 40): Promise<GiftCard[]> {
  const db = await getDb();
  const term = q.trim();
  const digits = term.replace(/\D/g, "");
  const where = term
    ? or(
        ilike(schema.giftCards.code, `%${term.toUpperCase().replace(/[^A-Z0-9-]/g, "")}%`),
        digits.length >= 6 ? sql`${schema.giftCards.data}->>'purchaserPhone' like ${`%${digits.slice(-10)}%`}` : undefined,
        digits.length >= 6 ? sql`${schema.giftCards.data}->>'recipientPhone' like ${`%${digits.slice(-10)}%`}` : undefined,
      )
    : undefined;
  const rows = await db
    .select({ data: schema.giftCards.data })
    .from(schema.giftCards)
    .where(where)
    .orderBy(desc(sql`${schema.giftCards.data}->>'createdAt'`))
    .limit(limit);
  return rows.map((r) => r.data);
}
