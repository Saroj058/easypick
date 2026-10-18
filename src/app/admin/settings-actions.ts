"use server";

import { revalidatePath, updateTag } from "next/cache";

import { homeSetting } from "@/lib/settings/home";
import { siteSetting } from "@/lib/settings/site";
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
