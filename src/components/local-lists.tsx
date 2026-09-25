"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";
import { useList } from "./saved";

// Lists built from what this browser saved or looked at (see saved.tsx).

function pick(products: Product[], slugs: string[], exclude?: string) {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  return slugs.filter((s) => s !== exclude).flatMap((s) => bySlug.get(s) ?? []);
}

/** A row of what they looked at lately. Renders nothing until there's something to show. */
export function RecentlyViewed({ products, exclude, title = "Recently viewed" }: { products: Product[]; exclude?: string; title?: string }) {
  const list = pick(products, useList("recent"), exclude).slice(0, 8);
  if (list.length === 0) return null;
  return (
    <section aria-labelledby="recent-h" className="mt-20">
      <h2 id="recent-h" className="display text-[28px] md:text-[36px]">
        {title}
      </h2>
      <ul className="-mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-16 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {list.map((p) => (
          <li key={p.slug} className="w-[44%] shrink-0 snap-start md:w-auto">
            <ProductCard product={p} sizes="(min-width: 768px) 25vw, 44vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Everything saved in this browser, newest first. */
export function SavedList({ products }: { products: Product[] }) {
  const slugs = useList("saved");
  const list = pick(products, slugs);
  return list.length === 0 ? (
    <div className="mt-10">
      <p className="text-lg">Nothing saved yet.</p>
      <p className="mt-2 text-steel-dark">Tap the heart on any piece to keep it here for later. It stays on this phone, no account needed.</p>
    </div>
  ) : (
    <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-16 md:grid-cols-3 lg:grid-cols-4">
      {list.map((p) => (
        <li key={p.slug}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
