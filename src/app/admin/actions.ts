"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import {
  adjustStockBy,
  allProducts,
  createProduct,
  findProduct,
  moveStock,
  notifyRestocked,
  saveDrop,
  saveFestivals,
  StockShortError,
  updateProduct,
  type StockReason,
} from "@/lib/catalogue";
import { formatPrice } from "@/lib/format";
import { blockGiftCard, creditGiftCard, normaliseCode } from "@/lib/gift-cards";
import { notifySms } from "@/lib/notify";
import { event, lockOrder, refundedQty, releaseHolds } from "@/lib/orders";
import { saveProductPhoto } from "@/lib/photos";
import { allow, clearLimit, clientIp } from "@/lib/rate-limit";
import {
  addStaff,
  changeStaffLogin,
  checkAdminLogin,
  endAdminSession,
  logStaff,
  removeStaff,
  requireOwner,
  requireStaff,
  staffList,
  startAdminSession,
} from "@/lib/staff";
import { SIZE_ORDER } from "@/lib/inventory";
import type { Category, Colour, Fit, Gender, Measurements, Product, ProductStatus, Size } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => {
  const n = Number(str(f, k));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};
/** Catalogue changed: refresh cached pages. */
function catalogueChanged() {
  updateTag("catalogue");
  revalidatePath("/", "layout");
}

export type SaveState = { status: "idle" } | { status: "saved"; message: string } | { status: "error"; message: string };

// ---------- Staff login ----------

export type LoginState = { status: "idle" } | { status: "error"; message: string; username: string };

export async function signInAdmin(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = str(form, "username");
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  // 5 wrong tries per address and 10 per username in 15 minutes (kept in the database).
  const byIp = `admin-login:${ip}`;
  const byUser = `admin-login-user:${username.toLowerCase()}`;
  const member = await checkAdminLogin(username, password);
  if (!member) {
    const okIp = await allow(byIp, 5, 15 * 60_000);
    const okUser = await allow(byUser, 10, 15 * 60_000);
    return { status: "error", message: okIp && okUser ? "That username and password don't match." : "Too many tries. Wait 15 minutes, then try again.", username };
  }
  if (!(await allow(byIp, 5, 15 * 60_000))) return { status: "error", message: "Too many tries. Wait 15 minutes, then try again.", username };
  await clearLimit(byIp);
  await clearLimit(byUser);
  await startAdminSession(member.id);
  await logStaff(member, "signed in", null, { ip, portal: str(form, "portal") || "admin" });
  // Helpers always go to their portal; an owner signing in on the helper login goes there too.
  redirect(member.role === "helper" || str(form, "portal") === "helper" ? "/helper" : "/admin");
}

// ---------- Your staff login ----------

export type AccountState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; field: "current" | "username" | "password"; message: string };

export async function changeUsername(_prev: AccountState, form: FormData): Promise<AccountState> {
  const me = await requireStaff();
  const res = await changeStaffLogin(me.id, String(form.get("current") ?? ""), { username: str(form, "username") });
  if (!res.ok) return { status: "error", field: res.field, message: res.message };
  await logStaff(me, "changed username", str(form, "username"));
  revalidatePath("/admin", "layout");
  return { status: "saved", message: "Username changed. Use it next time you sign in." };
}

export async function changePassword(_prev: AccountState, form: FormData): Promise<AccountState> {
  const me = await requireStaff();
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { status: "error", field: "password", message: "The two new passwords don't match." };
  const res = await changeStaffLogin(me.id, String(form.get("current") ?? ""), { password });
  if (!res.ok) return { status: "error", field: res.field, message: res.message };
  // Keep this device signed in; every other device is signed out by the new password.
  await startAdminSession(me.id);
  await logStaff(me, "changed password");
  return { status: "saved", message: "Password changed. Other devices have been signed out." };
}

export async function signOutAdmin(form?: FormData) {
  await endAdminSession();
  redirect(form?.get("portal") === "helper" ? "/helper/login" : "/admin/login");
}

// ---------- Staff accounts (owner) ----------

