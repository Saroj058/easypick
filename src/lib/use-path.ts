"use client";

import { usePathname } from "next/navigation";

/**
 * The page's path, with the home page always "/". When the cached home page is rebuilt in the
 * background on the host, the path can come through as "/index", so the header, menu and footer
 * drew it as some other page and the browser then disagreed (a hydration error, 20 Oct 2026).
 */
export function usePath() {
  const p = usePathname() ?? "/";
  return p === "/index" || p === "" ? "/" : p;
}
