import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

// The Vault: original brands and numbered pieces, quiet and dark. On the home page: the brands, each
// with its own "Show all" into the Vault page, then a Featured row of five pieces. Until the owner
// marks pieces for it (product settings in admin), the same layout shows empty.

function tag(p: Product) {
  if (p.edition) return `${String(p.edition.no).padStart(2, "0")} / ${String(p.edition.of).padStart(2, "0")}`;
  return p.original ? "ORIGINAL" : "";
}

/**
 * The same section before the owner has marked any pieces for the Vault: the heading, the brand
 * row and four places, all empty and saying so. Nothing here can be bought or mistaken for stock.
 */
function VaultWaiting() {
  return (
    <section aria-labelledby="vault-title" className="on-dark section bg-ink text-[#f2efe8]">
      <div className="container-ep flex flex-col gap-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 id="vault-title" className="display display-h1 tracking-[0.02em]">
              The Vault
            </h2>
            <p className="mt-2.5 text-[17px] text-[#aeaba3]">Original brands and numbered pieces.</p>
          </div>
          <Link href="/alerts" className="shrink-0 text-[15px] font-semibold uppercase tracking-[0.08em] underline-offset-4 hover:underline">
            Get the alert
          </Link>
        </div>

        <div aria-hidden className="no-scrollbar -mx-4 flex overflow-x-auto border-y border-[#2c2c2e] md:mx-0 md:grid md:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="flex h-[88px] min-w-[140px] shrink-0 flex-col items-center justify-center gap-1 border-r border-[#1f1f22] md:min-w-0">
              <span className="font-display text-[28px] uppercase tracking-[0.04em] text-[#3a3a3c]">Brand</span>
              <span className="font-mono text-[11px] text-steel">0{n}</span>
            </div>
          ))}
        </div>

        <ul className="no-scrollbar -mx-4 flex snap-x gap-5 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="w-[64vw] max-w-[280px] shrink-0 snap-start md:w-auto md:max-w-none">
              <div className="flex flex-col gap-3">
                <span className="grid aspect-[4/5] place-items-center bg-[#151517]">
                  <svg width="96" height="96" viewBox="0 0 48 48" fill="none" stroke="#3a3a3c" strokeWidth="1" strokeLinejoin="round" aria-hidden>
                    <path d="M5 31c0-3 2-4 5-4l7-9 4 3 4-2 6 7c5 1 12 2 12 6v2H5z" />
                    <path d="M5 33h38M19 20l3 4M23 18l3 4" />
                  </svg>
                </span>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[12px] uppercase tracking-[0.16em] text-steel">Not in yet</span>
                  <span className="font-mono text-[11px] tracking-[0.08em] text-steel">0{n} / 04</span>
                </span>
                <span className="text-base text-[#aeaba3]">A place is kept for the first pairs.</span>
              </div>
            </li>
          ))}
        </ul>
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

/** One Vault piece: photo on the dark ground, brand and tag, name and price. */
export function VaultCard({ piece, sizes }: { piece: Product; sizes: string }) {
  // The brand has its own line, so the name doesn't repeat it ("Nike Club Fleece Hoodie" reads "Club Fleece Hoodie").
  const model = piece.brand && piece.name.toLowerCase().startsWith(`${piece.brand.toLowerCase()} `) ? piece.name.slice(piece.brand.length + 1) : piece.name;
  return (
    <Link href={`/product/${piece.slug}`} aria-label={`${piece.name}, ${piece.status === "sold_out" ? "sold" : formatPrice(piece.salePrice ?? piece.price)}`} className="group flex flex-col gap-3">
      <span className="block overflow-hidden bg-[#151517]">
        <ProductImage
          image={piece.images[0] ?? { src: null, alt: piece.name, kind: "front" }}
          category={piece.category}
          colourHex={piece.colours[0]?.hex ?? "#2b2b2e"}
          decorative
          className="bg-[#151517] transition-transform duration-300 group-hover:scale-[1.02]"
          sizes={sizes}
        />
      </span>
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] uppercase tracking-[0.16em] text-steel">{piece.brand ?? ""}</span>
        <span className="font-mono text-[11px] tracking-[0.08em] text-steel">{tag(piece)}</span>
      </span>
      <span className="flex justify-between gap-3">
        <span className="text-[15px] leading-snug group-hover:underline">{model}</span>
        <span className="shrink-0 font-mono text-[14px] tabular-nums">{piece.status === "sold_out" ? "Sold" : formatPrice(piece.salePrice ?? piece.price)}</span>
      </span>
    </Link>
  );
}

