import Link from "next/link";

import { formatPrice } from "@/lib/format";
import Image from "next/image";
import { VaultBrandAccordion } from "@/components/home/vault-brand-accordion";
import { MONO, themeVars, V, type Theme } from "@/components/vault/look";
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
    <section aria-labelledby="vault-title" style={themeVars(MONO)} className={`section ${V.frost}`}>
      <div className="container-ep">
        <div className={`${V.slate} px-6 py-14 text-white md:px-12`}>
          <h2 id="vault-title" className="display display-h1">
            The Vault
          </h2>
          <p className={`mt-2.5 text-[17px] ${V.iceDim}`}>Original brands. One of each. The first pieces are on their way.</p>
          <Link href="/alerts" className={`mt-6 inline-flex h-11 items-center rounded-full border border-white/40 px-5 ${V.mono} hover:bg-white hover:text-[var(--v-ink)]`}>
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
export function Vault({ products, copy = { title: "The Vault", line: "Original brands. One of each. Never restocked.", button: "Enter the Vault" }, theme }: { products: Product[]; /** Set in Admin → Home page. */ copy?: { title: string; line: string; button: string }; /** The Vault's own colours (Admin → The Vault). */ theme?: Theme }) {
  const pieces = vaultPieces(products);
  if (pieces.length === 0) return <VaultWaiting />;

  const brands = vaultBrands(pieces);
  // One piece from each brand in turn (what can be bought first), five in all.
  const featured = featuredVault(pieces, FEATURED);

  const rs = (n: number) => `Rs ${new Intl.NumberFormat("en-IN").format(n)}`;
  const left = pieces.filter((p) => p.status !== "sold_out");

  // In black and white, like the Vault's own page since 26 Oct 2026 (owner: "make the Vault on the
  // home screen better as well"): one rounded black panel; the name, its line and the way in, with
  // the person from the Vault's opening; the brands as small rounded cards with what they cost
  // from; then five pieces. ("theme" is kept for the caller but no longer tints it.)
  void theme;
  return (
    <section aria-labelledby="vault-title" style={themeVars(MONO)} className="py-10 md:py-14">
      <div className="px-3 md:px-4">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-[#111] px-5 pb-8 pt-7 text-white md:px-10 md:pb-12 md:pt-10 [&_.display]:!font-sans [&_.display]:!font-semibold [&_.display]:!normal-case [&_.display]:!tracking-[-0.03em]">
          {/* The person from the Vault's opening, peeking in on the right */}
          <Image src="/vault/hero-figure.webp" alt="" width={410} height={925} sizes="260px" className="pointer-events-none absolute -top-6 right-[2%] -z-10 hidden h-[115%] w-auto max-w-none opacity-90 [mask-image:linear-gradient(to_bottom,#000_55%,transparent_92%)] lg:block" />

          <div className="flex justify-between gap-4 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/60">
            <span>Easypick · The Vault</span>
            <span className="lg:hidden">{left.length} available</span>
          </div>

          <div className="mt-6 max-w-[620px]">
            <h2 id="vault-title" className="text-[clamp(2.4rem,1.6rem+3.2vw,4.6rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
              {copy.title}
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-white/70">{copy.line}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href={vaultHref()} className="group inline-flex h-12 items-center gap-3 rounded-full bg-white pl-6 pr-1.5 text-[14px] font-semibold text-[#111]">
                {copy.button}
                <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-[#111] text-white transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-45">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-white/60 lg:inline">
                {left.length} of {pieces.length} available · checked by hand
              </span>
            </div>
          </div>

          {/* The brands: cards that open one at a time, with their pictures (owner, 26 Oct 2026, after the "Fey" reference) */}
          {brands.length > 0 && (
            <div className="mt-9 lg:max-w-[calc(100%-300px)]">
              <VaultBrandAccordion
                brands={brands.slice(0, 6).map((b) => {
                  const open = b.pieces.filter((p) => p.status !== "sold_out");
                  const shown = featuredVault(b.pieces, 3);
                  return {
                    name: b.name,
                    href: vaultHref(b.name),
                    n: b.pieces.length,
                    from: open.length ? rs(Math.min(...open.map((p) => p.salePrice ?? p.price))) : "",
                    pics: shown.map((p) => ({ image: p.images[0] ?? { src: null, alt: p.name, kind: "front" as const }, category: p.category, hex: p.colours[0]?.hex ?? "#2b2b2e", name: p.name })),
                  };
                })}
              />
            </div>
          )}

          <ul className="no-scrollbar -mx-5 mt-8 flex snap-x scroll-px-5 gap-4 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-5 md:gap-5 md:overflow-visible md:px-0">
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