export async function addStaffAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const role = str(form, "role") === "owner" ? "owner" : "helper";
  const res = await addStaff(str(form, "username"), String(form.get("password") ?? ""), role);
  if (!res.ok) return { status: "error", message: res.message };
  await logStaff(me, "added staff", str(form, "username"), { role });
  revalidatePath("/admin/staff");
  return { status: "saved", message: `Added ${str(form, "username")} as ${role}. Give them the password in person.` };
}

export async function removeStaffAction(form: FormData) {
  const me = await requireOwner();
  const id = str(form, "id");
  const list = await staffList();
  const target = list.find((s) => s.id === id);
  if (!target || target.id === me.id) return;
  if (target.role === "owner" && list.filter((s) => s.role === "owner").length <= 1) return;
  await removeStaff(id);
  await logStaff(me, "removed staff", target.username);
  revalidatePath("/admin/staff");
}

// ---------- Orders ----------

export type OrderStep = "packed" | "ready" | "completed";

/** Moves an order one step on and tells the customer when there's something for them to do. */
export async function setOrderStep(form: FormData) {
  const me = await requireStaff();
  const id = str(form, "orderId");
  const step = str(form, "step") as OrderStep;
  const riderName = str(form, "riderName").slice(0, 60);
  const riderPhone = str(form, "riderPhone").replace(/\D/g, "").slice(-10);
  const now = new Date().toISOString();

  const order = await lockOrder(id, async (o) => {
    if (o.status === "awaiting_payment" || o.status === "expired" || o.status === "cancelled") return { save: false, result: null };
    if (step === "packed") {
      o.packedAt ??= now;
      if (o.gift) o.gift.packedAt ??= now;
    } else if (step === "ready") {
      o.packedAt ??= now;
      o.readyAt = now;
      o.status = o.method === "pickup" ? "ready_for_pickup" : "out_for_delivery";
      if (o.method === "delivery" && riderName) o.rider = { name: riderName, phone: riderPhone };
    } else if (step === "completed") {
      o.completedAt = now;
      o.status = "completed";
      if (o.gift) {
        o.gift.deliveredAt = now;
        o.gift.status = "delivered";
      }
    } else return { save: false, result: null };
    o.events = [...(o.events ?? []), event(me.username, step === "packed" ? "Packed" : step === "ready" ? (o.method === "pickup" ? "Ready at the counter" : `Out for delivery${o.rider ? ` with ${o.rider.name}` : ""}`) : o.method === "pickup" ? "Collected" : "Delivered")];
    return { save: true, result: o };
  });
  if (!order) return;
  revalidatePath("/helper", "layout");
  if (step === "ready" && !order.gift) {
    after(() =>
      notifySms(
        order.phone,
        order.method === "pickup"
          ? `Easypick: order ${order.number} is ready at the counter. Bring this number.`
          : `Easypick: order ${order.number} is on the way${order.rider ? ` with ${order.rider.name} (${order.rider.phone})` : ""}. The rider will call before arriving.`,
      ),
    );
  }
  revalidatePath("/admin", "layout");
}

