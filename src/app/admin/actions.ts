"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import {
  adjustStockBy,
  allDrops,
  allProducts,
  createProduct,
  findProduct,
  notifyRestocked,
  saveDrop,
  saveFestivals,
  StockShortError,
  updateProduct,
  type StockReason,
} from "@/lib/catalogue";
import { getDb, schema } from "@/lib/db";
import { blockGiftCard, normaliseCode } from "@/lib/gift-cards";
import { heldBySku } from "@/lib/holds";
import { notifySms } from "@/lib/notify";
import { event, lockOrder, releaseHolds } from "@/lib/orders";
import { exchangeOnePiece, refundOrderAs } from "@/lib/order-admin";
import { fulfilmentMethod, stepProblem, type OrderStep } from "@/lib/order-steps";
import { saveProductPhoto } from "@/lib/photos";
import { clearLimit, clientIp, hit, isBlocked } from "@/lib/rate-limit";
import {
  addStaff,
  changeStaffLogin,
  checkAdminLogin,
  currentStaff,
  endAdminSession,
  logStaff,
  removeStaff,
  requireOwner,
  requireStaff,
  startAdminSession,
} from "@/lib/staff";
import { SIZE_ORDER } from "@/lib/inventory";
import { colourCodes, CATEGORY_CODE, nextProductCode } from "@/lib/sku";
import { applyCount, parseCounts, planCount, readPlan, type CountPlan, type CountRow } from "@/lib/stock-count";
import type { Category, Colour, Fit, Gender, Measurements, Product, ProductStatus, Size } from "@/lib/types";

/** A trimmed text field, cut to `max` characters when given (cap every free-text field). */
const str = (f: FormData, k: string, max = Infinity) => String(f.get(k) ?? "").trim().slice(0, max);
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
  const shown = username.slice(0, 64);
  const tooMany: LoginState = { status: "error", message: "Too many tries. Wait 15 minutes, then try again.", username: shown };
  // 5 wrong tries per address and 10 per username in 15 minutes (kept in the database),
  // checked before the slow password check so a blocked guesser gets no more answers.
  const byIp = `admin-login:${ip}`;
  const byUser = `admin-login-user:${shown.toLowerCase()}`;
  if ((await isBlocked(byIp, 5)) || (await isBlocked(byUser, 10))) return tooMany;
  // Very long input is never a real login; don't spend a password hash on it.
  const member = username.length <= 64 && password.length <= 256 ? await checkAdminLogin(username, password) : null;
  if (!member) {
    const triesFromIp = await hit(byIp, 15 * 60_000);
    const triesForUser = await hit(byUser, 15 * 60_000);
    console.warn("[admin] failed sign-in", { ip, username: shown, triesFromIp, triesForUser });
    return triesFromIp >= 5 || triesForUser >= 10 ? tooMany : { status: "error", message: "That username and password don't match.", username: shown };
  }
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
  const me = await currentStaff();
  if (me) await logStaff(me, "signed out");
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
  // Checks (not yourself, not the last owner) happen inside removeStaff, atomically.
  const res = await removeStaff(str(form, "id"), me.id);
  if (!res.ok) return;
  await logStaff(me, "removed staff", res.username, { staffId: str(form, "id") });
  revalidatePath("/admin/staff");
}

// ---------- Orders ----------

export type { OrderStep };

