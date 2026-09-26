import { latestPaid, staffQueueCounts } from "@/lib/orders";
import { currentStaff } from "@/lib/staff";

/** For the admin's new-order watcher: the latest paid order and what's waiting. Small and uncached. */
export async function GET() {
  if (!(await currentStaff())) return Response.json({ error: "signed out" }, { status: 401 });
  const [latest, { toPack, attention }] = await Promise.all([latestPaid(), staffQueueCounts()]);
  return Response.json({ latest, toPack, attention }, { headers: { "Cache-Control": "no-store" } });
}
