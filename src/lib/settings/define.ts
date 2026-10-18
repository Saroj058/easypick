import "server-only";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { getDb, schema } from "../db";

// One admin-editable setting: a JSON value in the `meta` table under its key, cleaned on every read
// and write (so a bad or old value can never break a page), with the code's defaults as fallback.
// The site reads it cached under its tag; the admin reads it fresh. See lib/settings/*.

export interface SettingDef<T> {
  key: string;
  tag: string;
  defaults: T;
  clean: (raw: unknown) => T;
}

export function defineSetting<T>(d: SettingDef<T>) {
  async function read(): Promise<T> {
    const db = await getDb();
    const [row] = await db.select({ v: schema.meta.value }).from(schema.meta).where(eq(schema.meta.key, d.key));
    if (!row) return d.defaults;
    try {
      return d.clean(JSON.parse(row.v));
    } catch {
      return d.defaults;
    }
  }
  return {
    ...d,
    /** For the site: cached until the owner saves. */
    get: unstable_cache(read, [`setting:${d.key}:v1`], { tags: [d.tag, "settings"], revalidate: 3600 }),
    /** For the admin: exactly what's saved, fresh. */
    getForAdmin: read,
    async write(value: unknown): Promise<T> {
      const clean = d.clean(value);
      const db = await getDb();
      const v = JSON.stringify(clean);
      await db.insert(schema.meta).values({ key: d.key, value: v }).onConflictDoUpdate({ target: schema.meta.key, set: { value: v } });
      return clean;
    },
  };
}
