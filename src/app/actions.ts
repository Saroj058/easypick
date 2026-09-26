"use server";

import { createHmac, randomUUID } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getCurrentUser, secret, updateUser } from "@/lib/auth";
import { mergeBag } from "@/lib/bag-rules";
import { addRestockAlert } from "@/lib/catalogue";
import { getDb, schema } from "@/lib/db";
import { normaliseEmail } from "@/lib/email";
import { checkGiftCard } from "@/lib/gift-cards";
import { sellable } from "@/lib/inventory";
import { normaliseNepaliMobile } from "@/lib/format";
import { createOrder, findOrderByNumber, updateOrder, type Order, type OrderLine } from "@/lib/orders";
import { allow, clientIp, isBlocked, hit } from "@/lib/rate-limit";
import { confirmPayment } from "@/lib/payments";
import { site } from "@/lib/site";
import { getProducts } from "@/lib/store";
import type { FulfilmentMethod, PaymentProvider } from "@/lib/types";

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

const PROVIDERS: PaymentProvider[] = site.payments.enabled;

/** Unpaid orders still holding stock that match `where`. */
async function openOrders(where: SQL) {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(and(eq(schema.orders.status, "awaiting_payment"), sql`${schema.orders.data}->>'expiresAt' > ${new Date().toISOString()}`, where));
  return row?.n ?? 0;
}

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
    if (area.length > 80 || landmark.length > 80 || details.length > 120) {
      return { status: "error", field: "area", message: "Keep the address short: area and landmark under 80 letters, directions under 120." };
    }
    address = { area, landmark, details };
  }

  // The bag is for account holders. "Buy now" is one piece and needs no account.
  const buyNow = form.get("mode") === "buy_now";
  let rawBag: unknown;
  try {
    const text = String(form.get("bag") ?? "[]");
    rawBag = text.length > 20_000 ? null : JSON.parse(text);
  } catch {
    rawBag = null;
  }
  const bag = mergeBag(rawBag, { buyNow });
  if (!bag.ok) return { status: "error", message: bag.message };
  const user = await getCurrentUser();
  if (!buyNow && !user) return { status: "error", message: "Log in to check out your bag, or use Buy now on a single piece." };

  // Unpaid orders hold stock for 15 minutes, so nobody may hold the whole shop:
  // a few tries per visitor and number, and only a couple of unpaid orders open at once.
  const ip = await clientIp();
  const busy: CheckoutState = { status: "error", message: "Too many orders at once. Pay for or wait out your open order, then try again in a few minutes." };
  if (!(await allow(`order:${ip}`, 6, 10 * 60_000)) || !(await allow(`order-phone:${phone}`, 6, 10 * 60_000))) return busy;
  const placedFrom = createHmac("sha256", secret()).update(ip).digest("hex").slice(0, 24);
  if ((await openOrders(sql`${schema.orders.phone} = ${phone}`)) >= 2) return busy;
  if ((await openOrders(sql`${schema.orders.data}->>'placedFrom' = ${placedFrom}`)) >= 3) return busy;

  // Never trust prices from the browser: rebuild every line from the catalogue.
  // Stock isn't judged from the (cached) catalogue: createOrder takes the pieces from the
  // live stock and says so when a size just sold out.
  const catalogue = await getProducts();
  const lines: OrderLine[] = [];
  for (const item of bag.lines) {
    const product = catalogue.find((p) => p.slug === item.slug);
    const variant = product?.variants.find((v) => v.sku === item.sku);
    if (!product || !variant || product.status !== "live") {
      return { status: "error", message: `${product?.name ?? item.name} is no longer available. Remove it from your bag to continue.` };
    }
    const qty = item.qty;
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

  // Optional Easypick gift card: re-checked here (limits are per visitor, not per typed phone).
  const cardInput = String(form.get("giftCard") ?? "").trim();
  let giftCardCode: string | null = null;
  if (cardInput) {
    const check = await checkGiftCard(cardInput, await clientIp());
    if (!check.ok) return { status: "error", field: "giftCard", message: check.message };
    giftCardCode = check.code;
  }

  // One step: order number, pieces held for 15 minutes, gift card spent. All or nothing.
  // It becomes "paid" only when the wallet confirms the payment server-to-server.
  const created = await createOrder(
    {
      id: randomUUID(),
      phone,
      method,
      address,
      provider,
      lines,
      subtotal,
      deliveryFee,
      status: "awaiting_payment",
      source: buyNow ? "buy_now" : "bag",
      placedFrom,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
      kind: "goods",
    },
    { userId: user?.id, giftCardCode },
  );
  if (!created.ok) return { status: "error", message: created.message };
  const order = created.order;
  // Fully covered by a gift card: nothing to pay, so it's confirmed now (stock, emails, all of it).
  if (order.total <= 0) await confirmPayment(order.id);
  // Remember how they like to get and pay for things, so next checkout is one tap.
  if (user) await updateUser(user.id, { checkout: { method, provider, address: address ?? user.checkout?.address } });
  redirect(`/pay/${order.id}`); // straight to the wallet (eSewa)
}

