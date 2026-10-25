import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import type { Theme } from "@/components/vault/look";
import { L, luxVars, two } from "@/components/vault/lux/tokens";
import { FadeUp } from "@/components/vault/lux/reveal";
import type { TileData } from "@/components/vault/vault-tile";
import type { Product } from "@/lib/types";

// The Vault: original brands and numbered pieces. Luxury since 25 Oct 2026 (owner): one dark ground,
// ivory text, a serif for display and one brass accent. See components/vault/ for the parts and
// app/vault/page.tsx for the full page.

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

/** Keyboard focus ring for links on the dark band. */
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df]";

/** The one way in: ivory words on a quiet hairline, a brass line that draws across on hover or focus. */
function WayIn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`group relative inline-flex items-center gap-3 pb-2 text-[15px] ${L.ivory} ${FOCUS}`}>
      {children}
      <span aria-hidden className={`${L.brass} transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1`}>
        →
      </span>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-[#ede8df]/30" />
      <span aria-hidden className={`absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 ${L.brassBg} transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100`} />
    </Link>
  );
}

/**
 * The same section before the owner has marked any pieces for the Vault: the heading and a line
 * that says so. Nothing here can be bought or mistaken for stock.
 */
function VaultWaiting() {
  return (
    <section aria-labelledby="vault-title" style={luxVars()} className={`${L.ground} ${L.ivory} ${L.section}`}>
      <div className={L.wrap}>
        <p className={`${L.label} ${L.dim}`}>[ The Vault ]</p>
        <h2 id="vault-title" className={`mt-6 ${L.serif} text-[56px] leading-[0.92] md:text-[96px]`}>
          The Vault
        </h2>
        <p className={`mt-6 max-w-[52ch] text-[16px] leading-[1.5] ${L.dim}`}>Original brands. One of each. The first pieces are on their way.</p>
        <div className="mt-10">
          <WayIn href="/alerts">Get the alert</WayIn>
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
 * The Vault on the home page, in the Vault's own luxury look (owner, 25 Oct 2026): a full-width
 * dark band, the name in a big serif and the one way in, the brands each with its own "Show all",
 * then five pieces in a calm row (swipe on a phone, all five side by side on a wide screen).
 */
export function Vault({
  products,
  copy = { title: "The Vault", line: "Original brands. One of each. Never restocked.", button: "Enter the Vault" },
}: {
  products: Product[];
  /** Set in Admin → Home page. */
  copy?: { title: string; line: string; button: string };
  /** The Vault's own colours (Admin → The Vault). Still accepted, but the home band now always uses the Vault's black ground, so it tints nothing here. */
  theme?: Theme;
}) {
  const pieces = vaultPieces(products);
  if (pieces.length === 0) return <VaultWaiting />;

  const brands = vaultBrands(pieces);
  // One piece from each brand in turn (what can be bought first), five in all.
  const featured = featuredVault(pieces, FEATURED).map((p, i) => toTile(p, i));

  return (
    <section aria-labelledby="vault-title" style={luxVars()} className={`${L.ground} ${L.ivory} ${L.section}`}>
      <div className={L.wrap}>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          {/* The name, the line and the one way in. */}
          <div className="lg:col-span-7">
            <div className={`flex items-baseline justify-between gap-4 ${L.label} ${L.dim} lg:justify-start lg:gap-10`}>
              <span>[ The Vault ]</span>
              <span className="tabular-nums">{two(pieces.length)} pieces</span>
            </div>
            <FadeUp>
              <h2 id="vault-title" className={`mt-6 ${L.serif} text-[56px] leading-[0.92] md:text-[96px] xl:text-[112px]`}>
                {copy.title}
              </h2>
            </FadeUp>
            <FadeUp delay={0.08}>
              <p className={`mt-6 max-w-[52ch] text-[16px] leading-[1.5] md:text-[17px] ${L.dim}`}>{copy.line}</p>
            </FadeUp>
            <FadeUp delay={0.16} className="mt-10">
              <WayIn href={vaultHref()}>{copy.button}</WayIn>
            </FadeUp>
          </div>

          {/* The brands, each with its own way in. */}
          {brands.length > 0 && (
            <nav aria-label="Vault brands" className="lg:col-span-4 lg:col-start-9 lg:self-end">
              <ul className={`border-t ${L.hair}`}>
                {brands.slice(0, 6).map((b) => {
                  const count = `${b.pieces.length} ${b.pieces.length === 1 ? "piece" : "pieces"}`;
                  return (
                    <li key={b.name} className={`border-b ${L.hair}`}>
                      <Link href={vaultHref(b.name)} aria-label={`${b.name} · ${count} · Show all`} className={`group flex items-baseline justify-between gap-4 py-4 ${FOCUS}`}>
                        <span className={`${L.serif} text-[26px] leading-[0.95] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1`}>{b.name}</span>
                        <span className={`shrink-0 ${L.label} ${L.dim} tabular-nums`}>
                          {count} <span className="ml-2 group-hover:text-[#ede8df]">Show all →</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>

        {/* Five pieces in a calm row. */}
        <ul className="no-scrollbar -mx-4 mt-16 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 md:-mx-10 md:mt-24 md:scroll-px-10 md:gap-6 md:px-10 xl:mx-0 xl:grid xl:grid-cols-5 xl:overflow-visible xl:px-0">
          {featured.map((t, i) => (
            <li key={t.id} className="w-[64vw] max-w-[280px] shrink-0 snap-start md:w-[30vw] xl:w-auto xl:max-w-none">
              <FadeUp delay={i * 0.08}>
                <Link href={`/product/${t.slug}`} aria-label={`${t.name}, ${t.sold ? "sold" : t.priceText}`} className={`group block ${FOCUS}`}>
                  <div className="overflow-hidden">
                    <ProductImage
                      image={t.image}
                      category={t.category}
                      colourHex={t.hex}
                      decorative
                      priority={i < 2}
                      sizes="(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 64vw"
                      ground={L.raised}
                      className={`transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] ${t.sold ? "opacity-60" : ""}`}
                    />
                  </div>
                  <div className={`mt-4 flex items-baseline justify-between gap-3 border-t pt-3 ${L.hair} ${L.label} ${L.dim} tabular-nums`}>
                    <span>{two(i + 1)}</span>
                    {t.edition && <span>No. {t.edition}</span>}
                  </div>
                  <p className={`mt-1.5 ${L.label} ${L.dim}`}>{t.brand}</p>
                  <p className={`mt-2 ${L.serif} text-[24px] leading-[0.95]`}>{t.model}</p>
                  <p className={`mt-3 text-[15px] tabular-nums ${t.sold ? L.dim : ""}`}>{t.sold ? "Sold" : t.priceText}</p>
                </Link>
              </FadeUp>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
