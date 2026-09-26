import "server-only";

import { desc, eq } from "drizzle-orm";

import { getDb, schema } from "./db";

/**
 * The admin activity log, newest first; for one staff member when `staffId` is given.
 * Filtered by account id, not name: a renamed (or look-alike) account can't mix entries.
 */
export async function activityFor(limit = 200, staffId?: string) {
  const db = await getDb();
  return db
    .select()
    .from(schema.staffEvents)
    .where(staffId ? eq(schema.staffEvents.staffId, staffId) : undefined)
    .orderBy(desc(schema.staffEvents.at), desc(schema.staffEvents.id))
    .limit(limit);
}
