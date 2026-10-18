import "server-only";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { getDb, schema } from "./db";
import { cleanOffers, DEFAULT_OFFERS, type Offer } from "./offer-rules";

// The festival offers, set in /admin/festivals and kept as one JSON value in the meta table.

const KEY = "offers";
export const OFFERS_TAG = "offers";

async function readOffers(): Promise<Offer[]> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.meta.value }).from(schema.meta).where(eq(schema.meta.key, KEY));
  if (!row) return DEFAULT_OFFERS;
  try {
    return cleanOffers(JSON.parse(row.value));
  } catch {
    return DEFAULT_OFFERS;
  }
}

/** For the site: cached until the owner saves. */
export const getOffers = unstable_cache(readOffers, ["offers-v1"], { tags: [OFFERS_TAG], revalidate: 3600 });

/** For the admin: exactly what's saved, uncached. */
export const getOffersForAdmin = readOffers;

export async function saveOffers(list: Offer[]) {
  const db = await getDb();
  const value = JSON.stringify(list);
  await db.insert(schema.meta).values({ key: KEY, value }).onConflictDoUpdate({ target: schema.meta.key, set: { value } });
}
