import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { VaultShelf } from "@/components/vault-shelf";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

// The Vault: original brands and numbered pieces. Light since 17 Oct 2026 (owner: "make the Vault
// white"; planned by ten specialists): each brand is a soft grey shelf, like the wall in the store,
// with the pieces standing on it, a small shadow under each and a quiet light that follows the
// pointer. On the home page: the brands, each with its own "Show all", then one shelf of pieces.

/** The quiet text used across the Vault (passes AA on white and on the shelf grey). */
export const VAULT_MUTED = "text-[#55575c]";

/** "07 / 20" for a numbered piece, else "". */
function edition(p: Product) {
  return p.edition ? `${String(p.edition.no).padStart(2, "0")} / ${String(p.edition.of).padStart(2, "0")}` : "";
}

/** "Nike Club Fleece Hoodie" under Nike reads "Club Fleece Hoodie". */
export const vaultModel = (p: Product) => (p.brand && p.name.toLowerCase().startsWith(`${p.brand.toLowerCase()} `) ? p.name.slice(p.brand.length + 1) : p.name);

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
/** The sizes it comes in, in order, with whether each can still be bought. */
export function vaultSizes(p: Product): { size: string; left: boolean }[] {
  const by = new Map<string, boolean>();
  for (const v of p.variants) by.set(v.size, (by.get(v.size) ?? false) || v.stock > 0);
  return Array.from(by, ([size, left]) => ({ size, left })).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
}

/** A stable id for a brand ("Easypick Studio" → "easypick-studio"). */
export const brandId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The same section before the owner has marked any pieces for the Vault: the heading and an empty
 * shelf that says so. Nothing here can be bought or mistaken for stock.
 */
function VaultWaiting() {
  return (
    <section aria-labelledby="vault-title" className="section bg-[#f6f6f4] text-ink">
      <div className="container-ep flex flex-col gap-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 id="vault-title" className="display display-h1 tracking-[0.02em]">
              The Vault
            </h2>
            <p className={`mt-2.5 text-[17px] ${VAULT_MUTED}`}>Original brands. One of each.</p>
          </div>
          <Link href="/alerts" className="shrink-0 text-[15px] font-semibold uppercase tracking-[0.08em] underline-offset-4 hover:underline">
            Get the alert
          </Link>
        </div>
        <p className={`bg-[#ededeb] px-6 py-16 text-center text-[15px] ${VAULT_MUTED}`}>The wall is empty for now. The first pieces are on their way.</p>
      </div>
    </section>
  );
}

/** Pieces the owner has marked for the Vault that the public can see. */
export function vaultPieces(products: Product[]) {
  return products.filter((p) => p.vault && (p.status === "live" || p.status === "sold_out"));
}

/** Brands in the Vault with their pieces, the fullest first. Pieces without a brand are left out of the rows. */
export function vaultBrands(pieces: Product[]) {
  const map = new Map<string, Product[]>();
  for (const p of pieces) if (p.brand) map.set(p.brand, [...(map.get(p.brand) ?? []), p]);
  return Array.from(map, ([name, list]) => ({ name, pieces: list })).sort((a, b) => b.pieces.length - a.pieces.length || a.name.localeCompare(b.name));
}

export const vaultHref = (brand?: string) => (brand ? `/vault?brand=${encodeURIComponent(brand)}` : "/vault");

/** Pieces to show first: buyable before sold, numbered before not, one brand after another. */
export function featuredVault(pieces: Product[], n: number) {
  const order = (list: Product[]) => [...list].sort((a, b) => Number(a.status === "sold_out") - Number(b.status === "sold_out") || Number(Boolean(b.edition)) - Number(Boolean(a.edition)));
  const brands = vaultBrands(pieces);
  const rows = brands.length ? brands.map((b) => order(b.pieces)) : [order(pieces)];
  const out: Product[] = [];
  for (let round = 0; out.length < n && rows.some((r) => r.length > round); round++) {
    for (const r of rows) if (r[round] && out.length < n) out.push(r[round]);
  }
  return out;
}

/**
 * One Vault piece, standing on its shelf: no tile, a soft shadow at its foot. Under it the name and
 * price, then its colour and the sizes it comes in (gone ones struck through), and its number or
 * "Last one" only when that is true. Sold pieces stay, greyed, as the archive.
 */
