import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser } from "./auth";
import type { User } from "./db";

// Who can open the admin screen: phone numbers in ADMIN_PHONES (comma-separated,
// e.g. "9800000001,9800000002"). Only a phone proven by a login code counts.
// In development with ADMIN_PHONES unset, any logged-in account is staff, so the
// screen can be tried out; production always needs the list.

function staffPhones(): string[] {
  return (process.env.ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => p.replace(/\D/g, "").slice(-10))
    .filter((p) => p.length === 10);
}

export function staffOpenInDev() {
  return process.env.NODE_ENV !== "production" && staffPhones().length === 0;
}

export function isStaff(user: User | null | undefined): boolean {
  if (!user) return false;
  if (staffOpenInDev()) return true;
  return Boolean(user.phone && staffPhones().includes(user.phone));
}

/** For admin pages and actions: the staff member, or off to log in. */
export async function requireStaff(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isStaff(user)) redirect("/account");
  return user;
}
