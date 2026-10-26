import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import type { Category, ProductImage as Img } from "@/lib/types";
import { V } from "./look";

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
 * One Vault piece (owner, 25 Oct 2026: "make the inventory cards better"): a calm square frame on
 * soft grey, the piece large in it; its number, "Last one" or "Sold" as a small solid label; on
 * hover or focus the picture eases in and the sizes still left rise from the foot. Under it the
 * brand and its colours, then the name and the price side by side. Sold pieces stay, quiet, as
 * the archive.
 */
export function VaultTile({ t, sizes, priority, onSlate = true }: { t: TileData; sizes: string; priority?: boolean; onSlate?: boolean }) {
  const text = onSlate ? "text-white" : V.ink;
  const quiet = onSlate ? V.iceDim : V.ink;
  const left = t.sizes.filter((s) => s.left).map((s) => (s.size === "ONE" ? "One size" : s.size));
  const label = t.sold ? "Sold" : t.edition ? `No. ${t.edition}` : t.last;
  const ease = "ease-[cubic-bezier(0.16,1,0.3,1)]";
  return (
    <Link
      href={`/product/${t.slug}`}
      aria-label={`${t.name}${t.edition ? `, number ${t.edition}` : ""}, ${t.sold ? "sold" : t.priceText}`}
      className="group block outline-none"
    >
      <span className={`relative block overflow-hidden bg-[#e4e3df] ring-1 ring-inset ring-black/5`}>
        <span className={`block transition-transform duration-[1100ms] ${ease} motion-safe:group-hover:scale-[1.05] motion-safe:group-focus-visible:scale-[1.05] ${t.sold ? "opacity-50 grayscale" : ""}`}>
          <ProductImage image={t.image} category={t.category} colourHex={t.hex} decorative priority={priority} ground="bg-transparent" className="[&_img]:mix-blend-multiply" sizes={sizes} />
        </span>
        {label && (
          <span className={`absolute left-0 top-0 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${t.sold ? "bg-[#111]/70 text-white" : t.edition ? "bg-white text-[#111]" : "bg-[#111] text-white"}`}>{label}</span>
        )}
        {/* The sizes still left, rising from the foot on hover or focus */}
        {!t.sold && left.length > 0 && (
          <span aria-hidden className={`absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between gap-2 bg-white/95 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#111] transition-transform duration-500 ${ease} group-hover:translate-y-0 group-focus-visible:translate-y-0`}>
            <span className="text-[#666]">Sizes</span>
            <span className="flex gap-2.5">
              {left.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </span>
          </span>
        )}
      </span>

      {/* Under it: the brand and its colours, then the name and the price side by side */}
      <span className="mt-3.5 flex items-center justify-between gap-3">
        <span className={`${V.mono} ${quiet}`}>{t.brand}</span>
        <span aria-hidden className="flex gap-1.5">
          {t.colours.slice(0, 4).map((c) => (
            <span key={c.name} title={c.name} className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40" style={{ background: c.hex }} />
          ))}
        </span>
      </span>
      <span className="mt-1.5 flex items-start justify-between gap-3">
        <span className={`display line-clamp-2 min-w-0 text-[21px] normal-case leading-[1.05] ${text} bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 ${ease} group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]`}>{t.model}</span>
        <span className={`shrink-0 pt-0.5 font-mono text-[14px] tabular-nums ${t.sold ? quiet : text}`}>{t.sold ? "Sold" : t.priceText}</span>
      </span>
    </Link>
  );
}
