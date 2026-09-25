import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { signOutAdmin } from "@/app/admin/actions";
import { requireStaff } from "@/lib/staff";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Easypick admin" }, robots: { index: false, follow: false } };

/** The staff frame: a slim bar with the sections, no shop header, footer or tab bar. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const who = await requireStaff();
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-40 border-b border-mist bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="container-ep flex h-14 items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-3" aria-label="Easypick admin, today">
            <Image src="/brand/logo.png" alt="" width={611} height={161} className="h-5 w-[76px]" priority />
            <span className="rounded-[2px] bg-ink px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-paper">Admin</span>
          </Link>
          <div className="flex items-center gap-4 text-[14px]">
            <span className="hidden text-steel-dark sm:inline">{who}</span>
            <Link href="/" target="_blank" rel="noopener" className="min-h-11 content-center text-steel-dark hover:text-ink">
              View site ↗
            </Link>
            <form action={signOutAdmin}>
              <button type="submit" className="min-h-11 font-semibold underline underline-offset-2">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="container-ep">
          <AdminNav />
        </div>
      </header>
      <div className="container-ep pb-16 pt-8">{children}</div>
    </div>
  );
}
