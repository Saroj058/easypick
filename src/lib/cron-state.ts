import "server-only";

import { and, eq, gt, lte, sql } from "drizzle-orm";

import { getDb, schema } from "./db";

// What /api/cron remembers between runs, in the meta table.

const LAST_RUN = "cron_last_run";
const LAST_ALERT = "cron_last_alert";

async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ value: schema.meta.value }).from(schema.meta).where(eq(schema.meta.key, key));
  return row?.value ?? null;
}

async function setMeta(key: string, value: string) {
  const db = await getDb();
  await db.insert(schema.meta).values({ key, value }).onConflictDoUpdate({ target: schema.meta.key, set: { value } });
}

/**
 * True when the shop pages may show stale stock: a stock movement (order hold or release,
 * late payment, staff change) or a drop going live since the last run.
 */
export async function catalogueNeedsRefresh(): Promise<boolean> {
  const last = await getMeta(LAST_RUN);
  if (!last) return true;
  const db = await getDb();
  const [moved] = await db.select({ id: schema.stockMovements.id }).from(schema.stockMovements).where(gt(schema.stockMovements.at, last)).limit(1);
  if (moved) return true;
  const [released] = await db
    .select({ slug: schema.drops.slug })
    .from(schema.drops)
    .where(and(gt(schema.drops.releaseAt, last), lte(schema.drops.releaseAt, sql`now()`)))
    .limit(1);
  return Boolean(released);
}

/** Remembers when this run started (anything after it is picked up next time). */
export const markCronRun = (at: string) => setMeta(LAST_RUN, at);

/** At most one "background job had problems" email an hour, however often it fails. */
export async function claimCronAlert(everyMs = 3600_000): Promise<boolean> {
  const last = await getMeta(LAST_ALERT);
  if (last && Date.now() - Date.parse(last) < everyMs) return false;
  await setMeta(LAST_ALERT, new Date().toISOString());
  return true;
}
