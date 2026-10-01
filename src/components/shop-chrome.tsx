"use client";

import { usePathname } from "next/navigation";

/**
 * The shop's header, footer and tab bar. The staff admin (/admin) and helper portal (/helper) have
 * their own frames, and the virtual tour (/visit/tour) fills the whole window.
 */
export function ShopChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path.startsWith("/admin") || path.startsWith("/helper") || path === "/visit/tour" ? null : children;
}
