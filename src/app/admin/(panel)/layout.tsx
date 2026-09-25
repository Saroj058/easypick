import type { Metadata } from "next";

import { signOutAdmin } from "@/app/admin/actions";
import { requireStaff } from "@/lib/staff";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Easypick admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const who = await requireStaff();
  return (
    <div className="container-ep pb-24 pt-8 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-[40px] md:text-[56px]">Admin</h1>
        <form action={signOutAdmin} className="flex items-center gap-3 text-[13px] text-steel-dark">
          <span>Signed in as {who}</span>
          <button type="submit" className="min-h-11 font-semibold text-ink underline underline-offset-2">
            Sign out
          </button>
        </form>
      </div>
      <AdminNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
