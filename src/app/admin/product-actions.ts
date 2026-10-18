"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { findProduct, updateProduct } from "@/lib/catalogue";
import { addVariants, deletePiece, editColour, movePiece, removeVariants } from "@/lib/catalogue-edit";
import { saveProductPhoto } from "@/lib/photos";
import { CATEGORY_CODE } from "@/lib/sku";
import { logStaff, requireOwner } from "@/lib/staff";
import type { Category, Measurements, Product, Size } from "@/lib/types";
import type { SaveState } from "./actions";

// The product editor's tabs (owner, 18 Oct 2026): photos, colours & sizes, measurements and the
// rest of a piece's settings, each saved on its own so no one screen does too much.

const KINDS = ["front", "back", "detail", "model", "styled"] as const;
const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

function changed(slug?: string) {
  updateTag("catalogue");
  updateTag("trending");
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/admin/products/${slug}`);
}

// ---------- Photos ----------

export async function uploadPhotoAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const slug = str(form, "slug");
  const kind = (KINDS as readonly string[]).includes(str(form, "kind")) ? (str(form, "kind") as Product["images"][number]["kind"]) : "front";
  const p = await findProduct(slug);
  if (!p) return { status: "error", message: "Product not found." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a photo first." };
  if (p.images.filter((i) => i.src).length >= 12) return { status: "error", message: "Keep it to 12 photos. Remove one first." };
  const saved = await saveProductPhoto(slug, file, kind);
  if (!saved.ok) return { status: "error", message: saved.message };
  await updateProduct(slug, (x) => {
    const img = { src: saved.src, alt: `${x.name}, ${kind}`, kind };
    // A new front photo takes the front's place; anything else joins the end.
    const at = kind === "front" ? x.images.findIndex((i) => i.kind === "front") : x.images.findIndex((i) => !i.src && i.kind === kind);
    if (at >= 0) x.images[at] = img;
    else if (kind === "front") x.images.unshift(img);
    else x.images.push(img);
  });
  await logStaff(me, "added a photo", slug, { kind });
  changed(slug);
  return { status: "saved", message: "Photo added." };
}

/** The order, kind, alt text and focus point of every photo, and which to remove. */
export async function savePhotosAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const slug = str(form, "slug");
  const p = await findProduct(slug);
  if (!p) return { status: "error", message: "Product not found." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data") ?? "[]"));
  } catch {
    return { status: "error", message: "That didn't come through. Try again." };
  }
  const known = new Set(p.images.map((i) => i.src).filter(Boolean));
  const list = (Array.isArray(raw) ? raw : []).flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const src = typeof o.src === "string" ? o.src : null;
    if (!src || !known.has(src)) return [];
    const kind = (KINDS as readonly string[]).includes(String(o.kind)) ? (o.kind as Product["images"][number]["kind"]) : "detail";
    const f = (o.focus ?? {}) as Record<string, unknown>;
    const fx = Number(f.x);
    const fy = Number(f.y);
    const focus = Number.isFinite(fx) && Number.isFinite(fy) ? { x: Math.min(1, Math.max(0, fx)), y: Math.min(1, Math.max(0, fy)) } : undefined;
    return [{ src, kind, alt: typeof o.alt === "string" && o.alt.trim() ? o.alt.trim().slice(0, 140) : `${p.name}, ${kind}`, ...(focus ? { focus } : {}) }];
  });
  await updateProduct(slug, (x) => {
    // With every photo removed, the piece shows its drawn stand-in again.
    x.images = list.length ? list : [{ src: null, alt: `${x.name}, front`, kind: "front" }];
  });
  await logStaff(me, "arranged photos", slug, { photos: list.length, removed: known.size - list.length || undefined });
  changed(slug);
  return { status: "saved", message: "Saved. The first photo is the one shown everywhere." };
}

export async function uploadCutoutAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const slug = str(form, "slug");
  if (!(await findProduct(slug))) return { status: "error", message: "Product not found." };
  if (form.get("remove") === "1") {
    await updateProduct(slug, (x) => {
      delete x.cutout;
    });
    await logStaff(me, "removed the cut-out", slug);
    changed(slug);
    return { status: "saved", message: "Cut-out removed." };
  }
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a PNG or WebP with a clear background." };
  if (file.type === "image/jpeg") return { status: "error", message: "A cut-out needs a clear background: use a PNG or WebP, not a JPG." };
  const saved = await saveProductPhoto(slug, file, "cutout");
  if (!saved.ok) return { status: "error", message: saved.message };
  await updateProduct(slug, (x) => {
    x.cutout = saved.src;
  });
  await logStaff(me, "added a cut-out", slug);
  changed(slug);
  return { status: "saved", message: "Cut-out added. The piece can now turn in the home hero." };
}

// ---------- Colours & sizes ----------

export async function variantsAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const slug = str(form, "slug");
  const op = str(form, "op");
  const size = str(form, "size") as Size;
  let r;
  if (op === "addColour") r = await addVariants(slug, { colours: [{ name: str(form, "name", 30), hex: str(form, "hex", 7) || "#888888" }] });
  else if (op === "addSize") r = SIZES.includes(size) ? await addVariants(slug, { sizes: [size] }) : { ok: false as const, message: "Choose a size." };
  else if (op === "removeColour") r = await removeVariants(slug, { colour: str(form, "colour", 30) });
  else if (op === "removeSize") r = SIZES.includes(size) ? await removeVariants(slug, { size }) : { ok: false as const, message: "Choose a size." };
  else if (op === "editColour") r = await editColour(slug, str(form, "from", 30), { name: str(form, "name", 30), hex: str(form, "hex", 7) });
  else return { status: "error", message: "Unknown change." };
  if (!r.ok) return { status: "error", message: r.message };
  await logStaff(me, "changed colours or sizes", slug, { op, colour: str(form, "name", 30) || str(form, "colour", 30) || undefined, size: size || undefined });
  changed(slug);
  return { status: "saved", message: r.message };
}

export async function measurementsAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const slug = str(form, "slug");
  const p = await findProduct(slug);
  if (!p) return { status: "error", message: "Product not found." };
  const m: Measurements = {};
  for (const s of SIZES) {
    const row: NonNullable<Measurements[Size]> = {};
    for (const k of ["chest", "length", "sleeve", "waist", "inseam"] as const) {
      const n = Math.round(Number(str(form, `m:${s}:${k}`)));
      if (n > 0 && n <= 500) row[k] = n;
    }
    if (Object.keys(row).length && p.variants.some((v) => v.size === s)) m[s] = row;
  }
  await updateProduct(slug, (x) => {
    x.measurements = m;
  });
  await logStaff(me, "saved measurements", slug, { sizes: Object.keys(m).join(", ") || "none" });
  changed(slug);
  return { status: "saved", message: "Measurements saved. The size chart and hang tag use them now." };
}

// ---------- More: kind, where it shows, tags, shop order, delete ----------

export async function moreAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const slug = str(form, "slug");
  const p = await findProduct(slug);
  if (!p) return { status: "error", message: "Product not found." };
  const category = str(form, "category") as Category;
  if (!Object.hasOwn(CATEGORY_CODE, category)) return { status: "error", message: "Choose a kind." };
  const website = form.get("website") === "on";
  const kiosk = form.get("kiosk") === "on";
  const tags = str(form, "tags", 600)
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 30))
    .filter(Boolean);
  const modelNote = str(form, "modelNote", 140);
  await updateProduct(slug, (x) => {
    x.category = category;
    x.showOn = { website, kiosk };
    x.tags = [...new Set(tags)].slice(0, 30);
    x.modelNote = modelNote || undefined;
  });
  await logStaff(me, "edited product settings", slug, { category: p.category !== category ? [p.category, category] : undefined, website, kiosk });
  changed(slug);
  return { status: "saved", message: p.category !== category ? "Saved. Its codes on tags stay as they were." : "Saved." };
}

export async function moveAction(form: FormData) {
  const me = await requireOwner();
  const slug = str(form, "slug");
  const to = str(form, "to") as "top" | "bottom" | "up" | "down";
  if (!["top", "bottom", "up", "down"].includes(to)) return;
  const r = await movePiece(slug, to);
  if (r.ok) {
    await logStaff(me, "moved in the shop", slug, { to });
    changed(slug);
  }
}

export async function deleteAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const slug = str(form, "slug");
  if (str(form, "confirm").toLowerCase() !== "delete") return { status: "error", message: 'Type "delete" to confirm.' };
  const r = await deletePiece(slug);
  if (!r.ok) return { status: "error", message: r.message };
  await logStaff(me, "deleted product", slug);
  changed();
  redirect("/admin/products");
}
