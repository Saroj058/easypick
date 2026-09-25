import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { Order } from "./orders";
import { site } from "./site";
import type { PayCode } from "./pay-messages";
import type { PaymentProvider } from "./types";

// eSewa, Khalti and Fonepay. Each one:
//   start()  → where to send the customer to pay (a redirect, or a form eSewa needs POSTed)
//   verify() → asks the provider's server whether that payment really completed, and for
//              how much. Only a verified payment marks an order paid; the customer's browser
//              coming back from the payment page proves nothing on its own.
//
// PAYMENTS_MODE=test (the default) uses each provider's sandbox and their public test
// merchant where one exists. PAYMENTS_MODE=live uses production and needs real keys.

export const paymentsLive = () => process.env.PAYMENTS_MODE === "live";
/**
 * Sandbox wallets on the live site would let anyone "pay" with a public test account.
 * In production they're refused unless PAYMENTS_MODE=test is set on purpose (a staging site).
 */
const testAllowed = () => process.env.NODE_ENV !== "production" || process.env.PAYMENTS_MODE === "test";

const env = (k: string) => process.env[k]?.trim() || undefined;

function esewa() {
  const live = paymentsLive();
  if (!live && !testAllowed()) return null;
  const code = env("ESEWA_PRODUCT_CODE") ?? (live ? undefined : "EPAYTEST");
  const secret = env("ESEWA_SECRET_KEY") ?? (live ? undefined : "8gBm/:&EnhH.1/q"); // eSewa's published test key
  return code && secret
    ? {
        code,
        secret,
        form: live ? "https://epay.esewa.com.np/api/epay/main/v2/form" : "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
        status: live ? "https://esewa.com.np/api/epay/transaction/status/" : "https://rc.esewa.com.np/api/epay/transaction/status/",
      }
    : null;
}

function khalti() {
  if (!paymentsLive() && !testAllowed()) return null;
  const key = env("KHALTI_SECRET_KEY"); // no public test key: from test-admin.khalti.com
  return key ? { key, base: paymentsLive() ? "https://khalti.com/api/v2" : "https://dev.khalti.com/api/v2" } : null;
}

function fonepay() {
  const live = paymentsLive();
  if (!live && !testAllowed()) return null;
  const pid = env("FONEPAY_MERCHANT_CODE") ?? (live ? undefined : "fonepay123"); // Fonepay's dev merchant
  const secret = env("FONEPAY_SECRET_KEY") ?? (live ? undefined : "fonepay");
  return pid && secret ? { pid, secret, base: live ? "https://clientapi.fonepay.com/api/merchantRequest" : "https://dev-clientapi.fonepay.com/api/merchantRequest" } : null;
}

export function gatewayReady(p: PaymentProvider) {
  if (!site.payments.enabled.includes(p)) return false;
  return Boolean(p === "esewa" ? esewa() : p === "khalti" ? khalti() : fonepay());
}

const returnUrl = (p: PaymentProvider) => `${site.url}/api/pay/${p}/return`;
/** A fresh reference per attempt (providers refuse a reused one): EP-123456-k3x9q2. */
const attemptRef = (o: Order) => `${o.number}-${randomBytes(4).toString("hex")}`;
const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const money = (v: unknown) => Number(String(v ?? "").replace(/,/g, ""));

export type StartResult =
  | { kind: "redirect"; url: string; ref: string }
  | { kind: "form"; action: string; fields: Record<string, string>; ref: string }
  | { kind: "error"; code: PayCode };

