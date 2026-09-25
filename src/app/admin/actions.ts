"use server";

import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createProduct, findProduct, notifyRestocked, saveFestivals, setStock, updateProduct } from "@/lib/catalogue";
import { notifySms } from "@/lib/notify";
import { findOrder, updateOrder } from "@/lib/orders";
import { checkAdminLogin, endAdminSession, requireStaff, startAdminSession } from "@/lib/staff";
import type { Category, Colour, Fit, Gender, Measurements, Product, ProductStatus, Size } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => {
  const n = Number(str(f, k));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

// ---------- Staff login ----------

export type LoginState = { status: "idle" } | { status: "error"; message: string; username: string };

// Slows down guessing: 5 wrong tries per address, then a 15-minute wait.
const tries = new Map<string, { n: number; since: number }>();
const WINDOW = 15 * 60_000;

export async function signInAdmin(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = str(form, "username");
  const password = String(form.get("password") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";

  const t = tries.get(ip);
  const cur = !t || Date.now() - t.since > WINDOW ? { n: 0, since: Date.now() } : t;
  if (cur.n >= 5) return { status: "error", message: "Too many tries. Wait 15 minutes, then try again.", username };

  if (!checkAdminLogin(username, password)) {
    cur.n++;
    tries.set(ip, cur);
    return { status: "error", message: "That username and password don't match.", username };
  }
  tries.delete(ip);
  await startAdminSession(username);
  redirect("/admin");
}

export async function signOutAdmin() {
  await endAdminSession();
  redirect("/admin/login");
}

// ---------- Orders ----------

export type OrderStep = "packed" | "ready" | "completed";

/** Moves an order one step on and tells the customer when there's something for them to do. */
export async function setOrderStep(form: FormData) {
  await requireStaff();
  const id = str(form, "orderId");
  const step = str(form, "step") as OrderStep;
  const order = findOrder(id);
  if (!order || order.status === "awaiting_payment" || order.status === "expired") return;
  const now = new Date().toISOString();

  updateOrder(id, (o) => {
    if (step === "packed") {
      o.packedAt ??= now;
      if (o.gift) o.gift.packedAt ??= now;
    } else if (step === "ready") {
      o.packedAt ??= now;
      o.readyAt = now;
      o.status = o.method === "pickup" ? "ready_for_pickup" : "out_for_delivery";
    } else if (step === "completed") {
      o.completedAt = now;
      o.status = "completed";
      if (o.gift) {
        o.gift.deliveredAt = now;
        o.gift.status = "delivered";
      }
    }
  });

  if (step === "ready" && !order.gift) {
    await notifySms(
      order.phone,
      order.method === "pickup"
        ? `Easypick: order ${order.number} is ready at the counter. Bring this number.`
        : `Easypick: order ${order.number} is on the way. The rider will call before arriving.`,
    );
  }
  revalidatePath("/admin", "layout");
}

// ---------- Products ----------

export type SaveState = { status: "idle" } | { status: "saved"; message: string } | { status: "error"; message: string };

const STATUSES: ProductStatus[] = ["draft", "scheduled", "live", "sold_out", "archived"];

/** Price, status and stock counts for one product. Tells anyone waiting on a size that came back. */
export async function saveProduct(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requireStaff();
  const slug = str(form, "slug");
  const product = findProduct(slug);
  if (!product) return { status: "error", message: "Product not found." };

  const price = int(form, "price");
  const saleRaw = str(form, "salePrice");
  const salePrice = saleRaw ? int(form, "salePrice") : undefined;
  const status = str(form, "status") as ProductStatus;
  if (!(price > 0)) return { status: "error", message: "Enter a price." };
  if (salePrice !== undefined && !(salePrice > 0 && salePrice < price)) return { status: "error", message: "Sale price must be lower than the price." };
  if (!STATUSES.includes(status)) return { status: "error", message: "Choose a status." };

  const counts: Record<string, number> = {};
  for (const v of product.variants) {
    const n = int(form, `stock:${v.sku}`);
    if (Number.isNaN(n) || n < 0) return { status: "error", message: `Stock for ${v.colour} ${v.size} must be 0 or more.` };
    counts[v.sku] = n;
  }

  updateProduct(slug, (p) => {
    p.price = price;
    p.salePrice = salePrice;
    p.status = status;
    p.shortDescription = str(form, "shortDescription") || p.shortDescription;
  });
  const restocked = setStock(slug, counts);
  const told = await notifyRestocked(restocked);

  revalidatePath("/", "layout");
  return { status: "saved", message: told ? `Saved. We told ${told} ${told === 1 ? "person" : "people"} their size is back.` : "Saved." };
}

const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
const CATEGORY_CODE: Record<Category, string> = { tees: "TEE", hoodies: "HOD", jackets: "JKT", bottoms: "BTM", "co-ords": "COR", accessories: "ACC" };

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** A new product from the admin form. Starts as a draft unless "Put it live" was chosen. */
export async function addProduct(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requireStaff();
  const name = str(form, "name");
  if (!name) return { status: "error", message: "Give it a name." };
  const slug = slugify(str(form, "slug") || name);
  if (!slug) return { status: "error", message: "The name needs some letters or numbers." };
  if (findProduct(slug)) return { status: "error", message: `There's already a product at /product/${slug}. Change the name or link.` };

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

  const sizes = SIZES.filter((s) => form.get(`size:${s}`) === "on");
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

  // Photo: saved next to the others in /public/products/<slug>/front.jpg.
  // Fine for the pilot on one machine; moves to image storage with the Store API.
  const images: Product["images"] = [];
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!/^image\/(jpeg|png|webp)$/.test(photo.type)) return { status: "error", message: "The photo must be a JPG, PNG or WebP." };
    if (photo.size > 8 * 1024 * 1024) return { status: "error", message: "The photo must be under 8 MB." };
    const ext = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const dir = join(process.cwd(), "public", "products", slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `front.${ext}`), Buffer.from(await photo.arrayBuffer()));
    images.push({ src: `/products/${slug}/front.${ext}`, alt: `${name}, front`, kind: "front" });
  } else {
    images.push({ src: null, alt: `${name}, front`, kind: "front" });
  }

  const live = form.get("publish") === "on";
  createProduct({
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

  revalidatePath("/", "layout");
  redirect(`/admin/products/${slug}?added=1`);
}

// ---------- Festivals ----------

export async function saveFestivalList(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requireStaff();
  const names = form.getAll("name").map(String);
  const dates = form.getAll("date").map(String);
  const orderBys = form.getAll("orderBy").map(String);
  const list = names
    .map((name, i) => ({ id: randomUUID(), name: name.trim(), date: dates[i], orderBy: orderBys[i] }))
    .filter((f) => f.name && f.date && f.orderBy);
  if (list.some((f) => f.orderBy > f.date)) return { status: "error", message: "The order-by day has to be on or before the festival." };
  saveFestivals(list);
  revalidatePath("/", "layout");
  return { status: "saved", message: "Saved." };
}
