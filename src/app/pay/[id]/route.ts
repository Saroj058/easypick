import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { gatewayReady, paymentMode, startPayment, type StartResult } from "@/lib/gateways";
import { findOrder, lockOrder, updateOrder } from "@/lib/orders";
import type { PayCode } from "@/lib/pay-messages";
import { site } from "@/lib/site";
import type { PaymentProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

const PROVIDERS: PaymentProvider[] = site.payments.enabled;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Every attempt is kept (a reply for any of them must still find the order), so there's a cap instead. */
const MAX_ATTEMPTS = 10;
/** Less than this left on the hold: not enough time to pay. */
const MIN_LEFT_MS = 2 * 60_000;
/** Starting to pay with less than this left gives the hold one extension, to this much. */
const EXTEND_TO_MS = 10 * 60_000;

/**
 * Sends the customer to pay for an order with a wallet from site.payments.enabled: eSewa (a form it
 * needs POSTed), or Khalti / Fonepay when switched on. ?via= switches wallet. Paid orders go to their page.
 */
export async function GET(req: Request, ctx: RouteContext<"/pay/[id]">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const back = (q = "") => NextResponse.redirect(new URL(`/order/${id}${q}`, url));
  const failed = (code: PayCode) => back(`?pay=failed&why=${code}`);

  let order = await findOrder(id);
  if (!order) return NextResponse.redirect(new URL("/", url));
  if (order.status !== "awaiting_payment") return back();

  const via = url.searchParams.get("via") as PaymentProvider | null;
  if (via && PROVIDERS.includes(via) && via !== order.provider) {
    order = (await updateOrder(id, (o) => {
      o.provider = via;
    }))!;
    if (order.status !== "awaiting_payment") return back();
  }
  if (!gatewayReady(order.provider)) return failed("unavailable");

  // Room for another attempt, and time to finish it: a payment started with seconds left would
  // land after the pieces went back. The hold is stretched once; after that, too late is too late.
  const check = await lockOrder(id, async (o) => {
    if (o.status !== "awaiting_payment") return { save: false, result: "gone" as const };
    const attempts = o.payments ?? (o.payment ? [o.payment] : []);
    if (attempts.length >= MAX_ATTEMPTS) return { save: false, result: "too_many" as const };
    const left = Date.parse(o.expiresAt) - Date.now();
    if (left >= EXTEND_TO_MS) return { save: false, result: "ok" as const };
    if (!attempts.some((a) => a.extendedHold)) {
      o.expiresAt = new Date(Date.now() + EXTEND_TO_MS).toISOString();
      return { save: true, result: "extend" as const };
    }
    return { save: false, result: left < MIN_LEFT_MS ? ("time_up" as const) : ("ok" as const) };
  });
  if (!check || check === "gone") return back();
  if (check === "too_many" || check === "time_up") return failed(check);

  let start: StartResult;
  try {
    const user = await getCurrentUser();
    start = await startPayment(order, { name: user?.name ?? null, email: user?.email ?? null });
  } catch (e) {
    console.error("[pay] start failed", order.number, e);
    return failed("start_failed");
  }
  if (start.kind === "error") return failed(start.code);

  // Every attempt is kept: paying in an older tab still matches the order.
  const recorded = await lockOrder(id, async (o) => {
    if (o.status !== "awaiting_payment") return { save: false, result: false };
    const attempt = { provider: o.provider, ref: start.ref, startedAt: new Date().toISOString(), mode: paymentMode(), ...(check === "extend" ? { extendedHold: true } : {}) };
    o.payments = [...(o.payments ?? (o.payment ? [o.payment] : [])), attempt];
    o.payment = attempt;
    return { save: true, result: true };
  });
  if (!recorded) return back();

  if (start.kind === "redirect") return NextResponse.redirect(start.url);

  // eSewa: a page that posts the signed form straight away (with a button if scripts are off).
  // Coming Back from eSewa must not post it again (a loop): it goes to the order page instead.
  const orderPath = JSON.stringify(`/order/${id}`).replace(/</g, "\\u003c");
  const inputs = Object.entries(start.fields)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Going to eSewa…</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;font:16px system-ui,sans-serif;background:#fff;color:#0a0a0a}button{font:600 15px system-ui;padding:14px 22px;border:0;border-radius:2px;background:#2e7d32;color:#fff;cursor:pointer}</style></head>
<body><form id="f" method="POST" action="${esc(start.action)}">${inputs}<p>Taking you to eSewa…</p><noscript><button type="submit">Continue to eSewa</button></noscript></form>
<script>(function(){var o=${orderPath};var n=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];if(n&&n.type==="back_forward"){location.replace(o);return}addEventListener("pageshow",function(e){if(e.persisted)location.replace(o)});document.getElementById("f").submit()})()</script></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
