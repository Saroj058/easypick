import { ProductCard } from "@/components/product-card";
import { sellable } from "@/lib/inventory";
import { categoryLabels } from "@/lib/site";
import type { Category, Product } from "@/lib/types";
import { RailControls, type RailItem, type RailTab } from "./rail-controls";

const RAIL_SHOWN = 8;
/** The newest pieces the rail holds as cards; counts cover every live piece, and the shop holds them all. */
const RAIL_POOL = 48;
const BUDGETS = [1000, 1500, 2500];

// The rail: the newest pieces first, filtered and sorted in place (see rail-controls.tsx).

export function Rail({ products }: { products: Product[] }) {
  const live = products.filter((p) => p.status === "live").sort((a, b) => (b.liveAt ?? "").localeCompare(a.liveAt ?? ""));
  if (live.length === 0) return null;

  const items: RailItem[] = live.map((p) => ({
    id: p.id,
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
    <section aria-labelledby="rail-title" className="pt-12 md:pt-20">
      <div className="container-ep">
        <RailControls
          items={items}
          tabs={tabs}
          budgets={budgets}
          step={RAIL_SHOWN}
          cards={live.slice(0, RAIL_POOL).map((p) => (
            <ProductCard key={p.id} product={p} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
          ))}
        />
      </div>
    </section>
  );
}
