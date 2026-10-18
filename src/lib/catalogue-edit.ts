import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";

import { findProduct, updateProduct } from "./catalogue";
import { getDb, schema } from "./db";
import { colourCodes } from "./sku";
import type { Colour, Size } from "./types";

// Editing a piece after it was made (owner, 18 Oct 2026: "every control on the admin"): its colours
// and sizes, its place in the shop, and deleting a draft. Sizes and colours are rows in `variants`
// keyed by SKU; orders, stock history and restock requests point at those SKUs, so nothing that has
// been sold or counted is ever deleted, and a colour is renamed everywhere at once.

export type EditResult = { ok: true; message: string } | { ok: false; message: string };

const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

/** The product code ("TEE03") and each colour's code ("BLA") from a product's existing SKUs. */
function codesOf(variants: { sku: string; colour: string }[]) {
  const product = variants[0]?.sku.split("-")[0] ?? "";
  const colour = new Map<string, string>();
  for (const v of variants) if (!colour.has(v.colour)) colour.set(v.colour, v.sku.split("-")[1] ?? "");
  return { product, colour };
}

/** Adds colours and/or sizes: every new colour × size pair becomes a SKU with no stock. */
export async function addVariants(slug: string, add: { colours?: Colour[]; sizes?: Size[] }): Promise<EditResult> {
  const p = await findProduct(slug);
  if (!p) return { ok: false, message: "Product not found." };
  if (!p.variants.length) return { ok: false, message: "This piece has no sizes yet." };
  const newColours = (add.colours ?? []).filter((c) => c.name.trim() && !p.colours.some((x) => x.name.toLowerCase() === c.name.trim().toLowerCase()));
  const newSizes = (add.sizes ?? []).filter((s) => SIZE_ORDER.includes(s) && !p.variants.some((v) => v.size === s));
  if (!newColours.length && !newSizes.length) return { ok: false, message: "Nothing new to add." };
  if (p.colours.length + newColours.length > 20) return { ok: false, message: "Keep it to 20 colours." };

  const { product: code, colour: codes } = codesOf(p.variants);
  const taken = new Set(codes.values());
  for (const c of newColours) {
    let base = colourCodes([c.name.trim()])[0] || "C";
    let n = 2;
    while (taken.has(base)) base = `${colourCodes([c.name.trim()])[0]}${n++}`;
    taken.add(base);
    codes.set(c.name.trim(), base);
  }
  const allColours = [...p.colours.map((c) => c.name), ...newColours.map((c) => c.name.trim())];
  const allSizes = SIZE_ORDER.filter((s) => p.variants.some((v) => v.size === s) || newSizes.includes(s));
  const rows = allColours.flatMap((colour) =>
    allSizes
      .filter((size) => !p.variants.some((v) => v.colour === colour && v.size === size))
      .map((size) => ({ sku: `${code}-${codes.get(colour)}-${size}`, productSlug: slug, size, colour, stock: 0, lastPieceOnFloor: false, position: 0 })),
  );
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${schema.variants.position}), 0)` }).from(schema.variants).where(eq(schema.variants.productSlug, slug));
    if (rows.length) await tx.insert(schema.variants).values(rows.map((r, i) => ({ ...r, position: Number(max) + 1 + i }))).onConflictDoNothing();
  });
  if (newColours.length)
    await updateProduct(slug, (x) => {
      x.colours = [...x.colours, ...newColours.map((c) => ({ name: c.name.trim(), hex: c.hex.toLowerCase() }))];
    });
  return { ok: true, message: `Added ${rows.length} ${rows.length === 1 ? "size" : "sizes"} with no stock yet. Add their stock below.` };
}

/** Why a SKU can't be removed, or null when it can (no stock, never sold, nobody waiting). */
async function blocked(skus: string[]): Promise<string | null> {
  if (!skus.length) return null;
  const db = await getDb();
  const [withStock] = await db.select({ n: sql<number>`count(*)` }).from(schema.variants).where(and(inArray(schema.variants.sku, skus), gt(schema.variants.stock, 0)));
  if (Number(withStock.n)) return "Some of these still have stock. Take it off first (Stock tab, reason Damaged or Count).";
  const [sold] = await db.select({ n: sql<number>`count(*)` }).from(schema.orderLines).where(inArray(schema.orderLines.sku, skus));
  if (Number(sold.n)) return "Some of these have been ordered, so they stay for the records. Leave their stock at 0 instead.";
  const [waiting] = await db.select({ n: sql<number>`count(*)` }).from(schema.restockAlerts).where(and(inArray(schema.restockAlerts.sku, skus), isNull(schema.restockAlerts.notifiedAt)));
  if (Number(waiting.n)) return "People are waiting for these to come back. Keep them, or restock them.";
  return null;
}

/** Removes a colour or a size (every SKU of it), only when none was ever sold, stocked or asked for. */
export async function removeVariants(slug: string, what: { colour?: string; size?: Size }): Promise<EditResult> {
  const p = await findProduct(slug);
  if (!p) return { ok: false, message: "Product not found." };
  const skus = p.variants.filter((v) => (what.colour ? v.colour === what.colour : v.size === what.size)).map((v) => v.sku);
  if (!skus.length) return { ok: false, message: "Nothing to remove." };
  if (skus.length === p.variants.length) return { ok: false, message: "A piece needs at least one colour and one size." };
  const why = await blocked(skus);
  if (why) return { ok: false, message: why };
  const db = await getDb();
  await db.delete(schema.variants).where(inArray(schema.variants.sku, skus));
  if (what.colour)
    await updateProduct(slug, (x) => {
      x.colours = x.colours.filter((c) => c.name !== what.colour);
    });
  if (what.size)
    await updateProduct(slug, (x) => {
      delete x.measurements[what.size!];
    });
  return { ok: true, message: what.colour ? `${what.colour} removed.` : `Size ${what.size} removed.` };
}

/** Renames a colour and/or changes its swatch: the product, its sizes and anyone waiting on it, at once. Codes on tags stay. */
export async function editColour(slug: string, from: string, next: Colour): Promise<EditResult> {
  const p = await findProduct(slug);
  if (!p) return { ok: false, message: "Product not found." };
  const name = next.name.trim();
  if (!name) return { ok: false, message: "Give the colour a name." };
  if (name.length > 30) return { ok: false, message: "Keep colour names to 30 characters." };
  if (!/^#[0-9a-fA-F]{6}$/.test(next.hex)) return { ok: false, message: "Pick a swatch colour." };
  if (!p.colours.some((c) => c.name === from)) return { ok: false, message: "That colour isn't on this piece any more." };
  if (name !== from && p.colours.some((c) => c.name.toLowerCase() === name.toLowerCase())) return { ok: false, message: `"${name}" is already a colour of this piece.` };
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (name !== from) {
      await tx.update(schema.variants).set({ colour: name }).where(and(eq(schema.variants.productSlug, slug), eq(schema.variants.colour, from)));
      await tx.update(schema.restockAlerts).set({ colour: name }).where(and(eq(schema.restockAlerts.slug, slug), eq(schema.restockAlerts.colour, from)));
    }
  });
  await updateProduct(slug, (x) => {
    x.colours = x.colours.map((c) => (c.name === from ? { name, hex: next.hex.toLowerCase() } : c));
  });
  return { ok: true, message: name === from ? "Swatch changed." : `Renamed to ${name}.` };
}

/** Moves a piece in the shop order: to the top or bottom, or one place up or down. */
export async function movePiece(slug: string, to: "top" | "bottom" | "up" | "down"): Promise<EditResult> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [me] = await tx.select({ position: schema.products.position }).from(schema.products).where(eq(schema.products.slug, slug));
    if (!me) return { ok: false as const, message: "Product not found." };
    if (to === "top" || to === "bottom") {
      const [edge] = await tx.select({ v: to === "top" ? sql<number>`coalesce(min(${schema.products.position}), 0)` : sql<number>`coalesce(max(${schema.products.position}), 0)` }).from(schema.products);
      await tx.update(schema.products).set({ position: Number(edge.v) + (to === "top" ? -1 : 1) }).where(eq(schema.products.slug, slug));
      return { ok: true as const, message: to === "top" ? "Moved to the top of the shop." : "Moved to the end of the shop." };
    }
    const [other] = await tx
      .select({ slug: schema.products.slug, position: schema.products.position })
      .from(schema.products)
      .where(to === "up" ? lt(schema.products.position, me.position) : gt(schema.products.position, me.position))
      .orderBy(to === "up" ? desc(schema.products.position) : asc(schema.products.position))
      .limit(1);
    if (!other) return { ok: true as const, message: "It's already there." };
    await tx.update(schema.products).set({ position: other.position }).where(eq(schema.products.slug, slug));
    await tx.update(schema.products).set({ position: me.position }).where(eq(schema.products.slug, other.slug));
    return { ok: true as const, message: to === "up" ? "Moved up one place." : "Moved down one place." };
  });
}

/** Deletes a draft or archived piece that was never ordered and has no stock. */
export async function deletePiece(slug: string): Promise<EditResult> {
  const p = await findProduct(slug);
  if (!p) return { ok: false, message: "Product not found." };
  if (p.status !== "draft" && p.status !== "archived") return { ok: false, message: "Only drafts and archived pieces can be deleted. Set it to Draft or Archived first." };
  const db = await getDb();
  const [sold] = await db.select({ n: sql<number>`count(*)` }).from(schema.orderLines).where(eq(schema.orderLines.slug, slug));
  if (Number(sold.n)) return { ok: false, message: "This piece has been ordered, so it stays for the records. Archive it instead." };
  if (p.variants.some((v) => v.stock > 0)) return { ok: false, message: "It still has stock. Take the stock off first." };
  await db.delete(schema.products).where(eq(schema.products.slug, slug));
  await db.delete(schema.restockAlerts).where(eq(schema.restockAlerts.slug, slug));
  return { ok: true, message: `${p.name} deleted.` };
}
