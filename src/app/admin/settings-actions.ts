"use server";

import { revalidatePath, updateTag } from "next/cache";

import { saveProductPhoto } from "@/lib/photos";
import { kindsSetting } from "@/lib/settings/categories";
import { homeSetting } from "@/lib/settings/home";
import { siteSetting } from "@/lib/settings/site";
import { vaultSetting } from "@/lib/settings/vault";
import { logStaff, requireOwner } from "@/lib/staff";
import type { SaveState } from "./actions";

// Saving the storefront settings (Admin → Home page and the pages that follow it). Each form sends
// its whole value as JSON in a "data" field; the setting cleans it, so a bad value never reaches
// the site. Every save is in the activity log.

function parse(form: FormData): unknown {
  try {
    return JSON.parse(String(form.get("data") ?? ""));
  } catch {
    return null;
  }
}

export async function saveHomeAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const raw = parse(form);
  if (!raw) return { status: "error", message: "That didn't come through. Try again." };
  const saved = await homeSetting.write(raw);
  await logStaff(me, "saved the home page", null, { sections: saved.sections.filter((s) => s.on).map((s) => s.id).join(", ") });
  updateTag(homeSetting.tag);
  revalidatePath("/");
  return { status: "saved", message: "Saved. The home page shows it now." };
}

export async function saveSiteAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const raw = parse(form);
  if (!raw) return { status: "error", message: "That didn't come through. Try again." };
  const saved = await siteSetting.write(raw);
  await logStaff(me, "saved site settings", null, { announcement: saved.announcement.on ? saved.announcement.text : "off" });
  updateTag(siteSetting.tag);
  revalidatePath("/", "layout");
  return { status: "saved", message: "Saved. Every page shows it now." };
}

export async function saveKindsAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const raw = parse(form);
  if (!raw) return { status: "error", message: "That didn't come through. Try again." };
  const saved = await kindsSetting.write(raw);
  await logStaff(me, "saved categories", null, { hidden: saved.filter((k) => !k.visible).map((k) => k.id).join(", ") || undefined });
  updateTag(kindsSetting.tag);
  revalidatePath("/", "layout");
  return { status: "saved", message: "Saved. The shop, drops and rail show it now." };
}

/** A category's own picture, uploaded instead of a stand-in. */
export async function kindPictureAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const id = String(form.get("id") ?? "");
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Choose a picture." };
  const kinds = await kindsSetting.getForAdmin();
  if (!kinds.some((k) => k.id === id)) return { status: "error", message: "Unknown category." };
  const saved = await saveProductPhoto(`category-${id}`, file, "icon");
  if (!saved.ok) return { status: "error", message: saved.message };
  await kindsSetting.write(kinds.map((k) => (k.id === id ? { ...k, icon: saved.src } : k)));
  await logStaff(me, "changed a category picture", id);
  updateTag(kindsSetting.tag);
  revalidatePath("/", "layout");
  return { status: "saved", message: "Picture saved." };
}

export async function saveVaultAction(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const raw = parse(form);
  if (!raw) return { status: "error", message: "That didn't come through. Try again." };
  const saved = await vaultSetting.write(raw);
  await logStaff(me, "saved the Vault", null, { brands: Object.keys(saved.brands).length, featured: saved.featured.length });
  updateTag(vaultSetting.tag);
  revalidatePath("/vault");
  revalidatePath("/");
  return { status: "saved", message: "Saved. The Vault shows it now." };
}