const FEATURED = 5;

export function Vault({ products }: { products: Product[] }) {
  const pieces = vaultPieces(products);
  if (pieces.length === 0) return <VaultWaiting />;

  const brands = vaultBrands(pieces);
  // Featured: one piece from each brand in turn (what can be bought first), five in all.
  const buyable = (list: Product[]) => [...list].sort((a, b) => Number(a.status === "sold_out") - Number(b.status === "sold_out"));
  const rows = brands.length ? brands.map((b) => buyable(b.pieces)) : [buyable(pieces)];
  const featured: Product[] = [];
  for (let round = 0; featured.length < FEATURED && rows.some((r) => r.length > round); round++) {
    for (const r of rows) if (r[round] && featured.length < FEATURED) featured.push(r[round]);
  }

  return (
    <section aria-labelledby="vault-title" className="on-dark section bg-ink text-[#f2efe8]">
      <div className="container-ep flex flex-col gap-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 id="vault-title" className="display display-h1 tracking-[0.02em]">
              The Vault
            </h2>
            <p className="mt-2.5 text-[17px] text-[#aeaba3]">Original brands and numbered pieces.</p>
          </div>
          <Link href={vaultHref()} className="shrink-0 text-[15px] font-semibold uppercase tracking-[0.08em] underline-offset-4 hover:underline">
            Enter
          </Link>
        </div>

        {/* The brands, each with its own way in. */}
        {brands.length > 0 && (
          <nav aria-label="Vault brands" className="no-scrollbar -mx-4 flex overflow-x-auto border-y border-[#2c2c2e] md:mx-0 md:grid md:grid-cols-6">
            {brands.slice(0, 6).map((b) => (
              <Link
                key={b.name}
                href={vaultHref(b.name)}
                className="group flex h-[124px] min-w-[150px] shrink-0 flex-col items-center justify-center gap-1 border-r border-[#1f1f22] px-2 hover:bg-[#151517] md:min-w-0"
              >
                <span className="text-center font-display text-[26px] uppercase leading-none tracking-[0.04em]">{b.name}</span>
                <span className="font-mono text-[11px] text-steel">
                  {b.pieces.length} {b.pieces.length === 1 ? "piece" : "pieces"}
                </span>
                <span className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] underline-offset-4 group-hover:underline">
                  Show all
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            ))}
          </nav>
        )}

        {/* Featured: the word runs up the left side, five pieces beside it. (Enter, above, is the way to all of them.) */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 lg:gap-6">
          <h3 className="rotate-180 self-stretch border-l border-[#2c2c2e] pl-3 text-center font-display text-[30px] uppercase leading-none tracking-[0.14em] [writing-mode:vertical-rl] lg:pl-5 lg:text-[40px]">
            Featured
          </h3>
          <ul className="no-scrollbar -mr-4 flex snap-x gap-4 overflow-x-auto pr-4 md:mr-0 md:grid md:grid-cols-5 md:overflow-visible md:pr-0">
            {featured.map((p) => (
              <li key={p.id} className="w-[52vw] max-w-[240px] shrink-0 snap-start md:w-auto md:max-w-none">
                <VaultCard piece={p} sizes="(min-width: 768px) 18vw, 52vw" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
