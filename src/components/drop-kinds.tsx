"use client";

import { LayoutGrid } from "lucide-react";
import { useState } from "react";

import { categoryLabels, KIND_ICON } from "@/lib/site";
import type { Category } from "@/lib/types";
import type { DropPiece } from "./drop-strip";
import { ShopShelf } from "./shop-shelf";

/**
 * A drop's pieces the way the shop shows them (owner, 18 Oct 2026): the kinds as rounded buttons
 * with a little garment picture and a count, then a shelf per kind (or just the one chosen), each
 * with the shop's cards, its own search and its count.
 */
export function DropKinds({ pieces, dropName, soon = false }: { pieces: DropPiece[]; dropName: string; soon?: boolean }) {
  const [kind, setKind] = useState<Category | null>(null);
  const kinds = (Object.keys(categoryLabels) as Category[]).filter((c) => pieces.some((p) => p.category === c));
  const shown = kind ? kinds.filter((c) => c === kind) : kinds;

  const chip = (on: boolean) =>
    `inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[13px] font-semibold transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] ${
      on ? "border-ink bg-ink text-paper" : "border-ink/15 bg-paper hover:border-ink"
    }`;

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-ink px-3 py-2.5 md:px-4">
        <div
          role="group"
          aria-label={`${dropName}, by kind`}
          className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto [mask-image:linear-gradient(90deg,#000_calc(100%-28px),transparent)] md:flex-wrap md:overflow-visible md:[mask-image:none]"
        >
          <button type="button" aria-pressed={!kind} onClick={() => setKind(null)} className={chip(!kind)}>
            <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={1.8} />
            All
            <sup aria-hidden className={`font-mono text-[10px] ${!kind ? "text-paper/70" : "text-steel-dark"}`}>
              {pieces.length}
            </sup>
          </button>
          {kinds.map((c) => (
            <button key={c} type="button" aria-pressed={kind === c} onClick={() => setKind(kind === c ? null : c)} className={chip(kind === c)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a tiny garment picture, already compressed */}
              <img src={`/stand-ins/${KIND_ICON[c]}.webp`} alt="" className={`h-6 w-6 object-contain ${kind === c ? "brightness-[3]" : "opacity-80"}`} />
              {categoryLabels[c]}
              <sup aria-hidden className={`font-mono text-[10px] ${kind === c ? "text-paper/70" : "text-steel-dark"}`}>
                {pieces.filter((p) => p.category === c).length}
              </sup>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 overflow-x-clip md:mt-14">
        {shown.map((c, i) => (
          <ShopShelf key={c} id={`drop-${c}`} first={i === 0} label={categoryLabels[c]} pieces={pieces.filter((p) => p.category === c)} soon={soon} />
        ))}
      </div>
    </div>
  );
}
