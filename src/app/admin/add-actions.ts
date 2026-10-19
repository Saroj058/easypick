"use server";

import { revalidatePath, updateTag } from "next/cache";

import { describeAvailable, describePhoto, type Described } from "@/lib/ai/describe";
import { findProduct } from "@/lib/catalogue";
import { LOOKS_TAG, readSavedLooks, saveLooks } from "@/lib/looks";
import { OCCASIONS, type OccasionKey } from "@/lib/occasions";
import { sniffImage } from "@/lib/photos";
import { kindsSetting } from "@/lib/settings/categories";
import { kindView } from "@/lib/settings/categories-rules";
import { logStaff, requireOwner } from "@/lib/staff";

// The helpers behind the smart "Add a piece" page (owner, 19 Oct 2026).

export type DescribeResult = { ok: true; data: Described } | { ok: false; message: string };

/** Suggestions for the fields from the front photo (a small JPEG the browser made). */
export async function describePhotoAction(form: FormData): Promise<DescribeResult> {
  await requireOwner();
  if (!describeAvailable()) return { ok: false, message: "Filling in from the photo isn't switched on here. Type the details instead." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0 || file.size > 1_500_000) return { ok: false, message: "Add a photo first." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) return { ok: false, message: "That photo couldn't be read. Try a JPG or PNG." };
  const kv = kindView(await kindsSetting.getForAdmin());
  const data = await describePhoto({ base64: Buffer.from(bytes).toString("base64"), mime }, kv.all.map((id) => ({ id, label: kv.name(id) })));
  if (!data || !Object.keys(data).length) return { ok: false, message: "Couldn't read the photo just now. Try again in a minute, or type the details." };
  return { ok: true, data };
}

/** Puts a newly added piece into one of the Designer Fits (up to four pieces in a fit). */
export async function addToLookAction(slug: string, colour: string, key: string): Promise<{ ok: boolean; message: string }> {
  const me = await requireOwner();
  const occasion = OCCASIONS.find((o) => o.key === key);
  const p = await findProduct(slug);
  if (!occasion || !p || !p.colours.some((c) => c.name === colour)) return { ok: false, message: "That fit or piece isn't there any more." };
  const looks = await readSavedLooks();
  const look = looks[key as OccasionKey] ?? { pieces: [] };
  if (look.pieces.some((x) => x.slug === slug)) return { ok: true, message: `Already in ${occasion.label}.` };
  if (look.pieces.length >= 4) return { ok: false, message: `${occasion.label} already has four pieces. Change it in Designer Fits.` };
  looks[key as OccasionKey] = { ...look, pieces: [...look.pieces, { slug, colour }] };
  await saveLooks(looks);
  await logStaff(me, "added a piece to a fit", slug, { fit: key });
  updateTag(LOOKS_TAG);
  revalidatePath("/");
  revalidatePath("/fits");
  return {
    ok: true,
    message: looks[key as OccasionKey]!.pieces.length < 2 ? `Added to ${occasion.label}. A fit shows once it has two pieces.` : `Added to ${occasion.label}.`,
  };
}
