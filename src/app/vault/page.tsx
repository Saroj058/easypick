import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { VaultCard, featuredVault, vaultBrands, vaultHref, vaultModel, vaultPieces, vaultSizes } from "@/components/home/vault";
import { VaultHero, type HeroPiece } from "@/components/vault-hero";
import { formatPrice } from "@/lib/format";
import { getProducts } from "@/lib/store";
import type { Product } from "@/lib/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "The Vault",
  description: "Original brands and numbered pieces, one row per brand.",
  alternates: { canonical: "/vault" },
};

const ROW = 5;
const two = (n: number) => String(n).padStart(2, "0");

/** A piece as the hero needs it (plain data for the client). */
function toHero(p: Product): HeroPiece {
  return {
    slug: p.slug,
    brand: p.brand ?? "The Vault",
    model: vaultModel(p),
    label: p.edition ? `${two(p.edition.no)} / ${two(p.edition.of)}` : p.original ? "ORIGINAL" : "",
    sizes: vaultSizes(p),
    colour: p.colours[0]?.name ?? "",
    hex: p.colours[0]?.hex ?? "#2b2b2e",
    price: formatPrice(p.salePrice ?? p.price),
    sold: p.status === "sold_out",
    image: p.images[0] ?? { src: null, alt: p.name, kind: "front" },
    category: p.category,
  };
}

