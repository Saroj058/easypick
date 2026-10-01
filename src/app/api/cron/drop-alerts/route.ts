import { revalidateTag } from "next/cache";

import { alertStaff } from "@/lib/alerts";
import { sendDueDropAlerts } from "@/lib/drop-alerts";
import { sameSecret } from "@/lib/same-secret";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Once a day in the afternoon (vercel.json crons; 11:00 UTC is 4:45 PM in Kathmandu, and the
 * Hobby plan may run it up to an hour late). On a drop day it sends the one drop message to
 * everyone who asked. Vercel sends "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") return new Response("CRON_SECRET not set", { status: 500 });
  if (secret && !sameSecret(req.headers.get("authorization"), `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });

  try {
    const result = await sendDueDropAlerts();
    if (result.drop) {
      // The drop opens within hours: make sure cached pages pick up its release on time.
      revalidateTag("catalogue", "max");
      if (result.failed || result.waiting) {
        await alertStaff(
          "Drop alerts: some messages didn't go out",
          `Drop ${result.drop}: ${result.sent} sent, ${result.failed} failed, ${result.waiting} waiting.` +
            (result.whatsappReady ? "" : "\n\nWhatsApp sign-ups are waiting: set WHATSAPP_DROP_TEMPLATE once Meta approves the drop template."),
        ).catch(() => {});
      }
    }
    return Response.json({ ok: true, ...result });
  } catch (e) {
    console.error("[cron] drop alerts failed", e);
    await alertStaff("Drop alerts failed", e instanceof Error ? e.message : String(e)).catch(() => {});
    return Response.json({ ok: false }, { status: 500 });
  }
}
