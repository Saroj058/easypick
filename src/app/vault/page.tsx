import type { Metadata } from "next";
import Link from "next/link";

import { VaultCard, vaultBrands, vaultHref, vaultPieces } from "@/components/home/vault";
import { getProducts } from "@/lib/store";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "The Vault",
  description: "Original brands and numbered pieces, one row per brand.",
  alternates: { canonical: "/vault" },
};

const ROW = 5;

// The Vault: the only dark page. One row per brand, as on the store wall; a brand's own page
// (?brand=Nike) shows everything from that brand.
export default async function VaultPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const wanted = Array.isArray(sp.brand) ? sp.brand[0] : sp.brand;
  const pieces = vaultPieces(await getProducts());
  const brands = vaultBrands(pieces);
  const one = wanted ? brands.find((b) => b.name.toLowerCase() === wanted.toLowerCase()) : undefined;
  const shown = one ? [one] : brands;
  // Sold pieces stay as the archive, after what can still be bought.
  const ordered = (list: typeof pieces) => [...list].sort((a, b) => Number(a.status === "sold_out") - Number(b.status === "sold_out"));

  return (
    <div className="on-dark min-h-[80svh] bg-ink text-[#f2efe8]">
      <div className="container-ep pb-24 pt-10 md:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            {one && (
              <Link href={vaultHref()} className="mb-3 flex min-h-11 items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] underline-offset-4 hover:underline">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="rotate-180">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                The Vault
              </Link>
            )}
            <h1 className="display display-h1 tracking-[0.02em]">{one ? one.name : "The Vault"}</h1>
            <p className="mt-2.5 text-[17px] text-[#aeaba3]">
              {one ? `${one.pieces.length} ${one.pieces.length === 1 ? "piece" : "pieces"} in the Vault.` : "Original brands and numbered pieces."}
            </p>
          </div>
          {!one && pieces.length > 0 && (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel">
              {brands.length} {brands.length === 1 ? "brand" : "brands"} · {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
            </p>
          )}
        </div>

        {/* Jump between brands */}
        {brands.length > 1 && (
          <nav aria-label="Vault brands" className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            <Link href={vaultHref()} aria-current={one ? undefined : "page"} className={`flex h-11 shrink-0 items-center border px-4 text-[14px] font-semibold ${one ? "border-[#2c2c2e] hover:border-[#f2efe8]" : "border-[#f2efe8] bg-[#f2efe8] text-ink"}`}>
              All brands
            </Link>
            {brands.map((b) => {
              const on = one?.name === b.name;
              return (
                <Link key={b.name} href={vaultHref(b.name)} aria-current={on ? "page" : undefined} className={`flex h-11 shrink-0 items-center gap-2 border px-4 text-[14px] font-semibold ${on ? "border-[#f2efe8] bg-[#f2efe8] text-ink" : "border-[#2c2c2e] hover:border-[#f2efe8]"}`}>
                  {b.name}
                  <span className={`font-mono text-[11px] font-normal ${on ? "text-ink/70" : "text-steel"}`}>{b.pieces.length}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {pieces.length === 0 && (
          <p className="mt-12 max-w-[46ch] text-[17px] text-[#aeaba3]">
            Nothing is in the Vault yet.{" "}
            <Link href="/alerts" className="text-[#f2efe8] underline underline-offset-4">
              Get the alert
            </Link>{" "}
            for when the first pieces arrive.
          </p>
        )}
        {wanted && !one && pieces.length > 0 && <p className="mt-10 text-[17px] text-[#aeaba3]">No pieces from &ldquo;{wanted}&rdquo; in the Vault right now. Here is everything else.</p>}

        {shown.map((b) => {
          const list = ordered(b.pieces);
          const visible = one ? list : list.slice(0, ROW);
          return (
            <section key={b.name} aria-labelledby={`vault-${b.name}`} className="mt-12 border-t border-[#2c2c2e] pt-6">
              <div className="flex items-end justify-between gap-6">
                <div className="flex items-baseline gap-4">
                  <h2 id={`vault-${b.name}`} className="font-display text-[34px] uppercase leading-none tracking-[0.03em] md:text-[40px]">
                    {b.name}
                  </h2>
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel">
                    {b.pieces.length} {b.pieces.length === 1 ? "piece" : "pieces"}
                  </span>
                </div>
                {!one && (
                  <Link href={vaultHref(b.name)} aria-label={`Show all ${b.name}`} className="flex min-h-11 shrink-0 items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] underline-offset-4 hover:underline">
                    Show all
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                )}
              </div>
              <ul className={`mt-6 ${one ? "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 lg:grid-cols-5" : "no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0"}`}>
                {visible.map((p) => (
                  <li key={p.id} className={one ? "" : "w-[56vw] max-w-[240px] shrink-0 snap-start md:w-auto md:max-w-none"}>
                    <VaultCard piece={p} sizes="(min-width: 768px) 18vw, 56vw" />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