// The Vault: the only dark page (blueprint 09). Redesigned 17 Oct 2026 after the owner's reference
// and six specialists' plans: a cool graphite ground, quiet mono labels in brackets, a featured
// piece first, then one row per brand as on the store's wall (cut-corner steel tiles), and a
// closing band. A brand's own page (?brand=Nike) shows everything from that brand.
export default async function VaultPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const wanted = Array.isArray(sp.brand) ? sp.brand[0] : sp.brand;
  const pieces = vaultPieces(await getProducts());
  const brands = vaultBrands(pieces);
  const one = wanted ? brands.find((b) => b.name.toLowerCase() === wanted.toLowerCase()) : undefined;
  const shown = one ? [one] : brands;
  const sold = pieces.filter((p) => p.status === "sold_out").length;
  // Sold pieces stay as the archive, after what can still be bought.
  const ordered = (list: typeof pieces) => [...list].sort((a, b) => Number(a.status === "sold_out") - Number(b.status === "sold_out"));
  const tab = (on: boolean) =>
    `relative flex h-11 shrink-0 items-center gap-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em] transition-colors ${on ? "text-[#eef0f2] after:absolute after:inset-x-0 after:bottom-2 after:h-px after:bg-[#eef0f2]" : "text-[#9aa0a6] hover:text-[#eef0f2]"}`;

  return (
    <div className="on-dark min-h-[80svh] overflow-x-clip bg-[#0d0e10] text-[#eef0f2]">
      <div className="container-ep pb-0 pt-8 md:pt-12">
        {/* The page's name, quietly; the featured piece below carries the size */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            {one && (
              <Link href={vaultHref()} className="mb-3 flex min-h-11 items-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.14em] text-[#9aa0a6] hover:text-[#eef0f2]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="rotate-180">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                [ The Vault ]
              </Link>
            )}
            <h1 className={`display tracking-[0.02em] ${one ? "text-[clamp(3rem,2rem+4vw,6rem)] leading-[0.88]" : "text-[clamp(2.2rem,1.8rem+1.6vw,3.2rem)] leading-[0.9]"}`}>{one ? one.name : "The Vault"}</h1>
            <p className="mt-2 text-[15px] text-[#9aa0a6] md:text-[16px]">
              {one ? `${one.pieces.length} ${one.pieces.length === 1 ? "piece" : "pieces"} in the Vault.` : "Original brands. One row each, as on our wall. Never restocked."}
            </p>
          </div>
          {pieces.length > 0 && (
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#9aa0a6]">
              [ {two(brands.length)} {brands.length === 1 ? "brand" : "brands"} · {two(pieces.length)} {pieces.length === 1 ? "piece" : "pieces"}
              {sold ? ` · ${two(sold)} sold` : ""} ]
            </p>
          )}
        </div>

        {/* The featured piece, one brand after another */}
        {!one && pieces.length > 0 && (
          <div className="mt-8 border-t border-[#2a2d31] pt-8 md:mt-10">
            <VaultHero pieces={featuredVault(pieces, 5).map(toHero)} />
          </div>
        )}

        {/* Jump between brands: quiet tabs in brackets, kept in reach while scrolling */}
        {brands.length > 1 && (
          <nav aria-label="Vault brands" className="sticky top-[72px] z-20 -mx-4 mt-10 border-y border-[#2a2d31] bg-[#0d0e10] px-4 md:top-[88px] md:mx-0 md:px-0">
            <div className="no-scrollbar flex gap-6 overflow-x-auto md:gap-8">
              <Link href={vaultHref()} aria-current={one ? undefined : "page"} className={tab(!one)}>
                [ All brands ]
              </Link>
              {brands.map((b) => {
                const on = one?.name === b.name;
                return (
                  <Link key={b.name} href={vaultHref(b.name)} aria-current={on ? "page" : undefined} className={tab(on)}>
                    {b.name}
                    <span className="text-[10px] opacity-60">{two(b.pieces.length)}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {pieces.length === 0 && (
          <p className="mt-12 max-w-[46ch] text-[17px] text-[#9aa0a6]">Nothing is in the Vault yet. Join the list below and we&apos;ll message you when the first pieces arrive.</p>
        )}
        {wanted && !one && pieces.length > 0 && <p className="mt-10 text-[17px] text-[#9aa0a6]">No pieces from &ldquo;{wanted}&rdquo; in the Vault right now. Here is everything else.</p>}

        {/* One row per brand, as on the wall */}
        {shown.map((b, i) => {
          const list = ordered(b.pieces);
          const visible = one ? list : list.slice(0, ROW);
          return (
            <section key={b.name} id={`vault-${b.name}`} aria-labelledby={`vault-h-${b.name}`} className="mt-14 scroll-mt-[150px] md:mt-20">
              <div className="flex items-end justify-between gap-6 border-b border-[#2a2d31] pb-4">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[10.5px] tracking-[0.16em] text-[#9aa0a6]">[ {two(i + 1)} ]</span>
                  <h2 id={`vault-h-${b.name}`} className="font-display text-[34px] uppercase leading-none tracking-[0.03em] md:text-[44px]">
                    {b.name}
                  </h2>
                </div>
                <div className="flex shrink-0 items-center gap-5">
                  <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#9aa0a6] sm:inline">
                    {two(b.pieces.length)} {b.pieces.length === 1 ? "piece" : "pieces"}
                  </span>
                  {!one && (
                    <Link href={vaultHref(b.name)} aria-label={`Show all ${b.name}`} className="group flex min-h-11 items-center gap-1.5 font-mono text-[11.5px] uppercase tracking-[0.14em]">
                      Show all
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                        <path d="M7 17L17 7M9 7h8v8" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
              <ul className={`mt-6 ${one ? "grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 md:gap-x-5 lg:grid-cols-5" : "no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:gap-5 md:overflow-visible md:px-0"}`}>
                {visible.map((p) => (
                  <li key={p.id} className={one ? "" : "w-[66vw] max-w-[260px] shrink-0 snap-start md:w-auto md:max-w-none"}>
                    <VaultCard piece={p} sizes="(min-width: 768px) 18vw, 66vw" />
                  </li>
                ))}
              </ul>
              {/* The shelf edge, faintly lit */}
              <div aria-hidden className="mt-8 h-6 border-t border-[#2a2d31] bg-[linear-gradient(rgba(255,255,255,0.03),transparent)]" />
            </section>
          );
        })}
      </div>

      {/* The close: what the Vault is, the list, and the honest small print */}
      <section aria-labelledby="vault-close" className="relative mt-16 overflow-hidden border-t border-[#2a2d31] bg-[#0a0b0d] md:mt-24">
        <p aria-hidden className="display pointer-events-none absolute inset-x-0 top-4 select-none text-center text-[26vw] leading-[0.8] text-white/[0.035]">
          Vault
        </p>
        <div className="container-ep relative grid gap-10 pb-12 pt-16 md:grid-cols-2 md:pb-16 md:pt-28">
          <p className="max-w-[30ch] font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-[#9aa0a6]">
            The Vault is a wall in our store in Kathmandu. One brand per row, one piece per place.
            <span className="mt-2 block text-[#9aa0a6]/70">[ Come and try it on ]</span>
          </p>
          <p className="max-w-[30ch] font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-[#9aa0a6] md:justify-self-end md:text-right">For those who know. Not for the crowd.</p>

          <h2 id="vault-close" className="display text-[clamp(2.6rem,1.6rem+4.6vw,6.4rem)] leading-[0.86] md:col-span-2">
            Original brands.
            <br />
            One row each.
            <br />
            Never restocked.
          </h2>

          <div className="md:col-span-2 md:flex md:items-end md:justify-between md:gap-10">
            <div className="max-w-md">
              <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#9aa0a6]">[ The Vault list ]</p>
              <AlertSignup dark source="vault" />
            </div>
            <div className="mt-10 md:mt-0 md:text-right">
              {/* A barcode, for the look of a Vault card: drawn, not real */}
              <span aria-hidden className="ml-auto block h-9 w-44 bg-[repeating-linear-gradient(90deg,#eef0f2_0_2px,transparent_2px_4px,#eef0f2_4px_5px,transparent_5px_8px,#eef0f2_8px_11px,transparent_11px_13px)] opacity-70 md:ml-auto" />
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#9aa0a6]">© {new Date().getFullYear()} Easypick · Kathmandu</p>
            </div>
          </div>

          <p className="text-[12.5px] leading-relaxed text-[#9aa0a6] md:col-span-2">Brand names describe the pieces. Easypick is an independent store, not an official store of these brands.</p>
        </div>
      </section>
    </div>
  );
}
