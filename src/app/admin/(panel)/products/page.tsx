import type { Metadata } from "next";
import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { allProducts, restockDemand } from "@/lib/catalogue";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const statusLabel = { draft: "Draft", in_review: "In review", scheduled: "Scheduled", live: "Live", sold_out: "Sold out", archived: "Archived" } as const;

export default function AdminProducts() {
  const products = allProducts();
  const demand = restockDemand();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-steel-dark">{products.length} products. Tap one to change its price, status or stock.</p>
        <Link href="/admin/products/new" className="btn btn-volt">
          Add product
        </Link>
      </div>
      <ul className="mt-6 divide-y divide-mist border-y border-mist">
        {products.map((p) => {
          const stock = p.variants.reduce((n, v) => n + v.stock, 0);
          const asked = p.variants.reduce((n, v) => n + (demand[v.sku] ?? 0), 0);
          return (
            <li key={p.slug}>
              <Link href={`/admin/products/${p.slug}`} className="flex items-center gap-4 py-3 hover:bg-photo">
                <div className="w-14 shrink-0">
                  <ProductImage image={p.images[0]} category={p.category} colourHex={p.colours[0]?.hex ?? "#ccc"} decorative sizes="56px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-[13px] text-steel-dark">
                    {statusLabel[p.status]} · {stock} in stock{asked ? ` · ${asked} asked for a restock` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-[14px]">{formatPrice(p.salePrice ?? p.price)}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
