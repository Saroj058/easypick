"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Today" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/products/new", label: "Add product" },
  { href: "/admin/festivals", label: "Festivals" },
];

export function AdminNav() {
  const path = usePathname();
  const current = (href: string) => (href === "/admin" ? path === "/admin" : href === "/admin/products" ? path.startsWith("/admin/products") && path !== "/admin/products/new" : path.startsWith(href));
  return (
    <nav aria-label="Admin sections" className="-mx-4 overflow-x-auto px-4">
      <ul className="-mb-px flex gap-2">
        {links.map((l) => (
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