export async function clearAttention(form: FormData) {
  const me = await requireStaff();
  const id = str(form, "orderId");
  await lockOrder(id, async (o) => {
    if (!o.attention) return { save: false, result: null };
    o.events = [...(o.events ?? []), event(me.username, `Resolved: ${o.attention}`)];
    o.attention = null;
    return { save: true, result: null };
  });
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/helper/order/${id}`);
}

/**
 * Owner: cancel or refund some or all of an order. Puts pieces back in stock (if chosen),
 * returns gift-card money to the card first, and records what was refunded to the wallet
 * (done by hand in the eSewa merchant portal) with its reference.
 */
export async function refundOrder(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const id = str(form, "orderId");
  const restock = form.get("restock") === "on";
  const walletRef = str(form, "walletRef").slice(0, 80);
  const note = str(form, "note").slice(0, 200);
  const includeDelivery = form.get("includeDelivery") === "on";
  try {
    const res = await lockOrder(id, async (o, tx): Promise<{ save: boolean; result: SaveState }> => {
      if (o.status === "awaiting_payment" || o.status === "expired") return { save: false, result: { status: "error", message: "Unpaid orders don't need a refund." } };
      const done = refundedQty(o);
      const picked = o.lines
        .map((l, i) => ({ i, qty: Math.min(Math.max(0, int(form, `qty:${i}`) || 0), l.qty - done[i]) }))
        .filter((x) => x.qty > 0);
      if (!picked.length && !includeDelivery) return { save: false, result: { status: "error", message: "Choose what to refund." } };

      const value = picked.reduce((n, x) => n + o.lines[x.i].unitPrice * x.qty, 0) + (includeDelivery ? o.deliveryFee : 0);
      // Gift card part first (up to what the card paid and hasn't had back), the rest to the wallet.
      const cardPaid = o.giftCard?.applied ?? 0;
      const cardBack = (o.refunds ?? []).reduce((n, r) => n + r.toGiftCard, 0);
      const toGiftCard = Math.min(value, Math.max(0, cardPaid - cardBack));
      const toWallet = value - toGiftCard;
      if (toWallet > 0 && !walletRef) return { save: false, result: { status: "error", message: `Refund ${formatPrice(toWallet)} in the eSewa merchant portal first, then enter its reference here.` } };

      if (restock && picked.length && o.kind !== "gift_card") {
        await moveStock(
          tx,
          picked.map((x) => ({ sku: o.lines[x.i].sku, delta: x.qty })),
          { reason: "refund_restock", source: "admin", ref: o.number, actor: me.username },
        );
      }
      if (toGiftCard > 0 && o.giftCard) await creditGiftCard(o.giftCard.code, toGiftCard, o.id, tx);

      o.refunds = [
        ...(o.refunds ?? []),
        { at: new Date().toISOString(), by: me.username, amount: value, toGiftCard, walletRef: walletRef || undefined, note: note || undefined, skus: picked.map((x) => o.lines[x.i].sku), lines: picked },
      ];
      const allBack = o.lines.every((l, i) => done[i] + (picked.find((x) => x.i === i)?.qty ?? 0) >= l.qty);
      if (allBack) {
        o.status = "cancelled";
        o.stockHeld = false;
      }
      o.attention = null;
      o.events = [
        ...(o.events ?? []),
        event(me.username, `${allBack ? "Cancelled and refunded" : "Refunded"} ${formatPrice(value)}${toGiftCard ? ` (${formatPrice(toGiftCard)} to gift card)` : ""}${walletRef ? `, wallet ref ${walletRef}` : ""}${restock ? ", back in stock" : ""}`),
      ];
      return { save: true, result: { status: "saved", message: `Refunded ${formatPrice(value)}.` } };
    });
    if (!res) return { status: "error", message: "Order not found." };
    if (res.status === "saved") {
      await logStaff(me, "refund", id, { restock, walletRef, note });
      catalogueChanged();
      revalidatePath(`/admin/orders/${id}`);
    }
    return res;
  } catch (e) {
    if (e instanceof StockShortError) return { status: "error", message: "Couldn't update stock. Try again." };
    throw e;
  }
}

/** Any staff: swap a piece for another size or colour of the same product (within 7 days, 14 for gifts). */
export async function exchangeLine(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireStaff();
  const id = str(form, "orderId");
  const i = int(form, "line");
  const newSku = str(form, "newSku");
  try {
    const res = await lockOrder(id, async (o, tx): Promise<{ save: boolean; result: SaveState }> => {
      const line = o.lines[i];
      if (!line || o.kind === "gift_card") return { save: false, result: { status: "error", message: "Choose a piece to exchange." } };
      if (!["paid", "ready_for_pickup", "out_for_delivery", "completed"].includes(o.status)) return { save: false, result: { status: "error", message: "Only paid orders can be exchanged." } };
      const since = Date.parse(o.completedAt ?? o.paidAt ?? o.createdAt);
      const days = o.gift ? 14 : 7;
      if (Date.now() - since > days * 86_400_000 && form.get("override") !== "on")
        return { save: false, result: { status: "error", message: `It's past the ${days}-day exchange window. Tick "Allow anyway" if you agree to it.` } };
      const product = await findProduct(line.slug);
      const target = product?.variants.find((v) => v.sku === newSku);
      if (!product || !target || target.sku === line.sku) return { save: false, result: { status: "error", message: "Pick a different size or colour." } };
      await moveStock(tx, [{ sku: target.sku, delta: -1 }], { reason: "exchange_out", source: "admin", ref: o.number, actor: me.username });
      await moveStock(tx, [{ sku: line.sku, delta: 1 }], { reason: "exchange_in", source: "admin", ref: o.number, actor: me.username });
      const from = `${line.colour} ${line.size}`;
      o.lines[i] = { ...line, sku: target.sku, size: target.size, colour: target.colour };
      o.events = [...(o.events ?? []), event(me.username, `Exchanged ${line.name}: ${from} → ${target.colour} ${target.size}`)];
      return { save: true, result: { status: "saved", message: `Exchanged for ${target.colour} ${target.size}.` } };
    });
    if (!res) return { status: "error", message: "Order not found." };
    if (res.status === "saved") {
      await logStaff(me, "exchange", id, { line: i, newSku });
      catalogueChanged();
      revalidatePath(`/admin/orders/${id}`);
      revalidatePath(`/helper/order/${id}`);
    }
    return res;
  } catch (e) {
    if (e instanceof StockShortError) return { status: "error", message: "That size has none left." };
    throw e;
  }
}