// ---------- Test-mode payment ----------

/**
 * Skips the wallet in development (no real or sandbox payment needed):
 * runs exactly what a verified payment runs. Disabled in production.
 */
export async function payInTestMode(form: FormData) {
  if (process.env.NODE_ENV === "production") return;
  const id = String(form.get("orderId") ?? "");
  await confirmPayment(id);
  redirect(`/order/${id}`);
}

/** Stands in for the helper's admin screen while it doesn't exist: moves a paid order one step on. Disabled in production. */
export async function advanceOrderInTestMode(form: FormData) {
  if (process.env.NODE_ENV === "production") return;
  const id = String(form.get("orderId") ?? "");
  const now = new Date().toISOString();
  await updateOrder(id, (o) => {
    if (o.status === "paid" && !o.packedAt) o.packedAt = now;
    else if (o.status === "paid") {
      o.status = o.method === "pickup" ? "ready_for_pickup" : "out_for_delivery";
      o.readyAt = now;
    } else if (o.status === "ready_for_pickup" || o.status === "out_for_delivery") {
      o.status = "completed";
      o.completedAt = now;
    }
  });
  redirect(`/order/${id}`);
}

// ---------- Track an order without an account ----------

export type TrackState = { status: "idle" } | { status: "error"; message: string; number: string; phone: string };

export async function trackOrder(_prev: TrackState, form: FormData): Promise<TrackState> {
  const typedPhone = String(form.get("phone") ?? "");
  const phone = normaliseNepaliMobile(typedPhone);
  const number = String(form.get("number") ?? "");
  const fail = (message: string): TrackState => ({ status: "error", message, number, phone: typedPhone });
  if (!phone || !/\d{6}/.test(number)) return fail("Enter your order number (like EP-1000123) and the mobile number you used.");

  // A few wrong tries per visitor, so order numbers can't be guessed.
  const key = `track:${await clientIp()}`;
  if (await isBlocked(key, 8)) return fail("Too many tries. Please wait 10 minutes.");
  const order = await findOrderByNumber(number, phone);
  if (!order) {
    await hit(key, 10 * 60_000);
    return fail("We couldn't find that order. Check the number on your receipt and the phone you ordered with.");
  }
  redirect(`/order/${order.id}`);
}

// ---------- "Tell me when my size is back" ----------

export type RestockState = { status: "idle" } | { status: "done"; message: string } | { status: "error"; message: string };

export async function requestRestock(_prev: RestockState, form: FormData): Promise<RestockState> {
  const slug = String(form.get("slug") ?? "");
  const sku = String(form.get("sku") ?? "");
  const contact = String(form.get("contact") ?? "").trim();
  const product = (await getProducts()).find((p) => p.slug === slug);
  const variant = product?.variants.find((v) => v.sku === sku);
  if (!product || !variant) return { status: "error", message: "Pick the size you want." };
  if (sellable(variant) > 0) return { status: "error", message: "Good news: that size is in stock right now." };

  const email = contact.includes("@") ? normaliseEmail(contact) : null;
  const phone = email ? null : normaliseNepaliMobile(contact);
  if (!email && !phone) return { status: "error", message: "Enter your email or a 10-digit mobile number." };
  if (!(await allow(`restock:${await clientIp()}`, 20, 60 * 60_000))) return { status: "error", message: "That's a lot of requests. Try again in an hour." };

  await addRestockAlert({ slug, sku, size: variant.size, colour: variant.colour, email, phone });
  const what = variant.size === "ONE" ? variant.colour : `${variant.colour}, ${variant.size}`;
  return { status: "done", message: `Done. We'll ${email ? "email" : "text"} you once when ${what} is back.` };
}
