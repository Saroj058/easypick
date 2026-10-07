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

/** The footer shows on the two pages people land on: home and the shop. (The visit page is one full screen.) */
const WITH_FOOTER = new Set(["/", "/shop"]);
export function FooterChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (WITH_FOOTER.has(path)) return children;
  // The visit page is exactly one screen: it leaves its own room for the tab bar.
  if (path === "/visit") return null;
  // Elsewhere, room at the bottom so the phone's tab bar never covers the end of the page.
  return <div aria-hidden className="h-[calc(72px+env(safe-area-inset-bottom))] lg:hidden" />;
}
