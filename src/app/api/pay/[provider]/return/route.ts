import { NextResponse } from "next/server";

import { verifyEsewa, verifyFonepay, verifyKhalti, type VerifyResult } from "@/lib/gateways";
import { findOrder, findOrderByPaymentRef, updateOrder, type Order } from "@/lib/orders";
import { confirmPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Where eSewa, Khalti and Fonepay send the customer back. The reply is checked with the
 * provider's own server (signature + status lookup + amount) before the order is marked paid.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/pay/[provider]/return">) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const q = url.searchParams;
  const to = (path: string) => NextResponse.redirect(new URL(path, url));
  const failed = (order: Order | null, why: string) =>
    order ? to(`/order/${order.id}?pay=failed&why=${encodeURIComponent(why)}`) : to(`/?pay=failed`);

  let order: Order | null = null;
  let result: VerifyResult;

  if (provider === "esewa") {
    // eSewa's failure_url: they cancelled or it didn't go through.
    const failedId = q.get("failed");
    if (failedId) return failed(await findOrder(failedId), "The eSewa payment was cancelled or didn't go through.");
    const data = q.get("data");
    if (!data) return to("/");
    result = await verifyEsewa(data, async (ref) => {
      order = await findOrderByPaymentRef(ref);
      return order?.total ?? null;
    });
  } else if (provider === "khalti") {
    const pidx = q.get("pidx") ?? "";
    order = await findOrder(q.get("purchase_order_id") ?? "");
    if (!order || !pidx || order.payment?.ref !== pidx) return failed(order, "We couldn't match that Khalti payment to an order.");
    result = await verifyKhalti(pidx);
  } else if (provider === "fonepay") {
    result = await verifyFonepay(q, async (ref) => {
      order = await findOrderByPaymentRef(ref);
      return order?.total ?? null;
    });
    if (!order && result.ref) order = await findOrderByPaymentRef(result.ref);
  } else {
    return to("/");
  }

  const o = order as Order | null;
  if (!result.ok) return failed(o, result.message);
  if (!o) return to("/");
  if (Math.abs(result.amount - o.total) > 0.001) {
    console.error(`[pay:${provider}] amount mismatch for ${o.number}: paid ${result.amount}, due ${o.total}`);
    return failed(o, "The amount paid doesn't match the order. Contact us and we'll sort it out.");
  }

  await updateOrder(o.id, (x) => {
    x.payment = { ...(x.payment ?? { provider: x.provider, ref: result.ref!, startedAt: new Date().toISOString() }), gatewayRef: result.gatewayRef, verifiedAt: new Date().toISOString(), amount: result.amount };
  });
  await confirmPayment(o.id); // safe to call twice
  return to(`/order/${o.id}`);
}
