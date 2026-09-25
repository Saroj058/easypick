import type { Metadata } from "next";

import { PasswordForm } from "@/app/admin/(panel)/account/account-forms";
import { signOutAdmin } from "@/app/admin/actions";
import { MIN_PASSWORD, requireStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Me" };
export const dynamic = "force-dynamic";

export default async function HelperMe() {
  const me = await requireStaff("/helper/login");
  return (
    <div className="mx-auto max-w-xl space-y-12">
      <div>
        <h1 className="display text-[32px]">{me.username}</h1>
        <p className="mt-1 text-steel-dark">{me.role === "owner" ? "Owner" : "Helper"}. What you change is saved under your name.</p>
        <form action={signOutAdmin} className="mt-6">
          <input type="hidden" name="portal" value="helper" />
          <button type="submit" className="btn btn-outline w-full sm:w-auto">
            Sign out
          </button>
        </form>
        <p className="mt-2 text-[13px] text-steel-dark">Signing out ends your login on every phone and computer.</p>
      </div>
      <PasswordForm min={MIN_PASSWORD} />
    </div>
  );
}
