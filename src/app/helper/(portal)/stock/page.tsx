import type { Metadata } from "next";
import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { allProducts, restockDemand } from "@/lib/catalogue";
import { bySize } from "@/lib/inventory";
import { requireStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Stock" };
export const dynamic = "force-dynamic";

/** Every piece with its sizes left; tap one to add or take off stock. */
export default async function HelperStock({ searchParams }: PageProps<"/helper/stock">) {
  await requireStaff("/helper/login");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 40) : "";
  const [products, demand] = await Promise.all([allProducts(), restockDemand()]);
  const list = products
    .filter((p) => p.status !== "archived")
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q)));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]">Rack</p>
          <h1 className="mt-1 text-[34px] font-light leading-none tracking-[-0.02em] md:text-[40px]">Stock</h1>
        </div>
        <Link href="/helper/count" className="inline-flex h-10 items-center rounded-full border border-ink/15 bg-white px-4 text-[13.5px] font-semibold hover:border-ink">
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
          className="h-12 min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-5 text-base outline-none placeholder:text-[#6b6d72] focus:border-ink"
        />
        <button type="submit" className="btn btn-outline">
          Find
        </button>
      </form>

      <ul className="mt-6 space-y-2">
        {list.map((p) => {
          const bySizeLeft = new Map<string, number>();
          for (const v of [...p.variants].sort(bySize)) bySizeLeft.set(v.size, (bySizeLeft.get(v.size) ?? 0) + v.stock);
          const asked = p.variants.reduce((n, v) => n + (demand[v.sku] ?? 0), 0);
          return (
            <li key={p.slug}>
              <Link href={`/helper/stock/${p.slug}`} className="flex items-center gap-4 rounded-[20px] bg-[#f4f4f2] p-2 pr-4 hover:bg-ink/[0.07]">
                <span className="w-14 shrink-0 overflow-hidden rounded-[14px] bg-white">
                  <ProductImage image={p.images[0]} category={p.category} colourHex={p.colours[0]?.hex ?? "#ccc"} decorative sizes="56px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1 font-mono text-[12px]">
                    {[...bySizeLeft].map(([size, n]) => (
                      <span key={size} className={`rounded-md px-1.5 py-0.5 ${n === 0 ? "bg-[#fdecee] text-[#9b0010]" : n <= 2 ? "bg-[#fff1e0] font-semibold text-[#7a3e00]" : "bg-white text-[#6b6d72]"}`}>
                        {size === "ONE" ? "" : `${size} `}
                        {n}
                      </span>
                    ))}
                  </span>
                  {asked > 0 && <span className="block text-[12px] text-[#6b6d72]">{asked} waiting for a restock</span>}
                </span>
                <span aria-hidden className="text-[#6b6d72]">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="mt-6 text-[#6b6d72]">Nothing matches &ldquo;{q}&rdquo;.</p>}
    </div>
  );
}
