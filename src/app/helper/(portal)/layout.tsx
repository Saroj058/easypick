import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { LiveOrders } from "@/app/admin/(panel)/live-orders";
import { helperQueueCounts } from "@/lib/helper-counts";
import { requireStaff } from "@/lib/staff";
import { HelperNav } from "./helper-nav";

export const metadata: Metadata = { title: { default: "Helper", template: "%s | Easypick helper" }, robots: { index: false, follow: false } };

/**
 * The helper portal: made for a phone at the counter. Orders to pack and hand over,
 * finding an order, size exchanges, stock. No prices, refunds, reports or staff settings.
 * Same calm control-room look as the admin.
 */
export default async function HelperLayout({ children }: LayoutProps<"/helper">) {
  const who = await requireStaff("/helper/login");
  // A small SQL count, not every order.
  const { waiting } = await helperQueueCounts();
  return (
    <div className="admin-ui min-h-dvh bg-[#e9e9e7] px-3 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] text-ink md:px-5 md:pb-6 md:pt-5">
      <header className="sticky top-3 z-40 mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 rounded-full bg-white/85 pl-5 pr-2 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)] ring-1 ring-ink/[0.06] backdrop-blur md:top-5">
        <Link href="/helper" className="flex items-center gap-2.5" aria-label="Easypick helper, orders">
          <Image src="/brand/logo.png" alt="" width={611} height={161} className="h-5 w-[76px]" priority />
          <span className="rounded-full bg-ink px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-paper">Helper</span>
        </Link>
        <div className="hidden md:block">
          <HelperNav waiting={waiting} />
        </div>
        <div className="flex items-center gap-1.5 text-[13.5px]">
          {who.role === "owner" && (
            <Link href="/admin" className="hidden h-10 items-center rounded-full px-3 text-[#55575c] hover:bg-ink/[0.06] hover:text-ink sm:inline-flex">
              Admin
            </Link>
          )}
          <Link href="/helper/me" className="flex h-10 items-center gap-2 rounded-full bg-[#f4f4f2] pl-1 pr-3.5 font-semibold hover:bg-ink/[0.08]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[13px] uppercase text-paper" aria-hidden>
              {who.username.slice(0, 1)}
            </span>
            {who.username}
          </Link>
        </div>
      </header>
      <div className="md:hidden">
        <HelperNav waiting={waiting} dock />
      </div>
      <LiveOrders href="/helper" login="/helper/login" />
      <main className="mx-auto mt-4 min-h-[calc(100dvh-8rem)] max-w-5xl rounded-[28px] bg-white/85 px-4 py-6 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.3)] sm:px-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
