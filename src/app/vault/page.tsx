import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { VAULT_MUTED, VaultCard, brandId, featuredVault, vaultBrands, vaultHref, vaultModel, vaultPieces, vaultSizes } from "@/components/home/vault";
import { VaultHero, type HeroPiece } from "@/components/vault-hero";
import { VaultShelf } from "@/components/vault-shelf";
import { formatPrice } from "@/lib/format";
import { site, walletList } from "@/lib/site";
import { getProducts } from "@/lib/store";
import type { Product } from "@/lib/types";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "The Vault",
  description: "Original brands at Easypick, Kathmandu. One row per brand, one of each piece.",
  alternates: { canonical: "/vault" },
};

const ROW = 5;
const two = (n: number) => String(n).padStart(2, "0");

/** A piece as the featured plinth needs it (plain data for the client). */
function toHero(p: Product): HeroPiece {
  return {
    slug: p.slug,
    brand: p.brand ?? "The Vault",
    model: vaultModel(p),
    label: p.edition ? `${two(p.edition.no)} / ${two(p.edition.of)}` : "",
    sizes: vaultSizes(p),
    colour: p.colours[0]?.name ?? "",
    hex: p.colours[0]?.hex ?? "#2b2b2e",
    price: formatPrice(p.salePrice ?? p.price),
    sold: p.status === "sold_out",
    image: p.images[0] ?? { src: null, alt: p.name, kind: "front" },
    category: p.category,
  };
}

