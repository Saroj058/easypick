"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { StaffRole } from "@/lib/db/schema";

const links: { href: string; label: string; owner?: boolean }[] = [
  { href: "/admin", label: "Today" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/stock", label: "Stock count" },
  { href: "/admin/drops", label: "Drops", owner: true },
  { href: "/admin/reports", label: "Reports", owner: true },
  { href: "/admin/gift-cards", label: "Gift cards", owner: true },
  { href: "/admin/festivals", label: "Festivals", owner: true },
  { href: "/admin/staff", label: "Staff", owner: true },
  { href: "/admin/activity", label: "Activity", owner: true },
  { href: "/admin/account", label: "Account" },
];

export function AdminNav({ role }: { role: StaffRole }) {
  const path = usePathname();
  const current = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <nav aria-label="Admin sections" className="-mx-4 overflow-x-auto px-4">
      <ul className="-mb-px flex gap-2">
        {links
          .filter((l) => !l.owner || role === "owner")
          .map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={current(l.href) ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-[15px] ${current(l.href) ? "border-ink font-semibold" : "border-transparent text-steel-dark hover:text-ink"}`}
              >
                {l.label}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
