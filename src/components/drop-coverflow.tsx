"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatPrice } from "@/lib/format";
import type { Category, ProductImage as Img } from "@/lib/types";
import { ArrowIcon } from "./icons";
import { ProductImage } from "./product-image";
import { CoverflowCarousel } from "./ui/coverflow-carousel";

// A drop's pieces as a row of cards that is swiped or dragged sideways: the piece in the middle
// faces out, large, and the ones either side turn away and fade, like records in a rack. The same
// carousel as the home page's rail. Under it: the middle piece's name, fixed price and sizes, and
// the way to its page (tapping the middle card goes there too).

export interface DropPiece {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: Img;
  category: Category;
  hex: string;
  /** Sizes of the first colour, in order, with what is left of each. */
  sizes: { size: string; stock: number }[];
  /** Nothing left in any size. */
  gone: boolean;
}

export function DropCoverflow({ pieces, label, quiet = false }: { pieces: DropPiece[]; label: string; /** A drop that is not on sale: shown muted. */ quiet?: boolean }) {
  const router = useRouter();
  // A long row goes round in a ring from its first piece; a short one starts on its middle piece, so both sides are filled.
  const loop = pieces.length >= 5;
  const start = loop ? 0 : Math.floor((pieces.length - 1) / 2);
  const [active, setActive] = useState(start);
  const piece = pieces[Math.min(active, pieces.length - 1)];
  if (!piece) return null;
  const left = piece.sizes.reduce((n, v) => n + v.stock, 0);
  const oneSize = piece.sizes.length === 1 && piece.sizes[0].size === "ONE";

  return (
    <div className="mt-6">
      <CoverflowCarousel
        count={pieces.length}
        aspect={1.25}
        cardWidth="clamp(200px, 24vw, 320px)"
        loop={loop}
        initial={start}
        showNavigation
        label={label}
        onSelect={setActive}
        onActivate={(i) => router.push(`/product/${pieces[i].slug}`)}
        cardClassName="group [&_img]:pointer-events-none"
        className="-mx-4 w-auto md:mx-0"
        renderSlide={(i) => (
          <ProductImage
            image={pieces[i].image}
            category={pieces[i].category}
            colourHex={pieces[i].hex}
            decorative
            priority={i < 2}
            sizes="(min-width: 1280px) 320px, (min-width: 800px) 24vw, 200px"
            className={`h-full overflow-hidden rounded-[10px] ${quiet || pieces[i].gone ? "opacity-60 grayscale" : ""}`}
          />
        )}
      />

      {/* The piece in the middle */}
      <div className="mt-4 flex flex-col items-center text-center" aria-live="polite">
        <p className="font-mono text-[11px] tabular-nums tracking-[0.14em] text-steel-dark">
          <span className="font-semibold text-ink">{String(Math.min(active, pieces.length - 1) + 1).padStart(2, "0")}</span> / {String(pieces.length).padStart(2, "0")}
        </p>
        <h4 className="mt-2 text-lg font-semibold">{piece.name}</h4>
        <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 font-mono text-[13px]">
          <span className="tabular-nums">{formatPrice(piece.price)}</span>
          <span aria-hidden className="text-steel-dark">
            ·
          </span>
          {piece.gone ? (
            <span className="text-steel-dark">Gone</span>
          ) : oneSize ? (
            <span>One size</span>
          ) : (
            <span className="flex gap-2.5">
              <span className="sr-only">Sizes: </span>
              {piece.sizes.map((v) =>
                v.stock > 0 ? (
                  <span key={v.size}>{v.size}</span>
                ) : (
                  <s key={v.size} className="text-steel-dark">
                    {v.size}
                  </s>
                ),
              )}
            </span>
          )}
          {!piece.gone && !quiet && left <= 3 && <span className="bg-ink px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-paper">{left} left</span>}
        </p>
        <Link href={`/product/${piece.slug}`} className="group mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em]">
          View piece
          <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
