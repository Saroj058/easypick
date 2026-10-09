"use client";

import { useState } from "react";

import type { Category, ProductImage as Img } from "@/lib/types";
import { Ruler } from "lucide-react";
import Link from "next/link";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";
import { ProductImage } from "./product-image";

// The product page's stage: the piece itself, large and alone in the middle, with a quiet column
// beside it (a numbered list of its views, its name and colour, one line about it, and what it is
// made of). The first view is the piece cut out of its photo, floating over a soft shadow; the
// other views are its photos. On phones the column's words move under the picture.

export function ProductStage({
  images,
  cutout,
  category,
  colour,
  name,
  description,
  details,
  table,
  tag,
}: {
  images: Img[];
  /** The piece cut out of its front photo (public/rack/<slug>.webp), when there is one. */
  cutout: string | null;
  category: Category;
  colour: { name: string; hex: string };
  name: string;
  description: string;
  /** The details list: fit, cloth, make, care. */
  details: string[];
  /** The size chart in cm: a heading row and one row per size. Opens in a pop-up. */
  table: { head: string[]; rows: (string | number)[][] } | null;
  /** The hang tag of the piece (price and measurements), hung small at the top corner. */
  tag?: React.ReactNode;
}) {
  const [view, setView] = useState(0);
  const [measuring, setMeasuring] = useState(false);
  const shown = images[Math.min(view, images.length - 1)];
  const floating = view === 0 && cutout;

  return (
    <div className="relative grid h-full grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      {/* The column: which view, and what the piece is. Its name is the page's heading on desktop. */}
      <div className="order-2 flex min-w-0 flex-col px-4 pb-8 pt-2 md:px-8 lg:order-1 lg:py-12 lg:pl-10 lg:pr-0">
        <div className="flex flex-1 gap-10 lg:items-center">
          {images.length > 1 && (
            <ol aria-label="Views of this piece" className="flex shrink-0 flex-row gap-1 max-lg:absolute max-lg:left-4 max-lg:top-3 lg:flex-col">
              {images.map((img, i) => (
                <li key={i}>
                  <button
                    type="button"
                    aria-pressed={i === view}
                    aria-label={`View ${i + 1}: ${img.kind}`}
                    onClick={() => setView(i)}
                    onMouseEnter={() => setView(i)}
                    className={`flex h-9 w-9 cursor-pointer items-end pb-1.5 font-mono text-[11px] tabular-nums tracking-[0.1em] transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-px after:w-5 after:origin-left after:bg-ink after:transition-transform after:duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink relative ${i === view ? "text-ink after:scale-x-100" : "text-steel-dark after:scale-x-0 hover:text-ink"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="min-w-0">
            {/* The page's heading on desktop; on phones the buying panel carries the name, so it is hidden here */}
            <div className="max-lg:hidden">
              <h1 className="text-[17px] font-medium uppercase tracking-[0.2em]">{name}</h1>
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-steel-dark">{colour.name}</p>
              <p className="mt-6 max-w-[28ch] text-[13px] leading-relaxed text-ink/80">{description}</p>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-steel-dark lg:mt-7">Details</p>
            <ul className="mt-2.5 space-y-1.5 border-t border-ink/15 pt-3 text-[13px] leading-snug text-ink/85 lg:max-w-[30ch]">
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            {/* The size chart opens in a pop-up, so the page stays one screen */}
            {table && (
              <button
                type="button"
                onClick={() => setMeasuring(true)}
                className="group mt-5 inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-full border border-ink/30 bg-paper px-5 text-[12px] font-semibold uppercase tracking-[0.08em] transition-[background-color,border-color,color,scale] duration-200 hover:border-ink hover:bg-ink hover:text-paper active:scale-[0.98]"
              >
                <Ruler aria-hidden className="h-4 w-4" strokeWidth={1.8} />
                Measurements (cm)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* The piece */}
      <div className="relative order-1 flex min-h-[62svh] items-center justify-center px-6 pb-4 pt-12 lg:order-2 lg:min-h-0 lg:px-10 lg:py-10">
        {/* Its tag, small, on a string at the top corner: the fixed price and the measurements */}
        {tag && (
          <div aria-hidden className="pointer-events-none absolute right-3 top-10 z-10 h-[124px] w-[76px] lg:right-8 lg:top-0 lg:h-[168px] lg:w-[96px]">
            <span className="absolute left-1/2 top-0 block h-6 w-px bg-ink/40 lg:h-10" />
            <div className="absolute left-1/2 top-4 w-[200px] origin-top -translate-x-1/2 scale-[0.38] [filter:drop-shadow(0_8px_12px_rgba(0,0,0,0.16))] lg:top-8 lg:scale-[0.48]">{tag}</div>
          </div>
        )}
        {floating ? (
          <div className="relative flex h-full max-h-[70svh] w-full items-center justify-center">
            <span aria-hidden className="absolute inset-x-[22%] bottom-[2%] h-[5%] rounded-[50%] bg-ink/25 blur-2xl" />
            {/* eslint-disable-next-line @next/next/no-img-element -- the piece's own photo, cut out; already compressed */}
            <img src={cutout} alt={shown.alt} fetchPriority="high" draggable={false} className="relative max-h-[66svh] w-auto max-w-full animate-fade-up object-contain [filter:drop-shadow(0_30px_30px_rgba(0,0,0,0.16))]" />
          </div>
        ) : (
          <div key={view} className="w-full max-w-[460px] animate-fade-up">
            <ProductImage image={shown} category={category} colourHex={colour.hex} priority={view === 0} sizes="(min-width: 1024px) 40vw, 100vw" />
          </div>
        )}
      </div>

      {table && (
        <Sheet open={measuring} onOpenChange={setMeasuring}>
          <SheetContent side="bottom" className="mx-auto max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[18px] border-mist bg-paper px-5 pb-6 pt-5 text-ink md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-[18px] md:px-8 md:pb-8 md:pt-7">
            <SheetTitle className="display pr-10 text-[30px] leading-none">Measurements</SheetTitle>
            <SheetDescription className="mt-1 text-[14px] text-steel-dark">{name}, in centimetres.</SheetDescription>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full font-mono text-[14px]">
                <thead>
                  <tr className="text-left text-steel-dark">
                    {table.head.map((h) => (
                      <th key={h} scope="col" className="py-1.5 pr-4 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={String(row[0])} className="border-t border-mist">
                      {row.map((cell, i) =>
                        i === 0 ? (
                          <th key={i} scope="row" className="py-2.5 pr-4 text-left font-semibold">
                            {cell}
                          </th>
                        ) : (
                          <td key={i} className="py-2.5 pr-4 tabular-nums">
                            {cell}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[13px] text-steel-dark">
              Garment measured flat. Chest is measured all the way round. Wrong size? Exchange it within 7 days with tags on.{" "}
              <Link href="/returns" className="underline underline-offset-2">
                Returns policy
              </Link>
            </p>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
