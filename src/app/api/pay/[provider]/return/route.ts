import { NextResponse, after } from "next/server";

import { alertStaff } from "@/lib/alerts";
import { verifyEsewa, verifyFonepay, verifyKhalti, type VerifyResult } from "@/lib/gateways";
import { findOrder, findOrderByPaymentRef, type Order } from "@/lib/orders";
import type { PayCode } from "@/lib/pay-messages";
import { confirmPayment } from "@/lib/payments";
import type { PaymentProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Where the wallet sends the customer back. The reply is checked with the wallet's own
 * server (signature + status lookup + amount) before the order is marked paid, exactly once.
 * If the wallet can't be reached, the order page says so and reconciliation (/api/cron)
 * picks the payment up later.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/pay/[provider]/return">) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const q = url.searchParams;
  const to = (path: string) => NextResponse.redirect(new URL(path, url));
  const failed = (order: Order | null, code: PayCode) => (order ? to(`/order/${order.id}?pay=failed&why=${code}`) : to(`/?pay=failed`));

  let order: Order | null = null;
  let result: VerifyResult;
  const byRef = async (ref: string) => {
    order = await findOrderByPaymentRef(ref);
    return order?.total ?? null;
  };

  try {
    if (provider === "esewa") {
      // eSewa's failure_url: they cancelled or it didn't go through.
      const failedId = q.get("failed");
      if (failedId) return failed(await findOrder(failedId), "cancelled");
      const data = q.get("data");
      if (!data) return to("/");
      result = await verifyEsewa(data, byRef);
    } else if (provider === "khalti") {
      const pidx = q.get("pidx") ?? "";
      order = await findOrder(q.get("purchase_order_id") ?? "");
      const attempts = order?.payments ?? (order?.payment ? [order.payment] : []);
      if (!order || !pidx || !attempts.some((a) => a.ref === pidx)) return failed(order, "no_order");
      result = await verifyKhalti(pidx);
    } else if (provider === "fonepay") {
      result = await verifyFonepay(q, byRef);
      if (!order && result.ref) order = await findOrderByPaymentRef(result.ref);
    } else {
      return to("/");
    }
  } catch (e) {
    console.error(`[pay:${provider}] check failed`, e);
    return failed(order, "unreachable");
  }

  const o = order as Order | null;
  if (!result.ok) return failed(o, result.code);
  if (!o) return to("/");
  if (Math.abs(result.amount - o.total) > 0.001) {
    const paid = result.amount;
    after(() => alertStaff(`Amount mismatch on ${o.number}`, `${provider} confirmed Rs ${paid} for ${o.number}, but the order total is Rs ${o.total}. The order was NOT marked paid. Check it in the wallet portal and refund or collect the difference.`));
    return failed(o, "amount");
  }

  await confirmPayment(o.id, { provider: provider as PaymentProvider, ref: result.ref, gatewayRef: result.gatewayRef, amount: result.amount });
  return to(`/order/${o.id}`);
}