export function VaultCard({ piece, sizes, priority }: { piece: Product; sizes: string; priority?: boolean }) {
  const sold = piece.status === "sold_out";
  const price = formatPrice(piece.salePrice ?? piece.price);
  const ed = edition(piece);
  const all = vaultSizes(piece);
  const left = all.filter((s) => s.left);
  const last = !sold && left.length === 1 && left[0].size !== "ONE" && piece.variants.filter((v) => v.size === left[0].size).reduce((n, v) => n + v.stock, 0) === 1;
  return (
    <Link
      href={`/product/${piece.slug}`}
      aria-label={`${piece.name}${piece.edition ? `, number ${piece.edition.no} of ${piece.edition.of}` : ""}, ${sold ? "sold" : price}`}
      className="group flex flex-col"
    >
      <span className="relative block">
        <span className={`block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:-translate-y-1.5 ${sold ? "opacity-50 grayscale" : ""}`}>
          <ProductImage
            image={piece.images[0] ?? { src: null, alt: piece.name, kind: "front" }}
            category={piece.category}
            colourHex={piece.colours[0]?.hex ?? "#2b2b2e"}
            decorative
            priority={priority}
            ground="bg-transparent"
            className="[&_img]:mix-blend-multiply"
            sizes={sizes}
          />
        </span>
        {/* The piece's shadow on the shelf */}
        <span aria-hidden className="mx-auto -mt-4 block h-3 w-[58%] rounded-[50%] bg-ink/[0.14] blur-[8px] transition-opacity duration-500 group-hover:opacity-60" />
      </span>
      <span className="mt-3 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-px text-[14px] font-semibold transition-[background-size] duration-300 group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">
          {vaultModel(piece)}
        </span>
        <span className="shrink-0 font-mono text-[13px] tabular-nums">{sold ? "Sold" : price}</span>
      </span>
      <span className={`mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] uppercase tracking-[0.12em] ${VAULT_MUTED}`}>
        <span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-ink/15" style={{ background: piece.colours[0]?.hex ?? "#2b2b2e" }} />
        <span className="max-sm:hidden">{piece.colours[0]?.name ?? ""}</span>
        <span aria-hidden className="text-ink/25 max-sm:hidden">
          ·
        </span>
        <span>
          {all.map((s, i) => (
            <span key={s.size} className={s.left ? "text-ink" : "text-[#5f6166] line-through"}>
              {i > 0 && " "}
              {s.size === "ONE" ? "One size" : s.size}
              {!s.left && <span className="sr-only"> (gone)</span>}
            </span>
          ))}
        </span>
      </span>
      {(ed || last) && <span className={`mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] ${VAULT_MUTED}`}>{[ed, last ? `Last one · ${left[0].size}` : ""].filter(Boolean).join(" · ")}</span>}
    </Link>
  );
}

const FEATURED = 5;

export function Vault({ products }: { products: Product[] }) {
  const pieces = vaultPieces(products);
  if (pieces.length === 0) return <VaultWaiting />;

  const brands = vaultBrands(pieces);
  // One shelf: one piece from each brand in turn (what can be bought first), five in all.
  const featured = featuredVault(pieces, FEATURED);

  return (
    <section aria-labelledby="vault-title" className="section bg-[#f6f6f4] text-ink">
      <div className="container-ep flex flex-col gap-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 id="vault-title" className="display display-h1 tracking-[0.02em]">
              The Vault
            </h2>
            <p className={`mt-2.5 text-[17px] ${VAULT_MUTED}`}>Original brands. One of each.</p>
          </div>
          <InteractiveHoverButton href={vaultHref()} text="Enter the Vault" tone="light" className="min-w-44 shrink-0" />
        </div>

        {/* The brands, each with its own way in. */}
        {brands.length > 0 && (
          <nav aria-label="Vault brands" className="no-scrollbar -mx-4 flex overflow-x-auto border-y border-ink/10 md:mx-0 md:grid md:grid-cols-6">
            {brands.slice(0, 6).map((b) => (
              <Link
                key={b.name}
                href={vaultHref(b.name)}
                className="group flex h-[112px] min-w-[150px] shrink-0 flex-col items-center justify-center gap-1 border-r border-ink/10 px-2 transition-colors last:border-r-0 hover:bg-ink/[0.03] md:min-w-0"
              >
                <span className="text-center font-display text-[24px] uppercase leading-none tracking-[0.04em]">{b.name}</span>
                <span className={`font-mono text-[11px] ${VAULT_MUTED}`}>
                  {b.pieces.length} {b.pieces.length === 1 ? "piece" : "pieces"}
                </span>
                <span className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] underline-offset-4 group-hover:underline">
                  Show all
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            ))}
          </nav>
        )}

        {/* One shelf of pieces */}
        <VaultShelf className="-mx-4 md:mx-0">
          <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:gap-6 md:overflow-visible md:px-0">
            {featured.map((p, i) => (
              <li key={p.id} className="w-[44vw] max-w-[220px] shrink-0 snap-start md:w-auto md:max-w-none">
                <VaultCard piece={p} sizes="(min-width: 768px) 18vw, 44vw" priority={i < 2} />
              </li>
            ))}
          </ul>
        </VaultShelf>
      </div>
    </section>
  );
}