/** Owner: release an unpaid order's hold early (e.g. the customer asked to cancel before paying). */
export async function cancelUnpaid(form: FormData) {
  const me = await requireOwner();
  const id = str(form, "orderId");
  await lockOrder(id, async (o, tx) => {
    if (o.status !== "awaiting_payment") return { save: false, result: null };
    await releaseHolds(tx, o, "order_release", me.username);
    o.status = "cancelled";
    o.events = [...(o.events ?? []), event(me.username, "Cancelled before payment")];
    return { save: true, result: null };
  });
  catalogueChanged();
  revalidatePath(`/admin/orders/${id}`);
}

// ---------- Products ----------

const STATUSES: ProductStatus[] = ["draft", "scheduled", "live", "sold_out", "archived"];

/** Owner: price, status, description and photo. (Stock has its own +/- form.) */
export async function saveProduct(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const slug = str(form, "slug");
  const product = await findProduct(slug);
  if (!product) return { status: "error", message: "Product not found." };

  const price = int(form, "price");
  const saleRaw = str(form, "salePrice");
  const salePrice = saleRaw ? int(form, "salePrice") : undefined;
  const status = str(form, "status") as ProductStatus;
  if (!(price > 0)) return { status: "error", message: "Enter a price." };
  if (salePrice !== undefined && !(salePrice > 0 && salePrice < price)) return { status: "error", message: "Sale price must be lower than the price." };
  if (!STATUSES.includes(status)) return { status: "error", message: "Choose a status." };

  let photoSrc: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const saved = await saveProductPhoto(slug, photo);
    if (!saved.ok) return { status: "error", message: saved.message };
    photoSrc = saved.src;
  }

  await updateProduct(slug, (p) => {
    p.price = price;
    p.salePrice = salePrice;
    p.status = status;
    p.shortDescription = str(form, "shortDescription") || p.shortDescription;
    if (photoSrc) {
      const front = { src: photoSrc, alt: `${p.name}, front`, kind: "front" as const };
      const i = p.images.findIndex((img) => img.kind === "front");
      if (i >= 0) p.images[i] = front;
      else p.images.unshift(front);
    }
  });
  await logStaff(me, "edited product", slug, {
    price: product.price !== price ? [product.price, price] : undefined,
    salePrice: product.salePrice !== salePrice ? [product.salePrice ?? null, salePrice ?? null] : undefined,
    status: product.status !== status ? [product.status, status] : undefined,
    photo: photoSrc ? "changed" : undefined,
  });
  catalogueChanged();
  return { status: "saved", message: "Saved." };
}

const ADJUST_REASONS: StockReason[] = ["received", "count", "damaged", "returned"];

