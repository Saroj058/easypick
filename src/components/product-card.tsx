import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { sellable } from "@/lib/inventory";
import type { Product, Size } from "@/lib/types";
import { ProductImage } from "./product-image";
import { HeartAdd, QuickBuy } from "./quick-buy";

const ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

/** What can be bought online per size, across colours (the last piece on the shop floor doesn't count). */
function sizeRow(p: Product) {
  const totals = new Map<Size, number>();
  for (const v of p.variants) totals.set(v.size, (totals.get(v.size) ?? 0) + sellable(v));
  return ORDER.filter((s) => totals.has(s)).map((s) => ({ size: s, stock: totals.get(s) ?? 0 }));
}

/** One quiet line under the name: only what helps someone decide. */
function statusLine(p: Product): { text: string; strong?: boolean } {
  const colours = p.colours.length > 1 ? `${p.colours.length} colours` : p.colours[0].name;
  if (p.status === "sold_out") return { text: "Sold out · tell me when it's back" };
  const row = sizeRow(p);
  if (p.status === "scheduled") {
    const range = row.length > 1 ? `${row[0].size}–${row[row.length - 1].size}` : row[0]?.size;
    return { text: range ? `${colours} · ${range}` : colours };
  }
  const online = row.reduce((n, r) => n + r.stock, 0);
  if (online === 0 && p.variants.some((v) => v.stock > 0)) return { text: "In store only" };
  const low = row.filter((r) => r.stock > 0 && r.stock <= 3);
  if (online > 0 && online <= 3) return { text: `Only ${online} left`, strong: true };
  if (low.length) return { text: `Few left in ${low.slice(0, 3).map((r) => r.size).join(", ")}` };
  return { text: colours };
}

export function ProductCard({
  product,
  priority,
  sizes,
  plate,
}: {
  product: Product;
  priority?: boolean;
  sizes?: string;
  /** A lookbook-style number on drop pages, e.g. "07/03". */
  plate?: string;
}) {
  const [front, back] = product.images;
  const hex = product.colours[0].hex;
  const price = product.salePrice ?? product.price;
  const status = statusLine(product);
  // Only what changes whether it can be bought gets a label on the photo.
  const note = product.status === "sold_out" ? "Sold out" : product.status === "scheduled" ? `Drop ${product.dropSlug}` : null;

  return (
    <div className="group relative">
      <Link href={`/product/${product.slug}`} className="block cursor-pointer">
        <div className="relative">
          <div className="relative overflow-hidden">
            <ProductImage
              image={front}
              category={product.category}
              colourHex={hex}
              priority={priority}
              decorative
              sizes={sizes}
            />
            {/* The back photo only exists where it can be seen (mouse hover); phones never download it. */}
            {back && (
              <div className="absolute inset-0 hidden opacity-0 transition-opacity duration-300 group-focus-visible:opacity-100 [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100">
                <ProductImage
                  image={back}
                  category={product.category}
                  colourHex={hex}
                  decorative
                  sizes={sizes}
                />
              </div>
            )}
            {note && <span className={`absolute left-3 top-3 ${product.status === "scheduled" ? "tag-volt" : "index bg-paper px-2 py-1"}`}>{note}</span>}
          </div>
        </div>
        <div className="mt-3">
          {plate && (
            <p aria-hidden className="mb-1 font-mono text-[11px] tracking-[0.12em] text-steel-dark">
              {plate}
            </p>
          )}
          {/* Phones: the name gets its own line so it isn't cut short. Wider: name and price share one. */}
          <h3 className="flex flex-col gap-0.5 text-[15px] md:flex-row md:items-baseline md:justify-between md:gap-3">
            <span className="line-clamp-1 font-semibold decoration-1 underline-offset-4 group-hover:underline">{product.name}</span>
            <span className="shrink-0 font-mono text-[14px] tabular-nums">
              {product.salePrice && (
                <s className="mr-1.5 text-steel-dark">
                  <span className="sr-only">was </span>
                  {product.price.toLocaleString("en-IN")}
                </s>
              )}
              <span className="sr-only">{product.salePrice ? ", sale price " : ", "}</span>
              {formatPrice(price)}
            </span>
          </h3>
          <p className={`mt-0.5 text-[13px] ${status.strong ? "font-semibold text-ink" : "text-steel-dark"}`}>{status.text}</p>
        </div>
      </Link>
      {/* Outside the link: a button can't sit inside one. */}
      {/* Quick buy: top right of the photo, straight to checkout. */}
      <QuickBuy product={product} className="absolute right-2 top-2 z-10 md:right-3 md:top-3" />
      {/* Heart = add to bag: bottom left of the photo (a 4:5 box laid over it, so it tracks the photo's size). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 aspect-[4/5]">
        <HeartAdd product={product} className="pointer-events-auto absolute bottom-1 left-1 md:bottom-2 md:left-2" />
      </div>
    </div>
  );
}

export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: Product[];
  priorityCount?: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" />
        </li>
      ))}
    </ul>
  );
}
