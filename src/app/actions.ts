"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { checkGiftCard, spendGiftCard } from "@/lib/gift-cards";
import { normaliseNepaliMobile } from "@/lib/format";
import { saveOrder, type Order, type OrderLine } from "@/lib/orders";
import { confirmPayment } from "@/lib/payments";
import { site } from "@/lib/site";
import { getProducts } from "@/lib/store";
import type { BagLine, FulfilmentMethod, PaymentProvider } from "@/lib/types";

// ---------- Drop alerts ----------

export type AlertState = { status: "idle" } | { status: "error"; message: string } | { status: "done"; phone: string };

export async function signUpForAlerts(_prev: AlertState, form: FormData): Promise<AlertState> {
  const phone = normaliseNepaliMobile(String(form.get("phone") ?? ""));
  if (!phone) return { status: "error", message: "Enter a 10-digit Nepali mobile number, like 98XXXXXXXX." };
  if (form.get("consent") !== "on") return { status: "error", message: "Tick the box so we're allowed to message you." };

  // TODO: POST to Store API /alerts/subscribers { phone, source, consentAt } once it exists.
  if (process.env.NODE_ENV !== "production") {
    console.info("[alerts] sign-up", { phone, source: form.get("source") });
  }
  return { status: "done", phone: `${phone.slice(0, 3)}•••${phone.slice(-3)}` };
}

// ---------- Checkout ----------

export type CheckoutState = { status: "idle" } | { status: "error"; message: string; field?: string };

const PROVIDERS: PaymentProvider[] = ["esewa", "khalti", "fonepay"];

export async function placeOrder(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const phone = normaliseNepaliMobile(String(form.get("phone") ?? ""));
  if (!phone) return { status: "error", field: "phone", message: "Enter a 10-digit Nepali mobile number." };

  const method = form.get("method") as FulfilmentMethod;
  if (method !== "pickup" && method !== "delivery") return { status: "error", field: "method", message: "Choose pickup or delivery." };

  const provider = form.get("provider") as PaymentProvider;
  if (!PROVIDERS.includes(provider)) return { status: "error", field: "provider", message: "Choose how you'll pay." };

  let address: Order["address"];
  if (method === "delivery") {
    const area = String(form.get("area") ?? "").trim();
    const landmark = String(form.get("landmark") ?? "").trim();
    const details = String(form.get("details") ?? "").trim();
    if (!area || !landmark) return { status: "error", field: "area", message: "Add your area and a nearby landmark so the rider can find you." };
    address = { area, landmark, details };
  }

  let bag: BagLine[];
  try {
    bag = JSON.parse(String(form.get("bag") ?? "[]"));
    if (!Array.isArray(bag) || bag.length === 0) throw new Error();
  } catch {
    return { status: "error", message: "Your bag is empty." };
  }

  // Never trust prices or stock from the browser: rebuild every line from the catalogue.
  const catalogue = await getProducts();
  const lines: OrderLine[] = [];
  for (const item of bag) {
    const product = catalogue.find((p) => p.slug === item.slug);
    const variant = product?.variants.find((v) => v.sku === item.sku);
    if (!product || !variant || product.status !== "live") {
      return { status: "error", message: `${item.name} is no longer available. Remove it from your bag to continue.` };
    }
    const qty = Math.max(1, Math.min(Number(item.qty) || 1, 5));
    const sellable = variant.lastPieceOnFloor ? variant.stock - 1 : variant.stock;
    if (sellable < qty) {
      return { status: "error", message: `Only ${Math.max(sellable, 0)} left of ${product.name} in ${variant.size}. Update your bag to continue.` };
    }
    lines.push({
      sku: variant.sku,
      slug: product.slug,
      name: product.name,
      size: variant.size,
      colour: variant.colour,
      unitPrice: product.salePrice ?? product.price,
      qty,
    });
  }

  const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.qty, 0);
  const deliveryFee = method === "delivery" && subtotal < site.delivery.freeAbove ? site.delivery.flatFee : 0;
  const now = new Date();
  const orderId = randomUUID();

  // Optional Easypick gift card: re-checked here, never trusted from the browser.
  let giftCard: Order["giftCard"];
  const cardInput = String(form.get("giftCard") ?? "").trim();
  if (cardInput) {
    const check = checkGiftCard(cardInput, `checkout:${phone}`);
    if (!check.ok) return { status: "error", field: "giftCard", message: check.message };
    const applied = spendGiftCard(check.code, subtotal + deliveryFee, orderId);
    if (applied > 0) giftCard = { code: check.code, applied };
  }

  const order: Order = {
    id: orderId,
    number: `EP-${String(Math.floor(100000 + Math.random() * 900000))}`,
    phone,
    method,
    address,
    provider,
    lines,
    subtotal,
    deliveryFee,
    giftCard,
    total: subtotal + deliveryFee - (giftCard?.applied ?? 0),
    status: giftCard && giftCard.applied >= subtotal + deliveryFee ? "paid" : "awaiting_payment",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
  };

  // TODO: with the Store API, create the order there (it holds stock for 15 min),
  // then create the payment with the provider and redirect to its checkout URL.
  // The order becomes "paid" only after the API verifies the payment server-to-server,
  // never from the provider's browser redirect.
  saveOrder(order, (await getCurrentUser())?.id);
  redirect(`/order/${order.id}`);
}

// ---------- Test-mode payment ----------

/**
 * Stands in for eSewa / Khalti / Fonepay while merchant accounts aren't live:
 * runs exactly what a verified payment runs. Disabled in production.
 */
export async function payInTestMode(form: FormData) {
  if (process.env.NODE_ENV === "production") return;
  const id = String(form.get("orderId") ?? "");
  await confirmPayment(id);
  redirect(`/order/${id}`);
}
