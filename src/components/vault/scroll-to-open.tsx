"use client";

import { useEffect, useRef } from "react";

/** On a phone the brand cards scroll sideways: bring the open one into view without moving the page. */
export function ScrollToOpen({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = box.current?.querySelector("nav");
    const on = row?.querySelector<HTMLElement>("[aria-current='page']");
    if (!row || !on || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: on.offsetLeft - row.clientWidth / 2 + on.clientWidth / 2, behavior: "auto" });
  }, []);
  return <div ref={box}>{children}</div>;
}
