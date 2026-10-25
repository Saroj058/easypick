import Link from "next/link";

import { brandWorld, COLD, themeVars, two, type BrandWorld, type Theme } from "./look";

/** "Herzogenaurach, Germany · 1949" reads "Herzogenaurach · 1949", so it fits the card without being cut. */
const short = (origin: string) => {
  const [place, year] = origin.split("·").map((x) => x.trim());
  return year ? `${place.split(",")[0]} · ${year}` : origin;
};

/**
 * The Vault's brands, first thing on the page (owner, 18 Oct 2026): one card each in that brand's
 * own colours, with where it began and how many pieces are here. Black and white since 25 Oct 2026
 * (owner): dark cards, the open one white; each brand keeps a thin line of its own colour.
 */
export function VaultBrands({ brands, active, total, worlds, cold = COLD }: { brands: { name: string; n: number; href: string }[]; active?: string; total: number; /** Set in Admin → The Vault. */ worlds?: Record<string, BrandWorld>; cold?: Theme }) {
  const cards = [{ name: "All brands", n: total, href: "/vault", origin: "The whole Vault", theme: cold, on: !active }].concat(
    brands.map((b) => {
      const w = brandWorld(b.name, worlds);
      return { name: b.name, n: b.n, href: b.href, origin: w?.origin ?? "Original brand", theme: w?.theme ?? cold, on: active === b.name };
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
          className={`group relative flex h-[132px] w-[156px] shrink-0 snap-start flex-col justify-between overflow-hidden p-4 transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [clip-path:polygon(0_0,calc(100%-14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%-14px))] md:w-auto ${
            c.on ? "bg-[#f2f1ed] text-[#111]" : "bg-[#1d1d1d] text-white hover:-translate-y-1 hover:bg-[#262626]"
          }`}
        >
          {/* The brand's own colour, as a thin line that grows on hover */}
          <span aria-hidden className={`absolute inset-x-0 bottom-0 bg-[var(--v-slate)] transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${c.on ? "h-2" : "h-1 group-hover:h-2"}`} />
          <span className="flex items-start justify-between gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${c.on ? "text-[#555]" : "text-white/65"}`}>{two(c.n)}</span>
            {c.on && <span className="rounded-full bg-[#111] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-white">Open</span>}
          </span>
          <span>
            <span className="display block text-[24px] leading-[0.95]">{c.name}</span>
            <span className={`mt-1 block font-mono text-[10px] uppercase leading-[1.4] tracking-[0.12em] ${c.on ? "text-[#555]" : "text-white/65"}`}>{short(c.origin)}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
