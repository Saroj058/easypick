import type { Metadata } from "next";

import { MIN_PASSWORD, requireStaff } from "@/lib/staff";
import { PasswordForm, UsernameForm } from "./account-forms";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AdminAccount() {
  const me = await requireStaff();
  return (
    <div className="max-w-xl space-y-14">
      <div>
        <h2 className="display text-[32px] md:text-[40px]">Your login</h2>
        <p className="mt-2 text-steel-dark">
          Signed in as <span className="font-semibold text-ink">{me.username}</span>. Both changes ask for your current password.
        </p>
      </div>
      <UsernameForm current={me.username} />
      <PasswordForm min={MIN_PASSWORD} />
    </div>
  );
}
