"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ExpandingSearchDock } from "./ui/expanding-search-dock";

/**
 * The shop's search: the same round button as the home page's Rail, opening into a field. It
 * searches as they type by putting the words in the address (?q=), where the page reads them, so a
 * search can be shared or bookmarked and the other filters stay on.
 */
export function ShopSearch({ q, others }: { q: string; /** The filters already on, kept while searching. */ others: Record<string, string | undefined> }) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const [open, setOpen] = useState(q !== "");
  // The search was cleared from elsewhere on the page ("Clear filters"): the field empties with it.
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    if (q === "") setValue("");
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    // A short pause, so the page isn't asked again on every letter.
    timer.current = setTimeout(
      () => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(others)) if (v) params.set(k, v);
        const words = next.trim().slice(0, 60);
        if (words) params.set("q", words);
        const s = params.toString();
        router.replace(s ? `/shop?${s}` : "/shop", { scroll: false });
      },
      next ? 280 : 0,
    );
  }

  return (
    // Closed, it is one round button in the bar. Open on a phone, it takes a row of its own.
    <div className={`order-2 flex min-w-0 flex-1 justify-end ${open || value ? "max-lg:order-3 max-lg:basis-full max-lg:px-3" : ""}`}>
      <ExpandingSearchDock value={value} onChange={search} onOpenChange={setOpen} label="Search the shop" placeholder="Search the shop" className="min-w-0 flex-1" />
    </div>
  );
}
