import type { Metadata } from "next";

import { requireStaff, staffOpenInDev } from "@/lib/staff";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Easypick admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  return (
    <div className="container-ep pb-24 pt-8 md:pt-12">
      {staffOpenInDev() && (
        <p className="mb-6 bg-photo px-4 py-3 text-[13px] text-steel-dark">
          Development: every logged-in account can open this screen. Set <span className="font-mono">ADMIN_PHONES</span> before going live.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-[40px] md:text-[56px]">Admin</h1>
        <p className="text-[13px] text-steel-dark">Signed in as {user.name ?? user.phone}</p>
      </div>
      <AdminNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
