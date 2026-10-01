import { ProductCard } from "@/components/product-card";
import { sellable } from "@/lib/inventory";
import { categoryLabels } from "@/lib/site";
import type { Category, Product } from "@/lib/types";
import { RailControls, type RailItem, type RailTab } from "./rail-controls";

const RAIL_SHOWN = 8;
/** The newest pieces the rail can filter through without leaving the page. */
const RAIL_POOL = 48;
const BUDGETS = [1000, 1500, 2500];

// The rail: the newest pieces first, filtered in place by size, budget and kind (see rail-controls.tsx).

export function Rail({ products }: { products: Product[] }) {
  const live = products.filter((p) => p.status === "live");
  const pool = [...live].sort((a, b) => (b.liveAt ?? "").localeCompare(a.liveAt ?? "")).slice(0, RAIL_POOL);
  if (pool.length === 0) return null;

  const items: RailItem[] = pool.map((p) => ({
    sizes: Array.from(new Set(p.variants.filter((v) => sellable(v) > 0).map((v) => v.size))),
    category: p.category,
    price: p.salePrice ?? p.price,
    isNew: Boolean(p.isNew),
    sale: Boolean(p.salePrice),
  }));
  const tabs: RailTab[] = [
    { key: "all", label: "All" },
    // "New in" only when it narrows the rail (not when every piece is new).
    ...(items.some((i) => i.isNew) && !items.every((i) => i.isNew) ? [{ key: "new", label: "New in" }] : []),
    ...(items.some((i) => i.sale) ? [{ key: "sale", label: "On sale" }] : []),
    ...(Object.keys(categoryLabels) as Category[]).filter((c) => items.some((i) => i.category === c)).map((c) => ({ key: c, label: categoryLabels[c] })),
  ];
  // Only budgets that narrow the rail: at least one piece under it, and not every piece.
  const budgets = BUDGETS.filter((b) => {
    const n = items.filter((i) => i.price < b).length;
    return n > 0 && n < items.length;
  });

  return (
    <section aria-labelledby="rail-title" className="pt-16 md:pt-24">
      <div className="container-ep">
        <div className="flex items-end justify-between gap-4">
          <h2 id="rail-title" className="display display-h1">
            The rail
          </h2>
          <p className="pb-1 text-right font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">
            {live.length} {live.length === 1 ? "piece" : "pieces"} live
            <span className="hidden sm:inline"> · fixed prices</span>
          </p>
        </div>

        <RailControls items={items} tabs={tabs} budgets={budgets} step={RAIL_SHOWN}>
          <ul id="rail-grid" className="mt-4 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
            {pool.map((p, i) => (
              <li key={p.id} data-sizes={items[i].sizes.join(" ")} hidden={i >= RAIL_SHOWN}>
                <ProductCard product={p} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
              </li>
            ))}
          </ul>
        </RailControls>
      </div>
    </section>
  );
}
