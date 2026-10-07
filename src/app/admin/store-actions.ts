"use server";

import { revalidatePath, updateTag } from "next/cache";

import { logStaff, requireOwner } from "@/lib/staff";
import { parseStoreForm } from "@/lib/store-form";
import { getStoreInfoForAdmin, saveStoreInfo, STORE_TAG } from "@/lib/store-info";
import type { SaveState } from "./actions";

/** Owner only: the store's address, hours, special days, notice and route for /visit. */
export async function saveStore(_prev: SaveState, form: FormData): Promise<SaveState> {
  const me = await requireOwner();
  const parsed = parseStoreForm(form, await getStoreInfoForAdmin());
  if (!parsed.ok) return { status: "error", message: parsed.message };
  await saveStoreInfo(parsed.info);
  await logStaff(me, "saved store details", null, { opened: parsed.info.opened, specialDays: parsed.info.special.length });
  updateTag(STORE_TAG);
  revalidatePath("/", "layout");
  return { status: "saved", message: parsed.info.opened ? "Saved. The Visit page shows the store as open." : "Saved. The Visit page still shows Coming soon." };
}
