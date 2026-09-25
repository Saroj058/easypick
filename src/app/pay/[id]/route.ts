import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { gatewayReady, startPayment } from "@/lib/gateways";
import { findOrder, updateOrder } from "@/lib/orders";
import { site } from "@/lib/site";
import type { PaymentProvider } from "@/lib/types";

const PROVIDERS: PaymentProvider[] = site.payments.enabled;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Sends the customer to pay for an order with a wallet from site.payments.enabled: eSewa (a form it
 * needs POSTed), or Khalti / Fonepay when switched on. ?via= switches wallet. Paid orders go to their page.
 */
export async function GET(req: Request, ctx: RouteContext<"/pay/[id]">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const back = (q = "") => NextResponse.redirect(new URL(`/order/${id}${q}`, url));

  let order = await findOrder(id);
  if (!order) return NextResponse.redirect(new URL("/", url));
  if (order.status !== "awaiting_payment") return back();

  const via = url.searchParams.get("via") as PaymentProvider | null;
  if (via && PROVIDERS.includes(via) && via !== order.provider) {
    order = (await updateOrder(id, (o) => {
      o.provider = via;
    }))!;
  }
  if (!gatewayReady(order.provider)) return back(`?pay=failed&why=unavailable`);

  const user = await getCurrentUser();
  const start = await startPayment(order, { name: user?.name ?? null, email: user?.email ?? null });
  if (start.kind === "error") return back(`?pay=failed&why=${start.code}`);

  // Every attempt is kept: paying in an older tab still matches the order.
  await updateOrder(id, (o) => {
    const attempt = { provider: o.provider, ref: start.ref, startedAt: new Date().toISOString() };
    o.payments = [...(o.payments ?? (o.payment ? [o.payment] : [])), attempt].slice(-10);
    o.payment = attempt;
  });

  if (start.kind === "redirect") return NextResponse.redirect(start.url);

  // eSewa: a page that posts the signed form straight away (with a button if scripts are off).
  const inputs = Object.entries(start.fields)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Going to eSewa…</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;font:16px system-ui,sans-serif;background:#fff;color:#0a0a0a}button{font:600 15px system-ui;padding:14px 22px;border:0;border-radius:2px;background:#60bb46;color:#fff;cursor:pointer}</style></head>
<body><form id="f" method="POST" action="${esc(start.action)}">${inputs}<p>Taking you to eSewa…</p><noscript><button type="submit">Continue to eSewa</button></noscript></form>
<script>document.getElementById("f").submit()</script></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
