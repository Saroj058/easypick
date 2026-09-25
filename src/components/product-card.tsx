import Link from "next/link";

import { formatPrice } from "@/lib/format";
import type { Product, Size } from "@/lib/types";
import { MiniTag } from "./hang-tag";
import { ProductImage } from "./product-image";

const ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

/** Sizes across all colours: in stock, low (≤3), or gone. */
function sizeRow(p: Product) {
  const totals = new Map<Size, number>();
  for (const v of p.variants) totals.set(v.size, (totals.get(v.size) ?? 0) + v.stock);
  return ORDER.filter((s) => totals.has(s)).map((s) => ({ size: s, stock: totals.get(s) ?? 0 }));
}

export function ProductCard({ product, priority, sizes }: { product: Product; priority?: boolean; sizes?: string }) {
  const [front, back] = product.images;
  const hex = product.colours[0].hex;
  const row = product.status === "live" ? sizeRow(product) : [];
  const price = product.salePrice ?? product.price;
  const note = product.status === "sold_out" ? "Sold out" : product.status === "scheduled" ? `Drop ${product.dropSlug}` : null;

  return (
    <Link href={`/product/${product.slug}`} className="group block cursor-pointer">
      <div className="relative overflow-hidden">
        <ProductImage image={front} category={product.category} colourHex={hex} priority={priority} decorative sizes={sizes} />
        {back && (
          <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
            <ProductImage image={back} category={product.category} colourHex={hex} decorative sizes={sizes} />
          </div>
        )}
        <MiniTag product={product} className="absolute right-1.5 top-0 z-10 md:right-4" />
        {note && <span className={`absolute left-3 top-3 ${product.status === "scheduled" ? "tag-volt" : "index bg-paper px-2 py-1"}`}>{note}</span>}
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="line-clamp-2 text-[15px] font-semibold decoration-1 underline-offset-4 group-hover:underline">{product.name}</h3>
          <p className="shrink-0 font-mono text-[14px] tabular-nums">
            {product.salePrice ? (
              <>
                <span className="sr-only">Sale price </span>
                {formatPrice(price)}
              </>
            ) : (
              formatPrice(price)
            )}
          </p>
        </div>
        <p className="mt-0.5 text-[13px] text-steel-dark">
          {product.colours.length > 1 ? `${product.colours.length} colours` : product.colours[0].name}
          {product.salePrice && (
            <>
              {" · "}
              <s>
                <span className="sr-only">was </span>
                {formatPrice(product.price)}
              </s>
            </>
          )}
        </p>
        {row.length > 1 && (
          <p className="mt-2 flex gap-2.5 font-mono text-[12px]" aria-label={`Sizes: ${row.map((r) => `${r.size} ${r.stock === 0 ? "sold out" : r.stock <= 3 ? `${r.stock} left` : "in stock"}`).join(", ")}`}>
            {row.map((r) => (
              <span key={r.size} aria-hidden className={r.stock === 0 ? "text-steel line-through" : "text-ink"}>
                {r.size}
                {r.stock > 0 && r.stock <= 3 && <sup className="ml-px text-[9px] text-steel-dark">{r.stock}</sup>}
              </span>
            ))}
          </p>
        )}
      </div>
    </Link>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Product[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
