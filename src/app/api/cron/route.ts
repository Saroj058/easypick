import { revalidateTag } from "next/cache";

import { alertStaff } from "@/lib/alerts";
import { catalogueNeedsRefresh, claimCronAlert, markCronRun } from "@/lib/cron-state";
import { sendDueGiftCards } from "@/lib/gift-card-delivery";
import { cleanup, reconcileRecent } from "@/lib/reconcile";
import { sameSecret } from "@/lib/same-secret";

export const dynamic = "force-dynamic";
/** Wallet checks are spaced out and time-boxed (reconcileRecent stops at ~40s); this is the hard limit. */
export const maxDuration = 60;

/**
 * Every few minutes (vercel.json crons): catch payments whose customers never came back,
 * release expired holds, and tidy old data. Vercel sends "Authorization: Bearer $CRON_SECRET".
 * Anything that goes wrong is emailed to staff, since nobody watches the logs.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") return new Response("CRON_SECRET not set", { status: 500 });
  if (secret && !sameSecret(req.headers.get("authorization"), `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });

  const runAt = new Date().toISOString();
  const problems: string[] = [];
  const step = async <T,>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      console.error(`[cron] ${name} failed`, e);
      problems.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };

  const reconciled = await step("reconcile", () => reconcileRecent());
  if (reconciled?.errors.length) problems.push(...reconciled.errors.map((e) => `reconcile ${e}`));
  const tidied = await step("cleanup", () => cleanup());
  // Gift cards bought with a later "send on" date go out on that day.
  const giftCards = await step("gift cards", () => sendDueGiftCards());
  // Refresh the shop only when stock moved (expiry, late payment, a sale…) or a drop went live since the last run.
  const refresh = await step("catalogue check", () => catalogueNeedsRefresh());
  if (refresh !== false) revalidateTag("catalogue", "max");
  await step("save run time", () => markCronRun(runAt));

  if (problems.length && (await claimCronAlert().catch(() => true))) {
    await alertStaff("Background job had problems", `The every-5-minutes job (payments check, releasing holds, tidying) hit errors at ${runAt}:\n\n${problems.join("\n")}`).catch(() => {});
  }
  return Response.json({ ok: problems.length === 0, reconciled, tidied, giftCards, refreshed: refresh !== false, problems, at: runAt }, { status: problems.length ? 500 : 200 });
}
