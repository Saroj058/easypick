import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import type { Category, ProductImage as Img } from "@/lib/types";
import { NOTCH, V } from "./look";

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
 * One Vault piece: on a pale ice tile with two corners cut, lifting a little when pointed at.
 * Under it, in small capitals, the brand, the model, its colours and the price; its number or
 * "Last one" when that is true. Sold pieces stay, faded, as the archive.
 */
export function VaultTile({ t, sizes, priority, onSlate = true }: { t: TileData; sizes: string; priority?: boolean; onSlate?: boolean }) {
  const text = onSlate ? "text-white" : V.ink;
  const quiet = onSlate ? V.iceDim : V.ink;
  return (
    <Link
      href={`/product/${t.slug}`}
      aria-label={`${t.name}${t.edition ? `, number ${t.edition}` : ""}, ${t.sold ? "sold" : t.priceText}`}
      className="group block outline-none"
    >
      <span className={`relative block overflow-hidden ${V.tile} ${NOTCH} transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:-translate-y-1.5`}>
        <span className={`block transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:scale-[1.04] ${t.sold ? "opacity-45 grayscale" : ""}`}>
          <ProductImage image={t.image} category={t.category} colourHex={t.hex} decorative priority={priority} ground="bg-transparent" className="[&_img]:mix-blend-multiply" sizes={sizes} />
        </span>
        {/* The light from above, and the piece's shadow at its foot */}
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(255,255,255,0.45),transparent_70%)]" />
        {(t.sold || t.edition) && (
          <span className={`absolute left-3 top-3 rounded-full bg-white/70 px-2 py-0.5 ${V.mono} ${V.ink} backdrop-blur`}>{t.sold ? "Sold" : `No. ${t.edition}`}</span>
        )}
      </span>
      {/* Easier to read than the old all-mono lines: the model in the display face, the price clear. */}
      <span className={`mt-3 block ${V.mono} leading-[1.6] ${quiet}`}>
        <span className="block">{t.brand}</span>
        <span className={`display mt-0.5 block truncate text-[20px] normal-case leading-[1.05] tracking-normal ${text} bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]`}>{t.model}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5">
          {t.colours.slice(0, 3).map((c) => (
            <span key={c.name} className="flex items-center gap-1">
              <span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-white/50" style={{ background: c.hex }} />
              {c.name}
            </span>
          ))}
        </span>
        <span className={`mt-1 block font-mono text-[13px] tabular-nums tracking-[0.06em] ${text}`}>{t.sold ? "Sold · archive" : t.priceText}</span>
        {t.last && <span className="block">{t.last}</span>}
      </span>
    </Link>
  );
}
