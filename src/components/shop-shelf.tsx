"use client";

import { useState } from "react";

import { searchProducts } from "@/lib/search";
import { DropStrip, type DropPiece } from "./drop-strip";
import { ExpandingSearchDock } from "./ui/expanding-search-dock";
import { ShinyLink } from "./ui/shiny-button";

/** The most cards a shelf draws before Show all. */
const SHELF_MAX = 12;

/**
 * One kind of piece as the rail shows it (owner, 18 Oct 2026): its name set large with how many
 * there are, its own search that only looks through these pieces, Show all, then the strip of cards.
 * The shop and each drop page use it, so a kind reads the same everywhere.
 */
export function ShopShelf({
  id,
  label,
  pieces: every,
  showAll,
  showAllLabel = "Show all",
  soon = false,
  first = false,
  note,
}: {
  id: string;
  label: string;
  pieces: DropPiece[];
  /** Where "Show all" goes; none hides it (e.g. the shop already showing only this kind). */
  showAll?: string;
  showAllLabel?: string;
  /** A drop still to come: look, don't buy. */
  soon?: boolean;
  first?: boolean;
  /** A line under its name (Admin → Categories). */
  note?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const found = q ? searchProducts(every, q) : every;
  // A long shelf shows its first pieces; Show all opens every one in rows and columns (owner, 20 Oct 2026).
  const pieces = showAll && !q && found.length > SHELF_MAX ? found.slice(0, SHELF_MAX) : found;

  return (
    <section id={`shelf-${id}`} aria-labelledby={`shelf-${id}-title`} className={`scroll-mt-24 ${first ? "" : "pt-12 md:pt-20"}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <h2 id={`shelf-${id}-title`} className="display min-w-0 text-[clamp(2.2rem,1.6rem+2.6vw,3.6rem)] leading-[0.86]">
          {label}
          <span className="ml-2 inline-block pt-1 align-top font-mono text-[13px] font-normal leading-none tracking-[0.08em] text-steel-dark" aria-label={`${found.length} pieces`}>
            {q ? `${found.length}/${every.length}` : every.length}
          </span>
        </h2>
        {note && <p className="basis-full text-[14px] text-steel-dark sm:order-last">{note}</p>}
        <div className={`flex min-w-0 items-center justify-end gap-3 ${q ? "max-sm:basis-full" : ""} sm:flex-1`}>
          {pieces.length < found.length && <span className="hidden whitespace-nowrap text-[13px] text-steel-dark md:inline">{pieces.length} of {found.length}</span>}
          <ExpandingSearchDock value={query} onChange={setQuery} label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}`} className="min-w-0 flex-1" />
          {showAll && (
            <ShinyLink href={showAll} aria-label={`${showAllLabel}: ${label.toLowerCase()}`}>
              {showAllLabel} <span aria-hidden>→</span>
            </ShinyLink>
          )}
        </div>
      </div>
      {pieces.length > 0 ? (
        <DropStrip key={pieces.map((p) => p.id).join(",")} pieces={pieces} label={label} soon={soon} />
      ) : (
        <p className="py-16 text-center text-steel-dark">
          Nothing in {label.toLowerCase()} matches &ldquo;{q}&rdquo;.{" "}
          <button type="button" onClick={() => setQuery("")} className="font-semibold text-ink underline underline-offset-4">
            Clear
          </button>
        </p>
      )}
    </section>
  );
}