/** Any staff: stock + or − per size, with a reason. Tells anyone waiting on a size that came back. */
export async function adjustStock(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireStaff();
  const slug = str(form, "slug");
  const reason = str(form, "reason") as StockReason;
  if (!ADJUST_REASONS.includes(reason)) return { status: "error", message: "Choose why the stock is changing." };
  const changes: Record<string, number> = {};
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("adj:")) continue;
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n !== 0) changes[k.slice(4)] = n;
  }
  if (!Object.keys(changes).length) return { status: "error", message: "Enter a + or − number for at least one size." };
  const res = await adjustStockBy(slug, changes, { reason, ref: str(form, "note").slice(0, 80) || null, actor: me.username });
  if (!res.ok) return { status: "error", message: `${res.sku} only has ${res.left}. Stock can't go below zero.` };
  await logStaff(me, "stock", slug, { reason, changes });
  const told = await notifyRestocked(res.restocked);
  catalogueChanged();
  return { status: "saved", message: told ? `Stock updated. We told ${told} ${told === 1 ? "person" : "people"} their size is back.` : "Stock updated." };
}

export type CountState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "preview"; text: string; rows: { sku: string; name: string; now: number; counted: number }[]; unknown: string[] }
  | { status: "saved"; message: string };

/**
 * Any staff: a stock count (from a sheet or, later, an RFID reader): "SKU,count" per line.
 * First shows the differences; applying records them as "count" corrections.
 */
export async function bulkCount(_prev: CountState, form: FormData): Promise<CountState> {
  const me = await requireStaff();
  const text = str(form, "counts").slice(0, 20000);
  const parsed = new Map<string, number>();
  for (const line of text.split(/\r?\n/)) {
    const [sku, n] = line.split(/[,\t;]/).map((x) => x.trim());
    if (!sku || n === undefined || !/^\d+$/.test(n)) continue;
    parsed.set(sku.toUpperCase(), Number(n));
  }
  if (!parsed.size) return { status: "error", message: 'Paste one "SKU,count" per line, e.g. HOD01-BLA-M,4' };
  const products = await allProducts();
  const bySku = new Map(products.flatMap((p) => p.variants.map((v) => [v.sku.toUpperCase(), { p, v }] as const)));
  const rows = [...parsed].flatMap(([sku, counted]) => {
    const hit = bySku.get(sku);
    return hit && hit.v.stock !== counted ? [{ sku: hit.v.sku, name: `${hit.p.name} · ${hit.v.colour} ${hit.v.size}`, now: hit.v.stock, counted }] : [];
  });
  const unknown = [...parsed.keys()].filter((s) => !bySku.has(s));
  if (form.get("apply") !== "1") return { status: "preview", text, rows, unknown };

  let restocked: string[] = [];
  const bySlug = new Map<string, typeof rows>();
  for (const r of rows) {
    const slug = bySku.get(r.sku.toUpperCase())!.p.slug;
    bySlug.set(slug, [...(bySlug.get(slug) ?? []), r]);
  }
  for (const [slug, group] of bySlug) {
    const changes = Object.fromEntries(group.map((r) => [r.sku, r.counted - r.now]));
    const res = await adjustStockBy(slug, changes, { reason: "count", ref: "stock count", actor: me.username });
    if (res.ok) restocked = restocked.concat(res.restocked);
  }
  await logStaff(me, "stock count", null, { changed: rows.length });
  const told = await notifyRestocked(restocked);
  catalogueChanged();
  return { status: "saved", message: `Updated ${rows.length} ${rows.length === 1 ? "size" : "sizes"}.${told ? ` Told ${told} waiting ${told === 1 ? "person" : "people"}.` : ""}` };
}

