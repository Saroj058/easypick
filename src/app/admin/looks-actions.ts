"use server";

import { revalidatePath, updateTag } from "next/cache";

import { findProduct } from "@/lib/catalogue";
import { LOOKS_TAG, readSavedLooks, saveLooks } from "@/lib/looks";
import { saveProductPhoto } from "@/lib/photos";
import { OCCASIONS, type OccasionKey, type SavedLooks } from "@/lib/occasions";
import { logStaff, requireOwner } from "@/lib/staff";
import type { SaveState } from "./actions";

/** Owner only: the pieces for each "Designer Fits" look on the home page. Empty slots are picked automatically. */
export async function saveLooksForm(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const looks: SavedLooks = {};
  // Photos are saved on their own (below): keep them.
  const before = await readSavedLooks();

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
    const photo = before[o.key]?.photo;
    if (pieces.length || photo) looks[o.key] = { pieces, ...(photo ? { photo } : {}) };
  }

  await saveLooks(looks);
  await logStaff(me, "saved looks", null, { set: Object.keys(looks) });
  updateTag(LOOKS_TAG);
  revalidatePath("/");
  revalidatePath("/drops");
  revalidatePath("/fits");
  return { status: "saved", message: "Saved. The Fits page shows these looks." };
}

/** Owner only: a photo of one fit being worn (or, with "remove", takes it off). */
export async function saveFitPhoto(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const key = String(form.get("key") ?? "") as OccasionKey;
  const fit = OCCASIONS.find((o) => o.key === key);
  if (!fit) return { status: "error", message: "That fit doesn't exist." };
  const looks = await readSavedLooks();
  const mine = looks[key] ?? { pieces: [] };
  if (form.get("remove") === "1") {
    delete mine.photo;
  } else {
    const file = form.get("photo");
    if (!(file instanceof File) || !file.size) return { status: "error", message: "Pick a photo first." };
    const saved = await saveProductPhoto(`fit-${key}`, file);
    if (!saved.ok) return { status: "error", message: saved.message };
    mine.photo = saved.src;
  }
  if (mine.pieces.length || mine.photo) looks[key] = mine;
  else delete looks[key];
  await saveLooks(looks);
  await logStaff(me, mine.photo ? "saved fit photo" : "removed fit photo", null, { fit: key });
  updateTag(LOOKS_TAG);
  revalidatePath("/fits");
  revalidatePath("/admin/looks");
  return { status: "saved", message: mine.photo ? `${fit.label}: photo saved.` : `${fit.label}: photo removed.` };
}
