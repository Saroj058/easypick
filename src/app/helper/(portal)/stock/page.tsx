import type { Metadata } from "next";
import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { allProducts, restockDemand } from "@/lib/catalogue";
import { bySize } from "@/lib/inventory";

export const metadata: Metadata = { title: "Stock" };
export const dynamic = "force-dynamic";

/** Every piece with its sizes left; tap one to add or take off stock. */
export default async function HelperStock({ searchParams }: PageProps<"/helper/stock">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 40) : "";
  const [products, demand] = await Promise.all([allProducts(), restockDemand()]);
  const list = products
    .filter((p) => p.status !== "archived")
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q)));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display text-[32px]">Stock</h1>
        <Link href="/helper/count" className="min-h-11 content-center text-[15px] font-semibold underline underline-offset-2">
          Full stock count
        </Link>
      </div>
      <form role="search" action="/helper/stock" className="mt-4 flex gap-2">
        <label htmlFor="s-q" className="sr-only">
          Piece name or SKU
        </label>
        <input
          id="s-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Hoodie, or scan / type a SKU"
          className="h-[52px] min-w-0 flex-1 rounded-[2px] border border-steel-dark bg-paper px-4 text-lg outline-none placeholder:text-steel-dark focus:border-ink"
        />
        <button type="submit" className="btn btn-outline">
          Find
        </button>
      </form>

      <ul className="mt-6 divide-y divide-mist border-y border-mist">
        {list.map((p) => {
          const bySizeLeft = new Map<string, number>();
          for (const v of [...p.variants].sort(bySize)) bySizeLeft.set(v.size, (bySizeLeft.get(v.size) ?? 0) + v.stock);
          const asked = p.variants.reduce((n, v) => n + (demand[v.sku] ?? 0), 0);
          return (
            <li key={p.slug}>
              <Link href={`/helper/stock/${p.slug}`} className="flex items-center gap-4 py-3 hover:bg-photo">
                <span className="w-14 shrink-0">
                  <ProductImage image={p.images[0]} category={p.category} colourHex={p.colours[0]?.hex ?? "#ccc"} decorative sizes="56px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[13px]">
                    {[...bySizeLeft].map(([size, n]) => (
                      <span key={size} className={n === 0 ? "text-[#d70015]" : n <= 2 ? "font-semibold" : "text-steel-dark"}>
                        {size === "ONE" ? "" : `${size} `}
                        {n}
                      </span>
                    ))}
                  </span>
                  {asked > 0 && <span className="block text-[12px] text-steel-dark">{asked} waiting for a restock</span>}
                </span>
                <span aria-hidden className="text-steel-dark">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="mt-6 text-steel-dark">Nothing matches &ldquo;{q}&rdquo;.</p>}
    </div>
  );
}
