import Link from "next/link";

import { ArrowDot } from "./vault-bento";

/**
 * The brands as numbered rounded cards, after the "FWD" reference (owner, 26 Oct 2026): the number,
 * the name, where it began, small pills for what it has here, and the round arrow. The one open is
 * black. "All" comes first.
 */
export function VaultBrandGrid({ brands, active, total }: { brands: { name: string; n: number; href: string; origin: string; kinds: string[] }[]; active?: string; total: number }) {
  const cards = [{ name: "All brands", n: total, href: "/vault", origin: "The whole Vault", kinds: [] as string[], on: !active }, ...brands.map((b) => ({ ...b, on: active === b.name }))];
  return (
    <nav aria-label="Vault brands" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
      {cards.map((c, i) => (
        <Link
          key={c.name}
          href={c.href}
          aria-current={c.on ? "page" : undefined}
          className={`group flex min-h-[200px] flex-col justify-between rounded-[24px] p-5 transition-[background-color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 md:min-h-[230px] md:p-6 ${c.on ? "bg-[#111] text-white" : "bg-white text-[#111] hover:bg-[#fafaf8]"}`}
        >
          <span className="flex items-start justify-between gap-3">
            <span className="text-[clamp(1.8rem,1.4rem+1.2vw,2.6rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums">{String(i).padStart(2, "0")}</span>
            <span className={`font-mono text-[10.5px] uppercase tracking-[0.14em] ${c.on ? "text-white/60" : "text-[#777]"}`}>{c.n} pieces</span>
          </span>
          <span>
            <span className="block text-[clamp(1.25rem,1rem+0.8vw,1.7rem)] font-semibold leading-[1.05] tracking-[-0.03em]">{c.name}</span>
            <span className={`mt-1 block text-[12.5px] ${c.on ? "text-white/60" : "text-[#666]"}`}>{c.origin}</span>
            <span className="mt-4 flex items-end justify-between gap-3">
              <span className="flex flex-wrap gap-1.5">
                {c.kinds.slice(0, 3).map((k) => (
                  <span key={k} className={`rounded-full px-2.5 py-1 text-[11px] ${c.on ? "bg-white/10 text-white" : "bg-[#efeeea] text-[#333]"}`}>
                    {k}
                  </span>
                ))}
              </span>
              <ArrowDot dark={c.on} />
            </span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
