import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import type { Category, ProductImage as Img } from "@/lib/types";

/** A Vault piece as a tile needs it: plain data, so the client inventory can filter and sort it. */
export interface TileData {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  price: number;
  priceText: string;
  sold: boolean;
  /** "07 / 20" or "". */
  edition: string;
  colour: string;
  hex: string;
  colours: { name: string; hex: string }[];
  sizes: { size: string; left: boolean }[];
  image: Img;
  category: Category;
  /** "Last one · M" when only one piece is left, else "". */
  last: string;
  order: number;
}

/**
 * One Vault piece as a card (owner, 26 Oct 2026, after a Pinterest product card, in black and white):
 * a white card with the picture in a rounded panel, the brand in a notch at its top corner and a thin
 * band across its foot (its number, "Last one" or "Sold"). Under it the name with a quiet "View" link,
 * the price under the name, small and thin, and the sizes still left as small chips. Sold pieces stay,
 * quiet, as the archive.
 */
export function VaultTile({ t, sizes, priority, onSlate = true }: { t: TileData; sizes: string; priority?: boolean; onSlate?: boolean }) {
  const left = t.sizes.filter((s) => s.left).map((s) => (s.size === "ONE" ? "One size" : s.size));
  const band = t.sold ? "Sold" : t.edition ? `No. ${t.edition}` : t.last || "Original · checked by hand";
  const ease = "ease-[cubic-bezier(0.16,1,0.3,1)]";
  return (
    <Link
      href={`/product/${t.slug}`}
      aria-label={`${t.name}${t.edition ? `, number ${t.edition}` : ""}, ${t.sold ? "sold" : t.priceText}`}
      className={`group block rounded-[22px] bg-white p-2 text-[#111] outline-none ring-1 ring-black/5 transition-[transform,box-shadow] duration-500 ${ease} focus-visible:ring-2 focus-visible:ring-[#111] motion-safe:hover:-translate-y-1 ${onSlate ? "shadow-[0_24px_50px_-28px_rgba(0,0,0,0.7)]" : "shadow-[0_18px_40px_-28px_rgba(0,0,0,0.35)]"}`}
    >
      <span className="relative block overflow-hidden rounded-[16px] bg-[#e4e3df]">
        <span className={`block transition-transform duration-[1100ms] ${ease} motion-safe:group-hover:scale-[1.05] motion-safe:group-focus-visible:scale-[1.05] ${t.sold ? "opacity-50 grayscale" : ""}`}>
          <ProductImage image={t.image} category={t.category} colourHex={t.hex} decorative priority={priority} ground="bg-transparent" className="[&_img]:mix-blend-multiply" sizes={sizes} />
        </span>
        {/* The brand, in a notch cut into the top corner */}
        <span className="absolute right-0 top-0 rounded-bl-[14px] bg-white py-1.5 pl-3 pr-2.5 font-mono text-[10px] uppercase tracking-[0.16em]">{t.brand}</span>
        {/* A thin band across the foot */}
        <span className={`absolute inset-x-0 bottom-0 py-1.5 text-center font-mono text-[9.5px] uppercase tracking-[0.18em] ${t.sold ? "bg-[#111]/60 text-white" : "bg-[#111]/85 text-white"}`}>{band}</span>
      </span>

      <span className="block px-2 pb-1.5 pt-3">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="line-clamp-1 block text-[16px] font-medium leading-snug">{t.model}</span>
            {/* The price under the name, small and thin (owner, 26 Oct 2026) */}
            <span className={`mt-0.5 block text-[13px] font-light tabular-nums ${t.sold ? "text-[#888]" : "text-[#111]/80"}`}>{t.sold ? "Sold" : t.priceText}</span>
          </span>
          <span aria-hidden className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11.5px] text-[#111] underline decoration-[#111]/30 underline-offset-4 transition-colors group-hover:decoration-[#111]">
            View <span className={`transition-transform duration-500 ${ease} group-hover:-translate-y-0.5 group-hover:translate-x-0.5`}>↗</span>
          </span>
        </span>
        {/* The sizes still left, as small chips */}
        {!t.sold && left.length > 0 && (
          <span className="mt-2.5 flex flex-wrap gap-1.5">
            {left.slice(0, 5).map((s) => (
              <span key={s} className="rounded-full bg-[#efefed] px-2.5 py-1 text-[10.5px] leading-none text-[#333]">
                {s}
              </span>
            ))}
          </span>
        )}
      </span>
    </Link>
  );
}