const CATEGORY_CODE: Record<Category, string> = { tees: "TEE", hoodies: "HOD", jackets: "JKT", bottoms: "BTM", "co-ords": "COR", accessories: "ACC" };

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Owner: a new product from the admin form. Starts as a draft unless "Put it live" was chosen. */
export async function addProduct(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const name = str(form, "name");
  if (!name) return { status: "error", message: "Give it a name." };
  const slug = slugify(str(form, "slug") || name);
  if (!slug) return { status: "error", message: "The name needs some letters or numbers." };
  if (await findProduct(slug)) return { status: "error", message: `There's already a product at /product/${slug}. Change the name or link.` };

  const category = str(form, "category") as Category;
  if (!(category in CATEGORY_CODE)) return { status: "error", message: "Choose a category." };
  const price = int(form, "price");
  if (!(price > 0)) return { status: "error", message: "Enter a price in rupees." };

  let colours: Colour[];
  try {
    colours = (JSON.parse(str(form, "colours")) as Colour[]).filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), hex: c.hex }));
  } catch {
    colours = [];
  }
  if (!colours.length) return { status: "error", message: "Add at least one colour." };

  const sizes = SIZE_ORDER.filter((s) => form.get(`size:${s}`) === "on");
  if (!sizes.length) return { status: "error", message: "Tick at least one size." };

  const measurements: Measurements = {};
  for (const s of sizes) {
    const m: NonNullable<Measurements[Size]> = {};
    for (const k of ["chest", "length", "sleeve", "waist", "inseam"] as const) {
      const n = int(form, `m:${s}:${k}`);
      if (n > 0) m[k] = n;
    }
    if (Object.keys(m).length) measurements[s] = m;
  }

  const code = `${CATEGORY_CODE[category]}${String(Math.floor(Math.random() * 90) + 10)}`;
  const variants = colours.flatMap((c) =>
    sizes.map((s) => {
      const n = int(form, `stock:${c.name}:${s}`);
      return { sku: `${code}-${c.name.slice(0, 3).toUpperCase()}-${s}`, size: s, colour: c.name, stock: n > 0 ? n : 0 };
    }),
  );

  const images: Product["images"] = [];
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const saved = await saveProductPhoto(slug, photo);
    if (!saved.ok) return { status: "error", message: saved.message };
    images.push({ src: saved.src, alt: `${name}, front`, kind: "front" });
  } else {
    images.push({ src: null, alt: `${name}, front`, kind: "front" });
  }

  const live = form.get("publish") === "on";
  await createProduct({
    id: randomUUID(),
    slug,
    name,
    category,
    gender: (str(form, "gender") || "unisex") as Gender,
    fit: (str(form, "fit") || "regular") as Fit,
    dropSlug: str(form, "drop") || null,
    shortDescription: str(form, "shortDescription"),
    details: str(form, "details")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    tags: [],
    colours,
    images,
    price,
    measurements,
    variants,
    status: live ? "live" : "draft",
    showOn: { website: true, kiosk: true },
  });
  await logStaff(me, "added product", slug, { price, live });
  catalogueChanged();
  redirect(`/admin/products/${slug}?added=1`);
}

// ---------- Drops (owner) ----------

export async function saveDropAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const slug = str(form, "slug").replace(/[^0-9a-z-]/gi, "").slice(0, 20);
  const name = str(form, "name").slice(0, 60);
  const story = str(form, "story").slice(0, 400);
  const local = str(form, "releaseAt"); // yyyy-mm-ddThh:mm, Kathmandu
  if (!slug || !name) return { status: "error", message: "Give the drop a number and a name." };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return { status: "error", message: "Pick the release date and time." };
  const releaseAt = new Date(`${local}:00+05:45`).toISOString();
  const pieces = form.getAll("products").map(String);
  await saveDrop({ slug, name, story, releaseAt }, pieces);
  await logStaff(me, "saved drop", slug, { releaseAt, pieces: pieces.length });
  catalogueChanged();
  return { status: "saved", message: `Saved ${name}.` };
}

// ---------- Gift cards (owner) ----------

export async function blockGiftCardAction(form: FormData) {
  const me = await requireOwner();
  const code = normaliseCode(str(form, "code"));
  if (!code) return;
  await blockGiftCard(code);
  await logStaff(me, "blocked gift card", code);
  revalidatePath("/admin/gift-cards");
}

// ---------- Festivals (owner) ----------

export async function saveFestivalList(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const names = form.getAll("name").map(String);
  const dates = form.getAll("date").map(String);
  const orderBys = form.getAll("orderBy").map(String);
  const list = names
    .map((name, i) => ({ id: randomUUID(), name: name.trim(), date: dates[i], orderBy: orderBys[i] }))
    .filter((f) => f.name && f.date && f.orderBy);
  if (list.some((f) => f.orderBy > f.date)) return { status: "error", message: "The order-by day has to be on or before the festival." };
  await saveFestivals(list);
  await logStaff(me, "saved festivals", null, { count: list.length });
  revalidatePath("/", "layout");
  return { status: "saved", message: "Saved." };
}
