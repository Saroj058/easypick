import { desc, eq, sql } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { currentStaff } from "@/lib/staff";

/** For the admin's new-order watcher: the latest paid order and what's waiting. Small and uncached. */
export async function GET() {
  if (!(await currentStaff())) return Response.json({ error: "signed out" }, { status: 401 });
  const db = await getDb();
  const [latest] = await db
    .select({ number: schema.orders.number, paidAt: sql<string | null>`${schema.orders.data}->>'paidAt'` })
    .from(schema.orders)
    .where(sql`${schema.orders.data} ? 'paidAt'`)
    .orderBy(desc(sql`${schema.orders.data}->>'paidAt'`))
    .limit(1);
  const [{ toPack, attention }] = await db
    .select({
      toPack: sql<number>`count(*) filter (where ${schema.orders.data}->>'packedAt' is null and coalesce(${schema.orders.data}->>'kind','goods') = 'goods' and coalesce(${schema.orders.data}->'gift'->>'status','chosen') not in ('sent','opened','converted'))::int`,
      attention: sql<number>`count(*) filter (where coalesce(${schema.orders.data}->>'attention','') <> '')::int`,
    })
    .from(schema.orders)
    .where(eq(schema.orders.status, "paid"));
  return Response.json({ latest: latest ?? null, toPack, attention }, { headers: { "Cache-Control": "no-store" } });
}
