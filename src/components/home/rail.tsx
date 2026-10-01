import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { sellable } from "@/lib/inventory";
import { categoryLabels } from "@/lib/site";
import type { Category, Product } from "@/lib/types";
import { MySize } from "./my-size";

const RAIL_SHOWN = 8;

// The rail: the newest pieces first, with a few one-tap filters that open the shop already filtered.
// Links marked data-rail-link pick up the "My size" choice (see my-size.tsx).

const chip = "inline-flex shrink-0 items-center whitespace-nowrap border border-mist px-4 text-sm font-semibold hover:border-ink";

function Chip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} data-rail-link className={`${chip} h-11`}>
      {children}
    </Link>
  );
}

export function Rail({ products }: { products: Product[] }) {
  const live = products.filter((p) => p.status === "live");
  // Newest first; a few extra so "My size" can still fill the grid.
  const pool = [...live].sort((a, b) => (b.liveAt ?? "").localeCompare(a.liveAt ?? "")).slice(0, RAIL_SHOWN * 2);
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
          <div className="flex flex-wrap items-center gap-2">
            <MySize limit={RAIL_SHOWN} />
            <Link href="/shop?price=u1000" data-rail-link className={`${chip} h-11`}>
              Under Rs 1,000
            </Link>
            <Link href="/shop?price=u2500" data-rail-link className={`${chip} h-11`}>
              Under Rs 2,500
            </Link>
          </div>
        </div>

        <nav aria-label="Shop by" className="no-scrollbar -mx-4 mt-6 flex items-center gap-2 overflow-x-auto border-b border-mist px-4 pb-4 md:mx-0 md:flex-wrap md:px-0">
          {anySale && <Chip href="/shop?sale=1">On sale</Chip>}
          {anyNew && <Chip href="/shop?new=1">New in</Chip>}
          {categories.map((c) => (
            <Chip key={c} href={`/shop?category=${c}`}>
              {categoryLabels[c]}
            </Chip>
          ))}
          <Link href="/shop" data-rail-link className="ml-1 inline-flex h-11 shrink-0 items-center whitespace-nowrap px-2 text-sm font-semibold underline underline-offset-4">
            All filters
          </Link>
        </nav>


        <ul id="rail-grid" className="mt-8 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {pool.map((p, i) => (
            <li
              key={p.id}
              // Sizes that can be bought online, for the "My size" switch.
              data-sizes={Array.from(new Set(p.variants.filter((v) => sellable(v) > 0).map((v) => v.size))).join(" ")}
              hidden={i >= RAIL_SHOWN}
            >
              <ProductCard product={p} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
            </li>
          ))}
        </ul>
        <p id="rail-empty" hidden className="py-12 text-center text-steel-dark">
          Nothing on the rail in your size right now.{" "}
          <Link href="/shop" className="underline">
            See everything
          </Link>
        </p>

        <div className="mt-12 flex justify-center">
          <Link href="/shop" data-rail-link className="btn btn-outline">
            Shop all
          </Link>
        </div>
      </div>
    </section>
  );
}