export async function startPayment(order: Order, customer: { name: string | null; email: string | null }): Promise<StartResult> {
  const total = String(order.total);

  if (order.provider === "esewa") {
    const c = esewa();
    if (!c) return { kind: "error", code: "start_failed" };
    const ref = attemptRef(order);
    const signature = createHmac("sha256", c.secret).update(`total_amount=${total},transaction_uuid=${ref},product_code=${c.code}`).digest("base64");
    return {
      kind: "form",
      action: c.form,
      ref,
      fields: {
        amount: total,
        tax_amount: "0", // prices include VAT
        total_amount: total,
        transaction_uuid: ref,
        product_code: c.code,
        product_service_charge: "0",
        product_delivery_charge: "0",
        success_url: returnUrl("esewa"),
        failure_url: `${returnUrl("esewa")}?failed=${encodeURIComponent(order.id)}`,
        signed_field_names: "total_amount,transaction_uuid,product_code",
        signature,
      },
    };
  }

  if (order.provider === "khalti") {
    const c = khalti();
    if (!c) return { kind: "error", code: "start_failed" };
    if (order.total < 10) return { kind: "error", code: "start_failed" };
    const res = await fetch(`${c.base}/epayment/initiate/`, { signal: AbortSignal.timeout(10_000),
      method: "POST",
      headers: { Authorization: `Key ${c.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        return_url: returnUrl("khalti"),
        website_url: site.url,
        amount: order.total * 100, // paisa
        purchase_order_id: order.id,
        purchase_order_name: `Easypick ${order.number}`,
        customer_info: { name: customer.name ?? "Easypick customer", email: customer.email ?? undefined, phone: order.phone },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { pidx?: string; payment_url?: string; detail?: string };
    if (!res.ok || !body.pidx || !body.payment_url) {
      console.error("[pay:khalti] initiate failed", res.status, JSON.stringify(body).slice(0, 300));
      return { kind: "error", code: "start_failed" };
    }
    return { kind: "redirect", url: body.payment_url, ref: body.pidx };
  }

  const c = fonepay();
  if (!c) return { kind: "error", code: "start_failed" };
  const ref = attemptRef(order);
  // MM/DD/YYYY on the Kathmandu calendar (the server's clock is UTC).
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date()).split("-");
  const dt = `${m}/${d}/${y}`;
  const p = { PID: c.pid, MD: "P", PRN: ref, AMT: total, CRN: "NPR", DT: dt, R1: `Easypick ${order.number}`, R2: "N/A", RU: returnUrl("fonepay") };
  const DV = createHmac("sha512", c.secret).update([p.PID, p.MD, p.PRN, p.AMT, p.CRN, p.DT, p.R1, p.R2, p.RU].join(",")).digest("hex");
  return { kind: "redirect", url: `${c.base}?${new URLSearchParams({ ...p, DV })}`, ref };
}

export type VerifyResult = { ok: true; ref: string; amount: number; gatewayRef: string } | { ok: false; ref?: string; code: PayCode };

/** eSewa sends back ?data=<base64 JSON>, signed; then we ask eSewa's status API. */
export async function verifyEsewa(data: string, expectedTotal: (ref: string) => Promise<number | null>): Promise<VerifyResult> {
  const c = esewa();
  if (!c) return { ok: false, code: "unavailable" };
  let d: Record<string, string>;
  try {
    d = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch {
    return { ok: false, code: "bad_reply" };
  }
  const fields = String(d.signed_field_names ?? "").split(",");
  const signed = fields.map((f) => `${f}=${d[f] ?? ""}`).join(",");
  const expectedSig = createHmac("sha256", c.secret).update(signed).digest("base64");
  if (!d.signature || !sameText(d.signature, expectedSig)) return { ok: false, ref: d.transaction_uuid, code: "bad_reply" };

  const ref = d.transaction_uuid;
  const total = await expectedTotal(ref);
  if (total === null) return { ok: false, ref, code: "no_order" };
  const q = new URLSearchParams({ product_code: c.code, total_amount: String(total), transaction_uuid: ref });
  const res = await fetch(`${c.status}?${q}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  const s = (await res.json().catch(() => ({}))) as { status?: string; ref_id?: string; total_amount?: unknown };
  if (s.status !== "COMPLETE") return { ok: false, ref, code: s.status === "CANCELED" || s.status === "NOT_FOUND" ? "cancelled" : "not_complete" };
  return { ok: true, ref, amount: money(s.total_amount ?? d.total_amount), gatewayRef: s.ref_id ?? d.transaction_code };
}

/** Asks eSewa directly whether a payment attempt completed (for customers who closed the tab). */
export async function esewaStatus(ref: string, total: number): Promise<VerifyResult> {
  const c = esewa();
  if (!c) return { ok: false, code: "unavailable" };
  const q = new URLSearchParams({ product_code: c.code, total_amount: String(total), transaction_uuid: ref });
  const res = await fetch(`${c.status}?${q}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  const s = (await res.json().catch(() => ({}))) as { status?: string; ref_id?: string; total_amount?: unknown };
  if (s.status !== "COMPLETE") return { ok: false, ref, code: s.status === "CANCELED" || s.status === "NOT_FOUND" ? "cancelled" : "not_complete" };
  return { ok: true, ref, amount: money(s.total_amount ?? total), gatewayRef: s.ref_id ?? ref };
}

/** Khalti sends back ?pidx=…; we ask Khalti's lookup API. */
export async function verifyKhalti(pidx: string): Promise<VerifyResult> {
  const c = khalti();
  if (!c) return { ok: false, code: "unavailable" };
  const res = await fetch(`${c.base}/epayment/lookup/`, { signal: AbortSignal.timeout(10_000),
    method: "POST",
    headers: { Authorization: `Key ${c.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pidx }),
    cache: "no-store",
  });
  const s = (await res.json().catch(() => ({}))) as { status?: string; total_amount?: number; transaction_id?: string; refunded?: boolean };
  if (s.status !== "Completed" || s.refunded) return { ok: false, ref: pidx, code: s.status === "Pending" || s.status === "Initiated" ? "not_complete" : "cancelled" };
  return { ok: true, ref: pidx, amount: Number(s.total_amount ?? 0) / 100, gatewayRef: s.transaction_id ?? pidx };
}

/** Fonepay sends back PRN, PS, UID, BC… signed; then we ask Fonepay's verification API. */
export async function verifyFonepay(q: URLSearchParams, expectedTotal: (ref: string) => Promise<number | null>): Promise<VerifyResult> {
  const c = fonepay();
  if (!c) return { ok: false, code: "unavailable" };
  const g = (k: string) => q.get(k) ?? "";
  const ref = g("PRN");
  const returnDv = createHmac("sha512", c.secret)
    .update([g("PRN"), g("PID"), g("PS"), g("RC"), g("UID"), g("BC"), g("INI"), g("P_AMT"), g("R_AMT")].join(","))
    .digest("hex");
  if (!sameText(g("DV").toLowerCase(), returnDv)) return { ok: false, ref, code: "bad_reply" };
  if (g("PS") !== "true") return { ok: false, ref, code: "cancelled" };

  const total = await expectedTotal(ref);
  if (total === null) return { ok: false, ref, code: "no_order" };
  const amt = String(total);
  const DV = createHmac("sha512", c.secret).update([c.pid, amt, ref, g("BC"), g("UID")].join(",")).digest("hex");
  const res = await fetch(`${c.base}/verificationMerchant?${new URLSearchParams({ PRN: ref, PID: c.pid, BID: g("BC"), AMT: amt, UID: g("UID"), DV })}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  const xml = await res.text();
  if (!/<success>\s*true\s*<\/success>/i.test(xml)) {
    console.error("[pay:fonepay] verification said no", res.status, xml.slice(0, 300));
    return { ok: false, ref, code: "not_complete" };
  }
  return { ok: true, ref, amount: money(g("P_AMT")) || total, gatewayRef: g("UID") };
}