/** Moves an order one step on (never back, never twice) and tells the customer when there's something for them to do. */
export async function setOrderStep(form: FormData) {
  const me = await requireStaff();
  const id = str(form, "orderId");
  const step = str(form, "step") as OrderStep;
  const riderName = str(form, "riderName").slice(0, 60);
  const riderPhone = str(form, "riderPhone").replace(/\D/g, "").slice(-10);
  const now = new Date().toISOString();

  const order = await lockOrder(id, async (o) => {
    if (stepProblem(o, step)) return { save: false, result: null };
    const method = fulfilmentMethod(o);
    if (step === "packed") {
      o.packedAt = now;
      if (o.gift) o.gift.packedAt ??= now;
    } else if (step === "ready") {
      o.readyAt = now;
      o.status = method === "pickup" ? "ready_for_pickup" : "out_for_delivery";
      if (method === "delivery" && riderName) o.rider = { name: riderName, phone: riderPhone };
    } else {
      o.completedAt = now;
      o.status = "completed";
      if (o.gift) {
        o.gift.deliveredAt = now;
        o.gift.status = "delivered";
      }
    }
    o.events = [...(o.events ?? []), event(me.username, step === "packed" ? "Packed" : step === "ready" ? (method === "pickup" ? "Ready at the counter" : `Out for delivery${o.rider ? ` with ${o.rider.name}` : ""}`) : method === "pickup" ? "Collected" : "Delivered")];
    return { save: true, result: o };
  });
  // Nothing changed (already done, or not allowed yet): no text to the customer, nothing to log.
  if (!order) return;
  await logStaff(me, `order ${step}`, id, { number: order.number, rider: step === "ready" ? order.rider?.name : undefined });
  revalidatePath("/helper", "layout");
  if (step === "ready" && !order.gift) {
    after(() =>
      notifySms(
        order.phone,
        fulfilmentMethod(order) === "pickup"
          ? `Easypick: order ${order.number} is ready at the counter. Bring this number.`
          : `Easypick: order ${order.number} is on the way${order.rider ? ` with ${order.rider.name} (${order.rider.phone})` : ""}. The rider will call before arriving.`,
      ),
    );
  }
  revalidatePath("/admin", "layout");
}

/** Owner: mark an order's problem as sorted. */
export async function clearAttention(form: FormData) {
  const me = await requireOwner();
  const id = str(form, "orderId");
  const cleared = await lockOrder(id, async (o) => {
    if (!o.attention) return { save: false, result: null };
    const what = o.attention;
    o.events = [...(o.events ?? []), event(me.username, `Resolved: ${what}`)];
    o.attention = null;
    return { save: true, result: { number: o.number, what } };
  });
  if (cleared) await logStaff(me, "cleared attention", id, cleared);
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/helper", "layout");
}

/**
 * Owner: cancel or refund some or all of a paid order. Puts pieces back in stock (if chosen and
 * the order holds them), returns gift-card money to the card first, takes back a gift card the
 * order bought, and records what was refunded to the wallet (done by hand in the eSewa merchant
 * portal) with its reference.
 */
export async function refundOrder(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const id = str(form, "orderId");
  const qty: Record<number, number> = {};
  for (const k of form.keys()) if (k.startsWith("qty:")) qty[Number(k.slice(4))] = int(form, k) || 0;
  try {
    const res = await refundOrderAs(id, me.username, {
      qty,
      restock: form.get("restock") === "on",
      includeDelivery: form.get("includeDelivery") === "on",
      includeWrap: form.get("includeWrap") === "on",
      walletRef: str(form, "walletRef").slice(0, 80),
      note: str(form, "note").slice(0, 200),
    });
    if (!res) return { status: "error", message: "Order not found." };
    if (!res.ok) return { status: "error", message: res.message };
    const { message, ...detail } = res;
    await logStaff(me, "refund", id, detail);
    catalogueChanged();
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/gift-cards");
    return { status: "saved", message };
  } catch (e) {
    if (e instanceof StockShortError) return { status: "error", message: "Couldn't update stock. Try again." };
    throw e;
  }
}

/** Any staff: swap one piece for another size or colour of the same product (within 7 days, 14 for gifts; after that only the owner). */
export async function exchangeLine(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireStaff();
  const id = str(form, "orderId");
  try {
    const res = await exchangeOnePiece(id, { username: me.username, owner: me.role === "owner" }, { line: int(form, "line"), newSku: str(form, "newSku"), override: form.get("override") === "on" });
    if (!res) return { status: "error", message: "Order not found." };
    if (!res.ok) return { status: "error", message: res.message };
    const { message, ...detail } = res;
    await logStaff(me, "exchange", id, detail);
    catalogueChanged();
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath(`/helper/order/${id}`);
    return { status: "saved", message };
  } catch (e) {
    if (e instanceof StockShortError) return { status: "error", message: "That size has none left." };
    throw e;
  }
}

