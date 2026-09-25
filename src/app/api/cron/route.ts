import { cleanup, reconcileRecent } from "@/lib/reconcile";

export const dynamic = "force-dynamic";

/**
 * Every few minutes (vercel.json crons): catch payments whose customers never came back,
 * release expired holds, and tidy old data. Vercel sends "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") return new Response("CRON_SECRET not set", { status: 500 });
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const reconciled = await reconcileRecent();
  const tidied = await cleanup();
  return Response.json({ ok: true, reconciled, tidied, at: new Date().toISOString() });
}
