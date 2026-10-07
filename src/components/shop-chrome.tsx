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

/** The footer shows on the three pages people land on: home, the shop and the visit page. */
const WITH_FOOTER = new Set(["/", "/shop", "/visit"]);
export function FooterChrome({ children }: { children: React.ReactNode }) {
  if (WITH_FOOTER.has(usePathname())) return children;
  // Elsewhere, room at the bottom so the phone's tab bar never covers the end of the page.
  return <div aria-hidden className="h-[calc(72px+env(safe-area-inset-bottom))] lg:hidden" />;
}