/** Owner: release an unpaid order's hold early (e.g. the customer asked to cancel before paying). */
export async function cancelUnpaid(form: FormData) {
  const me = await requireOwner();
  const id = str(form, "orderId");
  const number = await lockOrder(id, async (o, tx) => {
    if (o.status !== "awaiting_payment") return { save: false, result: null };
    await releaseHolds(tx, o, "order_release", me.username);
    o.status = "cancelled";
    o.events = [...(o.events ?? []), event(me.username, "Cancelled before payment")];
    return { save: true, result: o.number };
  });
  if (number) await logStaff(me, "cancelled unpaid order", id, { number });
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
    p.shortDescription = str(form, "shortDescription", 300) || p.shortDescription;
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
  const deltas = Object.values(changes);
  if (!deltas.length) return { status: "error", message: "Enter a + or − number for at least one size." };
  // The reason has to match the direction: new or returned pieces add, damaged or lost ones take off.
  if ((reason === "received" || reason === "returned") && deltas.some((n) => n < 0))
    return { status: "error", message: `${reason === "received" ? "Received" : "Returned"} pieces are added: use numbers above 0 (or choose another reason).` };
  if (reason === "damaged" && deltas.some((n) => n > 0)) return { status: "error", message: "Damaged or lost pieces are taken off: use numbers like −1." };
  const res = await adjustStockBy(slug, changes, { reason, ref: str(form, "note", 80) || null, actor: me.username });
  if (!res.ok) return { status: "error", message: `${res.sku} only has ${res.left}. Stock can't go below zero.` };
  await logStaff(me, "stock", slug, { reason, changes });
  const told = await notifyRestocked(res.restocked);
  catalogueChanged();
  return { status: "saved", message: told ? `Stock updated. We told ${told} ${told === 1 ? "person" : "people"} their size is back.` : "Stock updated." };
}

export type CountState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "preview";
      text: string;
      rows: CountRow[];
      /** The changes shown, sent back when applying so exactly these are made. */
      plan: string;
      unknown: string[];
      bad: string[];
      duplicates: string[];
      short: CountPlan["short"];
    }
  | { status: "saved"; message: string; problems: string[] };

/**
 * Any staff: a stock count (from a sheet or, later, an RFID reader): "SKU,count" per line,
 * counting every piece in the shop. Pieces held for orders are in that count but aren't free
 * to sell, so the new stock is counted − held. First shows the differences; applying makes
 * exactly those changes, skipping any size whose stock moved since (a sale meanwhile).
 */
export async function bulkCount(_prev: CountState, form: FormData): Promise<CountState> {
  const me = await requireStaff();

  if (form.get("apply") === "1") {
    const plan = readPlan(String(form.get("plan") ?? ""));
    if (!plan) return { status: "error", message: "Those changes couldn't be read. Paste the count and check the differences again." };
    const res = await applyCount(plan, me.username);
    await logStaff(me, "stock count", null, { changed: res.applied.length, moved: res.moved.map((m) => m.sku), failed: res.failed.map((f) => f.sku) });
    const told = await notifyRestocked(res.restocked);
    if (res.applied.length) catalogueChanged();
    const problems = [
      ...res.moved.map((m) => `${m.sku}: not changed. Its stock went from ${m.expected} to ${m.actual} after you checked (a sale or another change). Count it again.`),
      ...res.failed.map((f) => `${f.sku}: not changed, it ${f.message}.`),
    ];
    const n = res.applied.length;
    return {
      status: "saved",
      message: `Updated ${n} ${n === 1 ? "size" : "sizes"}.${told ? ` Told ${told} waiting ${told === 1 ? "person" : "people"}.` : ""}${problems.length ? ` ${problems.length} not changed:` : ""}`,
      problems,
    };
  }

  const text = str(form, "counts", 20000);
  const { counts, bad, duplicates } = parseCounts(text);
  if (!counts.size)
    return {
      status: "error",
      message: bad.length ? `None of the lines could be read (e.g. "${bad[0]}"). Paste one "SKU,count" per line, e.g. HOD01-BLA-M,4` : 'Paste one "SKU,count" per line, e.g. HOD01-BLA-M,4',
    };
  const [products, held] = await Promise.all([allProducts(), getDb().then((db) => heldBySku(db))]);
  const { rows, unknown, short } = planCount(counts, products, held);
  const plan = JSON.stringify(rows.map((r) => ({ sku: r.sku, now: r.now, delta: r.delta })));
  return { status: "preview", text, rows, plan, unknown, bad, duplicates, short };
}

const GENDERS: Gender[] = ["men", "women", "unisex"];
const FITS: Fit[] = ["oversized", "relaxed", "regular"];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Postgres "unique_violation", however the driver wraps it. */
const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code === "23505" || err?.cause?.code === "23505";
};

