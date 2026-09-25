import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { LiveOrders } from "@/app/admin/(panel)/live-orders";
import { paidOrders } from "@/lib/orders";
import { requireStaff } from "@/lib/staff";
import { HelperNav } from "./helper-nav";
import { toPack } from "./queue";

export const metadata: Metadata = { title: { default: "Helper", template: "%s | Easypick helper" }, robots: { index: false, follow: false } };

/**
 * The helper portal: made for a phone at the counter. Orders to pack and hand over,
 * finding an order, size exchanges, stock. No prices, refunds, reports or staff settings.
 */
export default async function HelperLayout({ children }: LayoutProps<"/helper">) {
  const who = await requireStaff("/helper/login");
  const waiting = (await paidOrders()).filter((o) => toPack(o) || o.attention).length;
  return (
    <div className="min-h-dvh bg-paper pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-40 border-b border-mist bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="container-ep flex h-14 items-center justify-between gap-4">
          <Link href="/helper" className="flex items-center gap-3" aria-label="Easypick helper, orders">
            <Image src="/brand/logo.png" alt="" width={611} height={161} className="h-5 w-[76px]" priority />
            <span className="rounded-[2px] bg-volt px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">Helper</span>
          </Link>
          <div className="flex items-center gap-4 text-[14px]">
            {who.role === "owner" && (
              <Link href="/admin" className="min-h-11 content-center text-steel-dark underline underline-offset-2 hover:text-ink">
                Admin
              </Link>
            )}
            <Link href="/helper/me" className="min-h-11 content-center font-semibold">
              {who.username}
            </Link>
          </div>
        </div>
        <div className="container-ep hidden md:block">
          <HelperNav waiting={waiting} />
        </div>
      </header>
      <div className="md:hidden">
        <HelperNav waiting={waiting} />
      </div>
      <LiveOrders href="/helper" />
      <div className="container-ep pb-10 pt-6 md:pt-8">{children}</div>
    </div>
  );
}
