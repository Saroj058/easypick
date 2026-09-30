import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { categoryLabels } from "@/lib/site";
import type { Category, Product } from "@/lib/types";
import { MySize } from "./my-size";

const RAIL_SHOWN = 8;

// The rail: the newest pieces first, with one-tap filters that open the shop already filtered.

const PRICE_CHIPS = [
  { href: "/shop?price=u1000", label: "Under Rs 1,000" },
  { href: "/shop?price=u1500", label: "Under Rs 1,500" },
  { href: "/shop?price=u2500", label: "Under Rs 2,500" },
];
const FIT_CHIPS = [
  { href: "/shop?fit=oversized", label: "Oversized" },
  { href: "/shop?fit=relaxed", label: "Relaxed" },
  { href: "/shop?fit=regular", label: "Regular" },
];

function Chip({ href, children, strong = false }: { href: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-10 shrink-0 items-center whitespace-nowrap border px-4 text-sm font-semibold ${
        strong ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mr-1 shrink-0 font-mono text-[12px] tracking-[0.08em] text-steel-dark">{children}</span>;
}

export function Rail({ products }: { products: Product[] }) {
  const live = products.filter((p) => p.status === "live");
  // Newest first; a few extra so "My size" can still fill the grid.
  const pool = [...live].sort((a, b) => (b.liveAt ?? "").localeCompare(a.liveAt ?? "")).slice(0, RAIL_SHOWN * 3);
  const categories = (Object.keys(categoryLabels) as Category[]).filter((c) => live.some((p) => p.category === c));
  const anySale = live.some((p) => p.salePrice);
  const anyNew = live.some((p) => p.isNew);

  if (pool.length === 0) return null;

  return (
    <section aria-labelledby="rail-title" className="pt-16 md:pt-24">
      <div className="container-ep">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="rail-title" className="display display-h1">
            The rail
          </h2>
          <div className="flex items-center gap-2">
            <MySize limit={RAIL_SHOWN} />
            <Link href="/shop?sort=price-asc" className="hidden h-11 items-center whitespace-nowrap border border-mist px-4 text-sm font-semibold hover:border-ink sm:inline-flex">
              Lowest price first
            </Link>
          </div>
        </div>

        <nav aria-label="Categories" className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto border-b border-mist px-4 pb-4 md:mx-0 md:px-0">
          <Chip href="/shop" strong>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c} href={`/shop?category=${c}`}>
              {categoryLabels[c]}
            </Chip>
          ))}
        </nav>

        <div aria-label="Quick filters" role="group" className="no-scrollbar -mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <Label>PRICE</Label>
          {PRICE_CHIPS.map((c) => (
            <Chip key={c.href} href={c.href}>
              {c.label}
            </Chip>
          ))}
          <span className="mx-2 h-6 w-px shrink-0 bg-mist" aria-hidden />
          <Label>FIT</Label>
          {FIT_CHIPS.map((c) => (
            <Chip key={c.href} href={c.href}>
              {c.label}
            </Chip>
          ))}
          {(anySale || anyNew) && <span className="mx-2 h-6 w-px shrink-0 bg-mist" aria-hidden />}
          {anySale && <Chip href="/shop?sale=1">On sale</Chip>}
          {anyNew && <Chip href="/shop?new=1">New in</Chip>}
        </div>

        <ul id="rail-grid" className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {pool.map((p, i) => (
            <li
              key={p.id}
              data-sizes={Array.from(new Set(p.variants.filter((v) => v.stock > 0).map((v) => v.size))).join(" ")}
              hidden={i >= RAIL_SHOWN}
            >
              <ProductCard product={p} priority={i < 2} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
            </li>
          ))}
        </ul>
        <p id="rail-empty" hidden className="py-12 text-center text-steel-dark">
          Nothing on the rail in your size right now. <Link href="/shop" className="underline">See everything</Link>
        </p>

        <div className="mt-12 flex justify-center">
          <Link href="/shop" className="btn btn-outline">
            Shop all
          </Link>
        </div>
      </div>
    </section>
  );
}