/** Owner: a new product from the admin form. Starts as a draft unless "Put it live" was chosen. */
export async function addProduct(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const name = str(form, "name", 80);
  if (!name) return { status: "error", message: "Give it a name." };
  const slug = slugify(str(form, "slug", 80) || name);
  if (!slug) return { status: "error", message: "The name needs some letters or numbers." };
  if (await findProduct(slug)) return { status: "error", message: `There's already a product at /product/${slug}. Change the name or link.` };

  const category = str(form, "category") as Category;
  if (!Object.hasOwn(CATEGORY_CODE, category)) return { status: "error", message: "Choose a category." };
  const price = int(form, "price");
  if (!(price > 0)) return { status: "error", message: "Enter a price in rupees." };
  const gender = (str(form, "gender") || "unisex") as Gender;
  if (!GENDERS.includes(gender)) return { status: "error", message: "Choose who it's for." };
  const fit = (str(form, "fit") || "regular") as Fit;
  if (!FITS.includes(fit)) return { status: "error", message: "Choose a fit." };

  let raw: unknown;
  try {
    raw = JSON.parse(str(form, "colours", 5000));
  } catch {
    raw = [];
  }
  const list = (Array.isArray(raw) ? raw : []) as Partial<Record<keyof Colour, unknown>>[];
  if (list.length > 20) return { status: "error", message: "Add at most 20 colours." };
  const colours: Colour[] = [];
  for (const c of list) {
    const cname = typeof c?.name === "string" ? c.name.trim() : "";
    if (!cname) continue;
    if (cname.length > 30) return { status: "error", message: `Keep colour names to 30 characters ("${cname.slice(0, 30)}…").` };
    const hex = typeof c.hex === "string" ? c.hex : "";
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return { status: "error", message: `Pick a swatch colour for ${cname}.` };
    if (colours.some((x) => x.name.toLowerCase() === cname.toLowerCase())) return { status: "error", message: `"${cname}" is in the colours twice. Give each colour its own name.` };
    colours.push({ name: cname, hex: hex.toLowerCase() });
  }
  if (!colours.length) return { status: "error", message: "Add at least one colour." };

  const sizes = SIZE_ORDER.filter((s) => form.get(`size:${s}`) === "on");
  if (!sizes.length) return { status: "error", message: "Tick at least one size." };

  const measurements: Measurements = {};
  for (const s of sizes) {
    const m: NonNullable<Measurements[Size]> = {};
    for (const k of ["chest", "length", "sleeve", "waist", "inseam"] as const) {
      const n = int(form, `m:${s}:${k}`);
      if (n > 0 && n <= 500) m[k] = n;
    }
    if (Object.keys(m).length) measurements[s] = m;
  }

  // A drop that hasn't started yet: the piece waits for it ("scheduled"), even if "Put it live" was ticked.
  const dropSlug = str(form, "drop", 20) || null;
  const drop = dropSlug ? (await allDrops()).find((d) => d.slug === dropSlug) : undefined;
  if (dropSlug && !drop) return { status: "error", message: "That drop doesn't exist any more. Choose another." };
  const live = form.get("publish") === "on";
  const waitsForDrop = live && !!drop && Date.parse(drop.releaseAt) > Date.now();

  // Codes: the next free number for the category, and a code per colour unique within this product.
  const db = await getDb();
  const existing = (await db.select({ sku: schema.variants.sku }).from(schema.variants)).map((r) => r.sku);
  const code = nextProductCode(category, existing);
  const colourCode = new Map(colourCodes(colours.map((c) => c.name)).map((cc, i) => [colours[i].name, cc]));
  const variants = colours.flatMap((c) =>
    sizes.map((s) => {
      const n = int(form, `stock:${c.name}:${s}`);
      return { sku: `${code}-${colourCode.get(c.name)}-${s}`, size: s, colour: c.name, stock: n > 0 ? Math.min(n, 100_000) : 0 };
    }),
  );

  // Everything checks out: only now upload the photo, then add the product (all or nothing).
  const images: Product["images"] = [];
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const saved = await saveProductPhoto(slug, photo);
    if (!saved.ok) return { status: "error", message: saved.message };
    images.push({ src: saved.src, alt: `${name}, front`, kind: "front" });
  } else {
    images.push({ src: null, alt: `${name}, front`, kind: "front" });
  }

  try {
    await createProduct({
      id: randomUUID(),
      slug,
      name,
      category,
      gender,
      fit,
      dropSlug,
      shortDescription: str(form, "shortDescription", 300),
      details: str(form, "details", 20 * 202)
        .split("\n")
        .map((l) => l.trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 20),
      tags: [],
      colours,
      images,
      price,
      measurements,
      variants,
      status: waitsForDrop ? "scheduled" : live ? "live" : "draft",
      showOn: { website: true, kiosk: true },
    });
  } catch (e) {
    // Someone added a product with the same link or code at the same moment; nothing was saved.
    if (isUniqueViolation(e)) return { status: "error", message: "Another product was just added with the same link or code. Press Add product again." };
    throw e;
  }
  await logStaff(me, "added product", slug, { price, live, scheduled: waitsForDrop || undefined });
  catalogueChanged();
  redirect(`/admin/products/${slug}?added=${waitsForDrop ? "scheduled" : "1"}`);
}

