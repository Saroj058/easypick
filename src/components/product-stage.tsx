"use client";

import { useState } from "react";

import type { Category, ProductImage as Img } from "@/lib/types";
import { ArrowIcon } from "./icons";
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
  facts,
  details,
  tag,
}: {
  images: Img[];
  /** The piece cut out of its front photo (public/rack/<slug>.webp), when there is one. */
  cutout: string | null;
  category: Category;
  colour: { name: string; hex: string };
  name: string;
  description: string;
  /** Two or three short lines about the cloth and make. */
  facts: string[];
  /** Everything on the details list: shown in the column on desktop. */
  details: string[];
  /** The hang tag of the piece (price and measurements), hung beside it. */
  tag?: React.ReactNode;
}) {
  const [view, setView] = useState(0);
  const shown = images[Math.min(view, images.length - 1)];
  const floating = view === 0 && cutout;

  return (
    <div className="relative grid h-full grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      {/* The column: which view, and what the piece is. Its name is said once, in the buying panel's heading. */}
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
          <div className="min-w-0 max-lg:hidden">
            <p aria-hidden className="text-[17px] font-medium uppercase tracking-[0.2em]">
              {name}
            </p>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-steel-dark">{colour.name}</p>
            <p className="mt-6 max-w-[28ch] text-[13px] leading-relaxed text-ink/80">{description}</p>
            <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.18em] text-steel-dark">Details</p>
            <ul className="mt-2.5 max-w-[30ch] space-y-1.5 border-t border-ink/15 pt-3 text-[13px] leading-snug text-ink/85">
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <a href="#details" className="group mt-5 inline-flex min-h-11 items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em]">
              Measurements and returns
              <ArrowIcon className="h-3.5 w-3.5 -rotate-45 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
        {/* What it is made of: a swatch of its colour and two or three short lines */}
        {facts.length > 0 && (
          <div className="flex min-w-0 items-center gap-4 overflow-hidden max-lg:mt-2 lg:hidden">
            <span aria-hidden className="h-12 w-12 shrink-0 rounded-full border border-ink/10 shadow-[inset_0_-6px_10px_rgba(0,0,0,0.12),inset_0_4px_8px_rgba(255,255,255,0.35)]" style={{ background: colour.hex }} />
            <ul className="min-w-0 flex-1 space-y-1 font-mono text-[10.5px] uppercase leading-snug tracking-[0.14em] text-ink/80">
              {facts.map((f) => (
                <li key={f} className="truncate">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* The piece */}
      <div className="relative order-1 flex min-h-[62svh] items-center justify-center px-6 pb-4 pt-12 lg:order-2 lg:min-h-0 lg:px-10 lg:py-10">
        {/* Its tag, on a string at the top corner of the stage: the fixed price and the measurements in cm */}
        {tag && (
          <div aria-hidden className="pointer-events-none absolute right-3 top-10 z-10 h-[150px] w-[96px] lg:right-8 lg:top-0 lg:h-[250px] lg:w-[150px]">
            <span className="absolute left-1/2 top-0 block h-7 w-px bg-ink/40 lg:h-14" />
            <div className="absolute left-1/2 top-5 w-[200px] origin-top -translate-x-1/2 scale-[0.48] [filter:drop-shadow(0_10px_16px_rgba(0,0,0,0.16))] lg:top-12 lg:scale-75">{tag}</div>
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
    </div>
  );
}