// The Vault, light (owner, 17 Oct 2026: "make the Vault white"; planned by ten specialists).
// A quiet opening (the name, one line, the plain facts; on wide screens one featured piece on its
// plinth), brand tabs kept in reach, then one soft grey shelf per brand like the wall in the store,
// the pieces standing on it. A brand's own page (?brand=Nike) shows everything from that brand.
// Ends with the Vault list and the small print.
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
  const featured = featuredVault(pieces, 5);
  // The plain facts, only what's true today.
  const facts = [
    "Original brands",
    "Every size shown",
    site.store.address ? "Try it on in our store" : "Try-on in store · opening soon",
    `Pay with ${walletList()}`,
    `Free delivery over ${formatPrice(site.delivery.freeAbove)}`,
  ];
  const tab = (on: boolean) =>
    `relative flex h-11 shrink-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors ${on ? "text-ink after:absolute after:inset-x-0 after:bottom-2 after:h-px after:bg-ink" : `${VAULT_MUTED} hover:text-ink`}`;

  return (
    <div className="vault min-h-[80svh] overflow-x-clip bg-[#f6f6f4] text-ink">
      {/* The opening */}
      <div className="container-ep pt-8 md:pt-12">
        <div className={`grid gap-10 ${!one && featured.length ? "lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center lg:gap-16" : ""}`}>
          <div className="min-w-0">
            {one ? (
              <Link href={vaultHref()} className={`mb-2 inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] ${VAULT_MUTED} hover:text-ink`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="rotate-180">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                The Vault
              </Link>
            ) : (
              <p className={`font-mono text-[10.5px] uppercase tracking-[0.16em] ${VAULT_MUTED}`}>Easypick · Kathmandu</p>
            )}
            <h1 className="display mt-2 text-[clamp(3.2rem,2rem+5vw,7.5rem)] leading-[0.84] tracking-[0.005em]">{one ? one.name : "The Vault"}</h1>
            <p className={`mt-4 max-w-[44ch] text-[16px] md:text-[17px] ${VAULT_MUTED}`}>
              {one
                ? one.pieces.length === 1
                  ? `1 piece from ${one.name}.`
                  : `${one.pieces.length} pieces from ${one.name}.`
                : "Original brands, one row each, like the wall in our store. Never restocked."}
            </p>
            {pieces.length > 0 && (
              <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
                {two(brands.length)} {brands.length === 1 ? "brand" : "brands"} · {two(pieces.length)} {pieces.length === 1 ? "piece" : "pieces"}
                {sold ? ` · ${two(sold)} sold` : ""}
              </p>
            )}
            {/* The plain facts, one quiet line */}
            <ul aria-label="Good to know" className={`no-scrollbar -mx-4 mt-6 flex gap-x-5 overflow-x-auto whitespace-nowrap border-y border-ink/10 px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] md:mx-0 md:flex-wrap md:gap-y-1 md:px-0 ${VAULT_MUTED}`}>
              {facts.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span aria-hidden className="h-1 w-1 rounded-full bg-ink/40" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          {!one && featured.length > 0 && (
            <div className="hidden lg:block">
              <VaultHero pieces={featured.map(toHero)} />
            </div>
          )}
        </div>

        {/* The brands, kept in reach while scrolling (the header is 72px on phones, 88px wider) */}
        {brands.length > 1 && (
          <nav aria-label="Vault brands" className="sticky top-[72px] z-20 -mx-4 mt-10 border-b border-ink/10 bg-[#f6f6f4]/90 px-4 backdrop-blur md:top-[88px] md:mx-0 md:mt-14 md:px-0">
            <div className="no-scrollbar flex gap-6 overflow-x-auto [mask-image:linear-gradient(90deg,#000_calc(100%-24px),transparent)] md:gap-8 md:[mask-image:none]">
              <Link href={vaultHref()} aria-current={one ? undefined : "page"} className={tab(!one)}>
                All
              </Link>
              {brands.map((b) => {
                const on = one?.name === b.name;
                return (
                  <Link key={b.name} href={vaultHref(b.name)} aria-current={on ? "page" : undefined} className={tab(on)}>
                    {b.name}
                    <span className="font-mono text-[10px] font-normal opacity-70">{two(b.pieces.length)}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {pieces.length === 0 && <p className={`mt-12 max-w-[46ch] text-[17px] ${VAULT_MUTED}`}>The wall is empty for now. Join the list below and we&apos;ll message you when the first pieces arrive.</p>}
        {wanted && !one && pieces.length > 0 && <p className={`mt-10 text-[17px] ${VAULT_MUTED}`}>Nothing from &ldquo;{wanted}&rdquo; right now. Here&apos;s the rest of the wall.</p>}
      </div>

      {/* One shelf per brand, as on the wall */}
      {shown.map((b, i) => {
        const list = ordered(b.pieces);
        const visible = one ? list : list.slice(0, ROW);
        const id = brandId(b.name);
        const allSold = b.pieces.every((p) => p.status === "sold_out");
        return (
          <section key={b.name} id={`vault-${id}`} aria-labelledby={`vault-h-${id}`} className="mt-14 scroll-mt-[150px] md:mt-20">
            <div className="container-ep flex items-end justify-between gap-6 pb-4">
              <h2 id={`vault-h-${id}`} className="font-display text-[34px] uppercase leading-[0.85] tracking-[0.02em] md:text-[52px]">
                {b.name}
              </h2>
              <div className="flex shrink-0 items-center gap-5">
                <span className={`hidden font-mono text-[10.5px] uppercase tracking-[0.14em] sm:inline ${VAULT_MUTED}`}>{allSold ? "All sold" : `${two(b.pieces.length)} ${b.pieces.length === 1 ? "piece" : "pieces"}`}</span>
                {!one && (
                  <Link href={vaultHref(b.name)} aria-label={`Show all ${b.name}`} className="group flex min-h-11 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em]">
                    See all
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
            <VaultShelf>
              <div className="mx-auto max-w-[1280px] 2xl:max-w-[1440px]">
                <ul className={one ? "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6 lg:grid-cols-5" : "no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:gap-6 md:overflow-visible md:px-0"}>
                  {visible.map((p, k) => (
                    <li key={p.id} className={one ? "" : "w-[44vw] max-w-[220px] shrink-0 snap-start md:w-auto md:max-w-none"}>
                      <VaultCard piece={p} sizes="(min-width: 768px) 18vw, 44vw" priority={i === 0 && k < 2} />
                    </li>
                  ))}
                </ul>
              </div>
            </VaultShelf>
          </section>
        );
      })}

      {/* The close: the Vault list, and the small print */}
      <section aria-labelledby="vault-list" className="relative mt-20 overflow-hidden border-t border-ink/10 md:mt-28">
        <p aria-hidden className="display pointer-events-none absolute inset-x-0 -top-[0.08em] select-none text-center text-[24vw] leading-[0.8] text-ink/[0.04]">
          Vault
        </p>
        <div className="container-ep relative grid gap-8 pb-[calc(56px+env(safe-area-inset-bottom)+32px)] pt-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end md:gap-12 md:pb-20 md:pt-28">
          <div>
            <p className={`font-mono text-[10.5px] uppercase tracking-[0.16em] ${VAULT_MUTED}`}>The Vault list</p>
            <h2 id="vault-list" className="display mt-2 text-[clamp(2.4rem,1.8rem+2.4vw,4rem)] leading-[0.9]">
              Never restocked.
            </h2>
            <p className={`mt-3 max-w-[40ch] text-[15px] ${VAULT_MUTED}`}>A new piece goes up a few times a month. Get one message when it does.</p>
          </div>
          <div>
            <AlertSignup source="vault" note="One message when a new piece lands. Stop anytime." done="You're in. We'll message {to} when a new piece lands." />
          </div>
          <p className={`text-[12.5px] leading-relaxed md:col-span-2 ${VAULT_MUTED}`}>Brand names describe the pieces. Easypick is an independent store, not an official seller of these brands.</p>
        </div>
      </section>
    </div>
  );
}