// ---------- Drops (owner) ----------

export async function saveDropAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const slug = str(form, "slug").replace(/[^0-9a-z-]/gi, "").slice(0, 20);
  const name = str(form, "name", 60);
  const story = str(form, "story", 400);
  const local = str(form, "releaseAt"); // yyyy-mm-ddThh:mm, Kathmandu
  const isNew = str(form, "mode") !== "edit";
  if (!slug || !name) return { status: "error", message: "Give the drop a number and a name." };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || Number.isNaN(Date.parse(`${local}:00+05:45`))) return { status: "error", message: "Pick the release date and time." };
  const releaseAt = new Date(`${local}:00+05:45`).toISOString();
  // A new drop never overwrites one that's already there.
  const exists = (await allDrops()).some((d) => d.slug === slug);
  if (isNew && exists) return { status: "error", message: `Drop ${slug} already exists. Use another number, or edit it from the list.` };
  if (!isNew && !exists) return { status: "error", message: "That drop isn't there any more. Reload the page." };
  const pieces = [...new Set(form.getAll("products").map(String))].slice(0, 500);
  await saveDrop({ slug, name, story, releaseAt }, pieces);
  await logStaff(me, isNew ? "created drop" : "saved drop", slug, { releaseAt, pieces: pieces.length });
  catalogueChanged();
  return { status: "saved", message: `Saved ${name}.` };
}

// ---------- Gift cards (owner) ----------

export async function blockGiftCardAction(form: FormData) {
  const me = await requireOwner();
  const code = normaliseCode(str(form, "code", 40));
  if (!code) return;
  await blockGiftCard(code);
  await logStaff(me, "blocked gift card", code);
  revalidatePath("/admin/gift-cards");
}

// ---------- Festivals (owner) ----------

/** A real calendar day written yyyy-mm-dd. */
const isDay = (d: string) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(t) && new Date(t).toISOString().startsWith(d);
};

export async function saveFestivalList(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const names = form.getAll("name").map(String);
  const dates = form.getAll("date").map(String);
  const orderBys = form.getAll("orderBy").map(String);
  const rows = names
    .map((name, i) => ({ name: name.trim(), date: String(dates[i] ?? "").trim(), orderBy: String(orderBys[i] ?? "").trim() }))
    .filter((f) => f.name || f.date || f.orderBy); // an empty row is just left out
  if (rows.length > 50) return { status: "error", message: "Keep it to 50 festivals." };
  for (const f of rows) {
    if (!f.name || !f.date || !f.orderBy) return { status: "error", message: "Fill in the name and both days for every festival, or remove the row." };
    if (f.name.length > 60) return { status: "error", message: "Keep festival names to 60 characters." };
    if (!isDay(f.date) || !isDay(f.orderBy)) return { status: "error", message: `Pick the days for ${f.name} from the calendar.` };
    if (f.orderBy > f.date) return { status: "error", message: "The order-by day has to be on or before the festival." };
  }
  await saveFestivals(rows.map((f) => ({ id: randomUUID(), ...f })));
  await logStaff(me, "saved festivals", null, { count: rows.length });
  revalidatePath("/", "layout");
  return { status: "saved", message: "Saved." };
}
