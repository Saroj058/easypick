"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PriceTag } from "@/components/hang-tag";
import { ProductImage } from "@/components/product-image";
import { QuickBuy } from "@/components/quick-buy";
import { StackedCarousel } from "@/components/ui/stacked-carousel";
import type { Category, Product, ProductImage as Img } from "@/lib/types";

export interface FeaturedPiece {
  slug: string;
  /** The name without its brand ("Club Fleece Hoodie"). */
  name: string;
  brand: string;
  /** "ORIGINAL", "07 / 20" or empty. */
  tag: string;
  price: string;
  /** A code for the tag's barcode. */
  sku: string;
  image: Img;
  category: Category;
  hex: string;
  /** The whole piece, for Quick buy. */
  product: Product;
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
        cardClassName="group bg-[#151517]"
        renderCard={(i) => {
          const p = pieces[i];
          return (
            <>
              <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative sizes="(min-width: 1024px) 256px, (min-width: 640px) 224px, 176px" className="h-full overflow-hidden [&_img]:pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
              <span className="absolute right-3 top-3 bg-[#f2efe8] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink">{p.brand}</span>
              <div className="absolute inset-x-3 bottom-3 text-[#f2efe8]">
                <p className="text-[15px] font-semibold leading-tight">{p.name}</p>
                {p.tag && <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-[#aeaba3]">{p.tag}</p>}
              </div>
              {/* The price, on a tag tied to the bottom of the card and hanging under it. Only the front card shows its tag. */}
              <div className={`absolute right-3 top-full -mt-3 transition-opacity duration-300 ${i === front ? "opacity-100" : "opacity-0"}`}>
                <PriceTag price={p.price} sku={p.sku} onDark />
              </div>
            </>
          );
        }}
      />
      {/* The front piece, in words, and Quick buy. (Tapping the front card opens the piece.) */}
      <div aria-live="polite" className="mt-2 flex min-h-11 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[15px]">
        <span className="text-[#aeaba3]">
          {piece.brand} · {piece.name}
          {/* The price is on the card's hang tag; this says it for screen readers, which the tag is hidden from. */}
          <span className="sr-only">, {piece.price}</span>
        </span>
        {/* Buy it from here: the size picker, then the checkout. */}
        <QuickBuy
          key={piece.slug}
          product={piece.product}
          className="flex h-11 items-center rounded-full bg-[#f2efe8] px-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink hover:bg-paper"
          trigger="Quick buy"
        />
      </div>
    </div>
  );
}
