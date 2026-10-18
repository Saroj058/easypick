import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { V } from "@/components/vault/look";
import { VaultTile, type TileData } from "@/components/vault/vault-tile";
import type { Product } from "@/lib/types";

// The Vault: original brands and numbered pieces. Cold since 18 Oct 2026 (owner, from the FRZN
// reference): a slate panel on frost, pieces on notched ice tiles. See components/vault/ for the parts
// and app/vault/page.tsx for the full page.

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
 * panel that says so. Nothing here can be bought or mistaken for stock.
 */
function VaultWaiting() {
  return (
    <section aria-labelledby="vault-title" className={`section ${V.frost}`}>
      <div className="container-ep">
        <div className={`${V.slate} px-6 py-14 text-white md:px-12`}>
          <h2 id="vault-title" className="display display-h1">
            The Vault
          </h2>
          <p className={`mt-2.5 text-[17px] ${V.iceDim}`}>Original brands. One of each. The first pieces are on their way.</p>
          <Link href="/alerts" className={`mt-6 inline-flex h-11 items-center rounded-full border border-white/40 px-5 ${V.mono} hover:bg-white hover:text-[#1f3347]`}>
            Get the alert
          </Link>
        </div>
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

/** A piece as the Vault's tiles, triptych and spotlight need it (plain data for the client). */
export function toTile(p: Product, order = 0): TileData {
  const sizes = vaultSizes(p);
  const left = sizes.filter((s) => s.left);
  const sold = p.status === "sold_out";
  const last = !sold && left.length === 1 && left[0].size !== "ONE" && p.variants.filter((v) => v.size === left[0].size).reduce((n, v) => n + v.stock, 0) === 1;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand ?? "The Vault",
    model: vaultModel(p),
    price: p.salePrice ?? p.price,
    priceText: formatPrice(p.salePrice ?? p.price),
    sold,
    edition: edition(p),
    colour: p.colours[0]?.name ?? "",
    hex: p.colours[0]?.hex ?? "#2b2b2e",
    colours: p.colours.map((c) => ({ name: c.name, hex: c.hex })),
    sizes,
    image: p.images[0] ?? { src: null, alt: p.name, kind: "front" },
    category: p.category,
    last: last ? `Last one · ${left[0].size}` : "",
    order,
  };
}

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

const FEATURED = 5;

/**
 * The Vault on the home page, cold like its own page (owner, 18 Oct 2026): a slate panel on frost,
 * the name and the way in, the brands each with its own "Show all", then five notched ice tiles.
 */
export function Vault({ products }: { products: Product[] }) {
  const pieces = vaultPieces(products);
  if (pieces.length === 0) return <VaultWaiting />;

  const brands = vaultBrands(pieces);
  // One piece from each brand in turn (what can be bought first), five in all.
  const featured = featuredVault(pieces, FEATURED);

  return (
    <section aria-labelledby="vault-title" className={`section ${V.frost}`}>
      <div className="container-ep">
        <div className={`${V.slate} px-4 pb-10 pt-8 text-white md:px-10 md:pb-12 md:pt-10`}>
          <div className={`mb-6 flex justify-between gap-4 ${V.mono} ${V.iceDim}`}>
            <span>[ Easypick · The Vault ]</span>
            <span>[ {String(pieces.length).padStart(2, "0")} pieces ]</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 id="vault-title" className="display display-h1">
                The Vault
              </h2>
              <p className={`mt-2.5 text-[17px] ${V.iceDim}`}>Original brands. One of each. Never restocked.</p>
            </div>
            <Link href={vaultHref()} className="group inline-flex h-12 items-center gap-3 rounded-full bg-white pl-6 pr-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#1f3347] transition-colors hover:bg-[#c3d4e4]">
              Enter the Vault
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1f3347] text-white transition-transform group-hover:translate-x-0.5" aria-hidden>
                →
              </span>
            </Link>
          </div>

          {/* The brands, each with its own way in. */}
          {brands.length > 0 && (
            <nav aria-label="Vault brands" className="no-scrollbar -mx-4 mt-8 flex overflow-x-auto border-y border-white/15 md:mx-0 md:grid md:grid-cols-6">
              {brands.slice(0, 6).map((b) => (
                <Link
                  key={b.name}
                  href={vaultHref(b.name)}
                  className="group flex h-[104px] min-w-[150px] shrink-0 flex-col items-center justify-center gap-1 border-r border-white/15 px-2 transition-colors last:border-r-0 hover:bg-white/[0.06] md:min-w-0"
                >
                  <span className="text-center font-display text-[24px] uppercase leading-none tracking-[0.04em]">{b.name}</span>
                  <span className={`font-mono text-[11px] ${V.iceDim}`}>
                    {b.pieces.length} {b.pieces.length === 1 ? "piece" : "pieces"}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] underline-offset-4 group-hover:underline">
                    Show all <span aria-hidden>→</span>
                  </span>
                </Link>
              ))}
            </nav>
          )}

          <ul className="no-scrollbar -mx-4 mt-8 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:gap-5 md:overflow-visible md:px-0">
            {featured.map((p, i) => (
              <li key={p.id} className="w-[44vw] max-w-[220px] shrink-0 snap-start md:w-auto md:max-w-none">
                <VaultTile t={toTile(p, i)} sizes="(min-width: 768px) 18vw, 44vw" priority={i < 2} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
