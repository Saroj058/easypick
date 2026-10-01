"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProductImage } from "@/components/product-image";
import { StackedCarousel } from "@/components/ui/stacked-carousel";
import type { Category, ProductImage as Img } from "@/lib/types";

export interface FeaturedPiece {
  slug: string;
  /** The name without its brand ("Club Fleece Hoodie"). */
  name: string;
  brand: string;
  /** "ORIGINAL", "07 / 20" or empty. */
  tag: string;
  price: string;
  image: Img;
  category: Category;
  hex: string;
}

/** The Vault's featured pieces as a fanned stack: flick through them, tap the front one to open it. */
export function VaultFeatured({ pieces }: { pieces: FeaturedPiece[] }) {
  const router = useRouter();
  const [front, setFront] = useState(0);
  const piece = pieces[Math.min(front, pieces.length - 1)];

  return (
    <div className="min-w-0">
      <StackedCarousel
        count={pieces.length}
        label="Featured pieces"
        onSelect={setFront}
        onActivate={(i) => router.push(`/product/${pieces[i].slug}`)}
        cardClassName="bg-[#151517]"
        renderCard={(i) => {
          const p = pieces[i];
          return (
            <>
              <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative sizes="(min-width: 1024px) 256px, (min-width: 640px) 224px, 176px" className="h-full [&_img]:pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
              <span className="absolute right-3 top-3 bg-[#f2efe8] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink">{p.brand}</span>
              <div className="absolute inset-x-3 bottom-3 text-[#f2efe8]">
                <p className="text-[15px] font-semibold leading-tight">{p.name}</p>
                <p className="mt-1 flex items-baseline justify-between gap-2 font-mono text-[13px] tabular-nums">
                  {p.price}
                  {p.tag && <span className="text-[10px] tracking-[0.08em] text-[#aeaba3]">{p.tag}</span>}
                </p>
              </div>
            </>
          );
        }}
      />
      {/* The front piece, in words, with a plain link to it. */}
      <p aria-live="polite" className="mt-2 flex min-h-11 flex-wrap items-center justify-center gap-x-3 text-center text-[15px]">
        <span className="text-[#aeaba3]">
          {piece.brand} · {piece.name} · <span className="font-mono tabular-nums">{piece.price}</span>
        </span>
        <Link href={`/product/${piece.slug}`} className="flex h-11 items-center font-semibold uppercase tracking-[0.08em] text-[13px] underline underline-offset-4">
          View piece
        </Link>
      </p>
    </div>
  );
}
