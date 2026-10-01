import "server-only";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { getDb, schema } from "./db";
import type { SavedLooks } from "./occasions";

// The owner's "Designer Fits" looks, set in /admin/looks and kept as one JSON value in the meta table.
// An occasion left empty is picked automatically from the rack.

const KEY = "looks";
export const LOOKS_TAG = "looks";

export async function readSavedLooks(): Promise<SavedLooks> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.meta.value }).from(schema.meta).where(eq(schema.meta.key, KEY));
  if (!row) return {};
  try {
    return JSON.parse(row.value) as SavedLooks;
  } catch {
    return {};
  }
}

export const getSavedLooks = unstable_cache(readSavedLooks, ["looks-v1"], { tags: [LOOKS_TAG], revalidate: 3600 });

export async function saveLooks(looks: SavedLooks) {
  const db = await getDb();
  const value = JSON.stringify(looks);
  await db.insert(schema.meta).values({ key: KEY, value }).onConflictDoUpdate({ target: schema.meta.key, set: { value } });
}
