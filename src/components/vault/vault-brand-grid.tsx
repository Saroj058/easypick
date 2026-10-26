import Link from "next/link";

import { ArrowDot } from "./vault-bento";

/**
 * The brands as numbered rounded cards, after the "FWD" reference (owner, 26 Oct 2026): the number,
 * the name, where it began, what it costs from and how many are left (practical first), small pills
 * for what it has here, and the round arrow. The one open is
 * black. "All" comes first.
 */
export function VaultBrandGrid({ brands, active, total }: { brands: { name: string; n: number; href: string; origin: string; kinds: string[]; /** The lowest price still for sale (Infinity when none). */ from: number; left: number }[]; active?: string; total: number }) {
  const allFrom = Math.min(...brands.map((b) => b.from));
  const allLeft = brands.reduce((n, b) => n + b.left, 0);
  const cards = [{ name: "All brands", n: total, href: "/vault", origin: "The whole Vault", kinds: [] as string[], from: allFrom, left: allLeft, on: !active }, ...brands.map((b) => ({ ...b, on: active === b.name }))];
  const rs = (n: number) => `Rs ${new Intl.NumberFormat("en-IN").format(n)}`;
  return (
    <nav aria-label="Vault brands" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
      {cards.map((c, i) => (
        <Link
          key={c.name}
          href={c.href}
          aria-current={c.on ? "page" : undefined}
          className={`group flex min-h-[200px] flex-col ${i === 0 ? "xl:col-span-2" : ""} justify-between rounded-[24px] p-5 transition-[background-color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 md:min-h-[230px] md:p-6 ${c.on ? "bg-[#111] text-white" : "bg-white text-[#111] hover:bg-[#fafaf8]"}`}
        >
          <span className="flex items-start justify-between gap-3">
            <span className="text-[clamp(1.8rem,1.4rem+1.2vw,2.6rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums">{String(i).padStart(2, "0")}</span>
            <span className={`text-right font-mono text-[10.5px] uppercase tracking-[0.14em] ${c.on ? "text-white/60" : "text-[#777]"}`}>
              {c.left} of {c.n} left
            </span>
          </span>
          <span>
            <span className="block text-[clamp(1.25rem,1rem+0.8vw,1.7rem)] font-semibold leading-[1.05] tracking-[-0.03em]">{c.name}</span>
            <span className={`mt-1 block text-[12.5px] ${c.on ? "text-white/60" : "text-[#666]"}`}>{c.origin}</span>
            {Number.isFinite(c.from) && <span className="mt-2 block text-[14px] font-semibold tabular-nums">From {rs(c.from)}</span>}
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
