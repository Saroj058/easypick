"use server";

import { revalidatePath } from "next/cache";

import { logStaff, requireOwner, resetStaffPassword, signOutStaffEverywhere } from "@/lib/staff";

// Owner tools for someone else's login: a new password, or signing them out everywhere.

export type ResetState = { status: "idle" } | { status: "saved"; message: string } | { status: "error"; message: string };

/** Owner: set a new password for a staff member. Their other logins end. */
export async function resetStaffPasswordAction(_prev: ResetState, form: FormData): Promise<ResetState> {
  const me = await requireOwner();
  const id = String(form.get("id") ?? "");
  const res = await resetStaffPassword(id, me.id, String(form.get("password") ?? ""));
  if (!res.ok) return { status: "error", message: res.message };
  await logStaff(me, "reset staff password", res.username, { staffId: id });
  revalidatePath("/admin/staff");
  return { status: "saved", message: `New password set for ${res.username}. They've been signed out everywhere; give them the password in person.` };
}

/** Owner: sign a staff member out on every phone and computer (their password stays). */
export async function signOutStaffAction(form: FormData) {
  const me = await requireOwner();
  const id = String(form.get("id") ?? "");
  const res = await signOutStaffEverywhere(id, me.id);
  if (!res.ok) return;
  await logStaff(me, "signed out staff everywhere", res.username, { staffId: id });
  revalidatePath("/admin/staff");
}
