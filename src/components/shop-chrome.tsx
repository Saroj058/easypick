"use client";

import { usePath } from "@/lib/use-path";



/**
 * The shop's header, footer and tab bar. The staff admin (/admin) and helper portal (/helper) have
 * their own frames, and the virtual tour (/visit/tour) fills the whole window.
 */
export function ShopChrome({ children }: { children: React.ReactNode }) {
  const path = usePath();
  return path.startsWith("/admin") || path.startsWith("/helper") || path === "/visit/tour" ? null : children;
}

/** The footer shows on the home page only (owner, 18 Oct 2026: not on the shop or the drops). The visit page is one full screen. */
const WITH_FOOTER = new Set(["/", "/drops"]);
export function FooterChrome({ children }: { children: React.ReactNode }) {
  const path = usePath();
  if (WITH_FOOTER.has(path)) return children;
  // The visit page is exactly one screen: it leaves its own room for the tab bar.
  if (path === "/visit") return null;
  // Elsewhere, room at the bottom so the phone's tab bar never covers the end of the page.
  return <div aria-hidden className="h-[calc(72px+env(safe-area-inset-bottom))] lg:hidden" />;
}
