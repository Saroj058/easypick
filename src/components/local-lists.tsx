"use client";

import { useCatalogue } from "@/lib/catalogue-client";
import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";
import { useList } from "./saved";

// Lists built from what this browser saved or looked at (see saved.tsx). The pieces come
// from the catalogue loaded in the browser, and only when there's something to show.

function pick(products: Product[], slugs: string[], exclude?: string) {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  return slugs.filter((s) => s !== exclude).flatMap((s) => bySlug.get(s) ?? []);
}

/** A row of what they looked at lately. Renders nothing until there's something to show. */
export function RecentlyViewed({ exclude, title = "Recently viewed" }: { exclude?: string; title?: string }) {
  const slugs = useList("recent").filter((s) => s !== exclude);
  const products = useCatalogue(slugs.length > 0);
  const list = products ? pick(products, slugs, exclude).slice(0, 8) : [];
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
export function SavedList() {
  const slugs = useList("saved");
  const products = useCatalogue(slugs.length > 0);
  const list = products ? pick(products, slugs) : [];
  if (slugs.length > 0 && !products) return <p className="mt-10 text-steel-dark">Loading your saved pieces…</p>;
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
