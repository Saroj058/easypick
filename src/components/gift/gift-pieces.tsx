"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatPrice } from "@/lib/format";
import { searchProducts } from "@/lib/search";
import { categoryLabels } from "@/lib/site";
import type { Category } from "@/lib/types";
import { DropStrip } from "../drop-strip";
import type { RailPiece } from "../home/rail-wall";
import { GiftIcon } from "../icons";
import { ExpandingSearchDock } from "../ui/expanding-search-dock";

// The gift page's pieces, as the drops page shows a drop: one strip of cards, the centre piece's
// name, sizes, Buy now (the rail's pop-up, without leaving) and the bag, plus "Send it as a gift".
// Above it: a budget, the kind of piece (each with a little picture of the garment), and the
// rail's search. All of it narrows the strip at once, without reloading the page.

/** Budgets offered, when they narrow what is on sale (at least one piece under, and not all). */
const BUDGETS = [1000, 1500, 2000, 2500, 3500, 5000];
/** The strip holds this many at most; past that, the shop has the rest. */
const MOST = 30;

type Kind = Category | "one";
/** A little garment picture for each kind (the neutral stand-ins in public/stand-ins). */
const KIND_ICON: Record<Kind, string> = { tees: "tee", hoodies: "hoodie", jackets: "jacket", bottoms: "cargo", "co-ords": "set", accessories: "cap", one: "cap" };

const oneSize = (p: RailPiece) => p.colours.every((c) => c.sizes.every((s) => s.size === "ONE"));

export function GiftPieces({ pieces }: { pieces: RailPiece[] }) {
  const [max, setMax] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [query, setQuery] = useState("");

  const inKind = (p: RailPiece, k: Kind | null) => (k === "one" ? oneSize(p) : k ? p.category === k : true);
  const inBudget = (p: RailPiece, m: number | null) => (m ? p.price <= m : true);
  const prices = pieces.map((p) => p.price);
  const budgets = BUDGETS.filter((b) => {
    const under = prices.filter((x) => x <= b).length;
    return under > 0 && under < prices.length;
  });
  const kinds = ([...Object.keys(categoryLabels), "one"] as Kind[])
    .map((k) => ({ k, count: pieces.filter((p) => inBudget(p, max) && inKind(p, k)).length }))
    .filter((x) => x.count > 0);

  const q = query.trim();
  // With a budget, the best that money buys comes first; without one, the small everyday gifts do.
  const matched = searchProducts(
    pieces.filter((p) => inBudget(p, max) && inKind(p, kind)),
    q,
  );
  const ordered = q ? matched : [...matched].sort((a, b) => (max ? b.price - a.price : a.price - b.price));
  const shown = ordered.slice(0, MOST);
  const filtered = Boolean(max || kind || q);

  const pill = (on: boolean) =>
    `inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-[background-color,color,scale] duration-150 active:scale-[0.97] ${on ? "bg-ink text-paper shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)]" : "text-ink/70 hover:text-ink"}`;

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <h2 id="pieces-h" className="display display-h2">
          {max ? `Under ${formatPrice(max)}.` : "Every piece."}
        </h2>
        <p className="index shrink-0 pb-1 text-right text-steel-dark" aria-live="polite">
          {ordered.length} {ordered.length === 1 ? "piece" : "pieces"}
          <span className="max-sm:hidden">{q ? "" : max ? " · best first" : " · cheapest first"}</span>
        </p>
      </div>

      {/* The finder: one thin outlined card */}
      <div className="mt-5 rounded-2xl border border-ink">
        {/* Budget, and the rail's search at the end */}
        <div className="flex items-center gap-3 px-3 py-2 md:px-4">
          <span className="index w-14 shrink-0 text-steel-dark max-md:hidden">Budget</span>
          <div role="group" aria-label="Budget" className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-mist p-1 [scrollbar-width:none]">
            <button type="button" aria-pressed={!max} onClick={() => setMax(null)} className={pill(!max)}>
              Any price
            </button>
            {budgets.map((b) => (
              <button key={b} type="button" aria-pressed={max === b} onClick={() => setMax(max === b ? null : b)} className={pill(max === b)}>
                Under {formatPrice(b)}
              </button>
            ))}
          </div>
          <ExpandingSearchDock value={query} onChange={setQuery} label="Search the gifts" placeholder="Search the gifts" className="w-11 shrink-0 has-[form]:w-[min(320px,45vw)]" />
        </div>

        {/* Kind: each with a little picture of the garment and how many there are */}
        <div className="flex items-center gap-3 border-t border-ink/15 px-3 py-2.5 md:px-4">
          <span className="index w-14 shrink-0 text-steel-dark max-md:hidden">Kind</span>
          <div role="group" aria-label="Kind of piece" className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]">
            <button type="button" aria-pressed={!kind} onClick={() => setKind(null)} className={`${kindChip(!kind)}`}>
              <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={1.8} />
              Anything
            </button>
            {kinds.map(({ k, count }) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)} className={kindChip(kind === k)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a tiny garment picture, already compressed */}
                <img src={`/stand-ins/${KIND_ICON[k]}.webp`} alt="" className={`h-6 w-6 object-contain ${kind === k ? "brightness-[3]" : "opacity-80"}`} />
                {k === "one" ? "One size" : categoryLabels[k]}
                <sup className={`font-mono text-[10px] ${kind === k ? "text-paper/70" : "text-steel-dark"}`}>{count}</sup>
              </button>
            ))}
          </div>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setMax(null);
                setKind(null);
                setQuery("");
              }}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center text-[13px] font-semibold underline underline-offset-4"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {shown.length > 0 ? (
        <>
          <DropStrip
            key={`${max}-${kind}-${q}`}
            pieces={shown}
            label="Gifts"
            after={(p) => (
              <Link href={`/gift/${p.slug}`} className="group mx-auto mt-3 flex min-h-11 w-fit items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em]">
                <GiftIcon className="h-4 w-4" />
                Send it as a gift
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            )}
          />
          {ordered.length > MOST && (
            <p className="mt-6 text-center text-[14px] text-steel-dark">
              Showing {MOST} of {ordered.length}. Narrow it with a budget, a kind or a search, or{" "}
              <Link href="/shop" className="font-semibold text-ink underline underline-offset-2">
                see them all in the shop
              </Link>
              .
            </p>
          )}
        </>
      ) : (
        <p className="mt-8 text-center">
          Nothing here right now.{" "}
          <button
            type="button"
            onClick={() => {
              setMax(null);
              setKind(null);
              setQuery("");
            }}
            className="inline-flex min-h-11 cursor-pointer items-center font-semibold underline underline-offset-2"
          >
            Show every piece
          </button>{" "}
          or{" "}
          <Link href="#buy" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            send a gift card
          </Link>
        </p>
      )}
    </div>
  );
}

function kindChip(on: boolean) {
  return `inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[13px] font-semibold transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] ${
    on ? "border-ink bg-ink text-paper" : "border-ink/15 bg-paper hover:border-ink"
  }`;
}
