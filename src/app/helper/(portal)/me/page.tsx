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
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]">Your login</p>
        <h1 className="mt-1 text-[34px] font-light leading-none tracking-[-0.02em] md:text-[40px]">{me.username}</h1>
        <p className="mt-1 text-[#6b6d72]">{me.role === "owner" ? "Owner" : "Helper"}. What you change is saved under your name.</p>
        <form action={signOutAdmin} className="mt-6">
          <input type="hidden" name="portal" value="helper" />
          <button type="submit" className="btn btn-outline w-full sm:w-auto">
            Sign out
          </button>
        </form>
        <p className="mt-2 text-[13px] text-[#6b6d72]">Signing out ends your helper login on this device. The admin has its own login.</p>
      </div>
      <PasswordForm min={MIN_PASSWORD} />
    </div>
  );
}
