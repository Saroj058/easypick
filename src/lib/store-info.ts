import "server-only";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { getDb, schema } from "./db";
import { withDefaults, type StoreInfo } from "./store-state";

// The store's details, set in /admin/store and kept as one JSON value in the meta table.

const KEY = "store_info";
export const STORE_TAG = "store-info";

async function readSaved(): Promise<Partial<StoreInfo> | null> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.meta.value }).from(schema.meta).where(eq(schema.meta.key, KEY));
  if (!row) return null;
  try {
    return JSON.parse(row.value) as Partial<StoreInfo>;
  } catch {
    return null;
  }
}

const cachedSaved = unstable_cache(readSaved, ["store-info-v1"], { tags: [STORE_TAG], revalidate: 3600 });

/** The details for the public site. `preview` fills in the sample address and route and shows it open. */
export async function getStoreInfo(opts: { preview?: boolean } = {}): Promise<StoreInfo> {
  return withDefaults(await cachedSaved(), opts.preview);
}

/** For the admin form: exactly what's saved (no samples), uncached. */
export async function getStoreInfoForAdmin(): Promise<StoreInfo> {
  return withDefaults(await readSaved());
}

export async function saveStoreInfo(info: StoreInfo) {
  const db = await getDb();
  const value = JSON.stringify(info);
  await db.insert(schema.meta).values({ key: KEY, value }).onConflictDoUpdate({ target: schema.meta.key, set: { value } });
}
