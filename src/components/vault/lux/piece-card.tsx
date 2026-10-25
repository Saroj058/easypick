import Link from "next/link";

import { ProductImage, standInSrc } from "@/components/product-image";
import type { TileData } from "@/components/vault/vault-tile";
import { L, two } from "./tokens";

// One Vault piece in the luxury collection (owner, 25 Oct 2026: "revamp it full page like a luxury
// website"). A quiet card for the grid and the same piece as one line for the list view. Pure CSS
// hover, so both stay server components; reduced motion keeps everything still.

const ring = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df]";

/** What a link to a piece is called: its full name, its number and its price (or "sold"). */
const label = (t: TileData) => `${t.name}${t.edition ? `, number ${t.edition}` : ""}, ${t.sold ? "sold" : t.priceText}`;

/**
 * A piece as a card: its photo on the raised ground (4:5, square corners), its place in the list
 * top-left and its number (or "Last one", in brass) top-right. Under it the brand, the model in the
 * serif, its colours and the price. Pointing at it or focusing it slowly enlarges the photo and draws
 * a hairline frame. Sold pieces stay as the archive: the photo greyed and faded, "Sold" for a price.
 */
export function PieceCard({ t, sizes, priority, index }: { t: TileData; sizes: string; priority?: boolean; index?: number }) {
  const corner = t.edition ? `No. ${t.edition}` : !t.sold && t.last ? t.last : "";
  return (
    <Link href={`/product/${t.slug}`} aria-label={label(t)} className={`group block ${ring}`}>
      <span className={`relative block overflow-hidden ${L.raised}`}>
        <span
          className={`block transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.04] motion-safe:group-focus-visible:scale-[1.04] ${t.sold ? "opacity-60 grayscale" : ""}`}
        >
          <ProductImage image={t.image} category={t.category} colourHex={t.hex} decorative priority={priority} ground="bg-transparent" sizes={sizes} />
        </span>
        {/* The hairline frame that comes in on hover or focus */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-2.5 border border-[#ede8df]/30 opacity-0 transition-opacity duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 group-focus-visible:opacity-100"
        />
        {index !== undefined && <span aria-hidden className={`absolute left-4 top-4 ${L.label} tabular-nums ${L.dim}`}>{two(index)}</span>}
        {corner && (
          <span aria-hidden className={`absolute right-4 top-4 ${L.label} tabular-nums ${t.edition ? L.ivory : L.brass}`}>
            {corner}
          </span>
        )}
      </span>
      <span className="mt-4 block">
        <span className={`block ${L.label} ${L.dim}`}>{t.brand}</span>
        <span className={`mt-1.5 block truncate text-[22px] leading-[1.1] ${L.serif} ${L.ivory}`}>{t.model}</span>
        <span className="mt-2.5 flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" aria-hidden>
            {t.colours.slice(0, 4).map((c) => (
              <span key={c.name} title={c.name} className="h-2.5 w-2.5 rounded-full ring-1 ring-[#ede8df]/[0.12]" style={{ background: c.hex }} />
            ))}
          </span>
          <span className={`text-[15px] tabular-nums ${t.sold ? L.dim : L.ivory}`}>{t.sold ? "Sold" : t.priceText}</span>
        </span>
      </span>
    </Link>
  );
}

/**
 * The same piece as one line of the list view: its place, the brand, the model in the serif, its
 * colour and the price (or "Sold"), over a hairline. The data-preview attributes let the list show a
 * small photo by the cursor (desktop, motion allowed): the piece's id, its photo (or stand-in), its
 * colour and kind.
 */
export function PieceRow({ t, index }: { t: TileData; index: number }) {
  const src = t.image.src || standInSrc(t.image.alt || t.name, t.category) || "";
  return (
    <Link
      href={`/product/${t.slug}`}
      aria-label={label(t)}
      data-preview={t.id}
      data-preview-src={src}
      data-preview-hex={t.hex}
      data-preview-category={t.category}
      data-preview-sold={t.sold ? "true" : undefined}
      className={`group grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 border-b ${L.hair} py-5 md:grid-cols-[4rem_11rem_1fr_10rem_8rem] md:gap-x-6 md:py-7 ${ring}`}
    >
      <span aria-hidden className={`${L.label} tabular-nums ${L.dim}`}>{two(index)}</span>
      <span className="min-w-0 md:contents">
        <span className={`block ${L.label} ${L.dim}`}>{t.brand}</span>
        <span
          className={`mt-1 block truncate text-[24px] leading-[1.05] md:mt-0 md:text-[36px] ${L.serif} ${t.sold ? L.dim : L.ivory} transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:translate-x-2 motion-safe:group-focus-visible:translate-x-2`}
        >
          {t.model}
        </span>
      </span>
      <span aria-hidden className={`hidden items-center gap-2 text-[14px] md:flex ${L.dim}`}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-[#ede8df]/[0.12]" style={{ background: t.hex }} />
        <span className="truncate">{t.colour}</span>
      </span>
      <span className={`text-right text-[15px] tabular-nums ${t.sold ? L.dim : L.ivory}`}>{t.sold ? "Sold" : t.priceText}</span>
    </Link>
  );
}
