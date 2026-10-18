import Link from "next/link";

import { brandWorld, COLD, themeVars, two } from "./look";

/**
 * The Vault's brands, first thing on the page (owner, 18 Oct 2026): one card each in that brand's
 * own colours, with where it began and how many pieces are here. The one open is lifted and ringed.
 * "All" wears the Vault's own cold blue.
 */
export function VaultBrands({ brands, active, total }: { brands: { name: string; n: number; href: string }[]; active?: string; total: number }) {
  const cards = [{ name: "All brands", n: total, href: "/vault", origin: "The whole Vault", theme: COLD, on: !active }].concat(
    brands.map((b) => {
      const w = brandWorld(b.name);
      return { name: b.name, n: b.n, href: b.href, origin: w?.origin ?? "Original brand", theme: w?.theme ?? COLD, on: active === b.name };
    }),
  );
  return (
    <nav aria-label="Vault brands" className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 pt-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-7">
      {cards.map((c) => (
        <Link
          key={c.name}
          href={c.href}
          aria-current={c.on ? "page" : undefined}
          style={themeVars(c.theme)}
          className={`group relative flex h-[132px] w-[156px] shrink-0 snap-start flex-col justify-between overflow-hidden bg-[var(--v-slate)] p-4 text-white transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [clip-path:polygon(0_0,calc(100%-14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%-14px))] md:w-auto ${
            c.on ? "-translate-y-1 shadow-[0_18px_36px_-18px_rgba(0,0,0,0.55)]" : "hover:-translate-y-1"
          }`}
        >
          {/* The brand's two colours: the panel, and a band of its page colour that grows on hover */}
          <span aria-hidden className={`absolute inset-x-0 bottom-0 bg-[var(--v-frost)] transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${c.on ? "h-2" : "h-1 group-hover:h-2"}`} />
          <span className="flex items-start justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--v-dim)]">{two(c.n)}</span>
            {c.on && <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--v-ink)]">Open</span>}
          </span>
          <span>
            <span className="display block text-[24px] leading-[0.95]">{c.name}</span>
            <span className="mt-1 block truncate font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--v-dim)]">{c.origin}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
