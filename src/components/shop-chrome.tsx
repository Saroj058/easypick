"use client";

import { usePathname } from "next/navigation";

/** The shop's header, footer and tab bar. The staff admin (/admin) has its own, plainer frame. */
export function ShopChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path.startsWith("/admin") ? null : children;
}
