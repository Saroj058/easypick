"use server";

import { revalidatePath, updateTag } from "next/cache";

import { findProduct } from "@/lib/catalogue";
import { LOOKS_TAG, saveLooks } from "@/lib/looks";
import { OCCASIONS, type SavedLooks } from "@/lib/occasions";
import { logStaff, requireOwner } from "@/lib/staff";
import type { SaveState } from "./actions";

/** Owner only: the pieces for each "Wear it to…" look on the home page. Empty slots are picked automatically. */
export async function saveLooksForm(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const looks: SavedLooks = {};

  for (const o of OCCASIONS) {
    const pieces: { slug: string; colour: string }[] = [];
    for (let i = 0; i < 4; i++) {
      const raw = String(form.get(`${o.key}.${i}`) ?? "");
      if (!raw) continue;
      const [slug, colour] = raw.split("~");
      const product = await findProduct(slug);
      if (!product || !product.colours.some((c) => c.name === colour)) return { status: "error", message: `${o.label}: one of the pieces no longer exists. Pick it again.` };
      if (pieces.some((p) => p.slug === slug)) return { status: "error", message: `${o.label}: the same piece is picked twice.` };
      pieces.push({ slug, colour });
    }
    if (pieces.length === 1) return { status: "error", message: `${o.label}: pick at least two pieces, or none to let the site choose.` };
    if (pieces.length) looks[o.key] = { pieces };
  }

  await saveLooks(looks);
  await logStaff(me, "saved looks", null, { set: Object.keys(looks) });
  updateTag(LOOKS_TAG);
  revalidatePath("/");
  return { status: "saved", message: "Saved. The home page shows these looks." };
}
