import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { sellable } from "@/lib/inventory";
import type { Product, Size } from "@/lib/types";
import { MiniTag } from "./hang-tag";
import { ProductImage } from "./product-image";
import { HeartAdd, QuickBuy } from "./quick-buy";

// One-size pieces (caps) count too, so they don't read as "in store only".
const ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

/** What can be bought online per size, across colours (the last piece on the shop floor doesn't count). */
function sizeRow(p: Product) {
  const totals = new Map<Size, number>();
  for (const v of p.variants) totals.set(v.size, (totals.get(v.size) ?? 0) + sellable(v));
  return ORDER.filter((s) => totals.has(s)).map((s) => ({ size: s, stock: totals.get(s) ?? 0 }));
}

/** The customer's size on the home rail stands out in the size row (the rail sets data-size on its wrapper). */
const MINE: Record<string, string> = {
  S: "group-data-[size=S]/rail:font-semibold group-data-[size=S]/rail:text-ink",
  M: "group-data-[size=M]/rail:font-semibold group-data-[size=M]/rail:text-ink",
  L: "group-data-[size=L]/rail:font-semibold group-data-[size=L]/rail:text-ink",
  XL: "group-data-[size=XL]/rail:font-semibold group-data-[size=XL]/rail:text-ink",
};

/** One quiet line under the name: only what helps someone decide. */
function statusLine(p: Product): { text: string; strong?: boolean; dots?: boolean } {
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
  return { text: colours, dots: p.colours.length > 1 };
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
  const row = product.status === "live" ? sizeRow(product) : [];
  // The colours that can still be bought, as dots.
  const dots = status.dots ? product.colours.filter((c) => product.variants.some((v) => v.colour === c.name && sellable(v) > 0)) : [];
  const fresh = product.isNew && product.status === "live";
  const note =
    product.status === "sold_out"
      ? "Sold out"
      : product.status === "scheduled"
        ? `Drop ${product.dropSlug}`
        : fresh
          ? product.dropSlug
            ? `New · Drop ${product.dropSlug}`
            : "New"
          : null;

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
              <div className="absolute inset-0 hidden opacity-0 transition-opacity duration-300 group-has-[a:focus-visible]:opacity-100 [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100">
                <ProductImage
                  image={back}
                  category={product.category}
                  colourHex={hex}
                  decorative
                  sizes={sizes}
                />
              </div>
            )}
            {note && <span className={`absolute left-3 top-3 ${product.status === "scheduled" || fresh ? "tag-volt" : "index bg-paper px-2 py-1"}`}>{note}</span>}
          </div>
          {/* The price tag: tied just above the hem of the photo, hanging down outside the card. */}
          <MiniTag product={product} className="absolute right-2 top-full z-10 -mt-3 md:right-4" />
        </div>
        {/* Room on the right for the hanging tag, which carries the price. */}
        <div className="mt-3 pr-[70px] md:pr-[100px]">
          {plate && (
            <p aria-hidden className="mb-1 font-mono text-[11px] tracking-[0.12em] text-steel-dark">
              {plate}
            </p>
          )}
          <h3 className="line-clamp-2 text-[15px] font-semibold decoration-1 underline-offset-4 group-hover:underline">
            {product.name}
            <span className="sr-only">
              , {product.salePrice ? "sale price " : ""}
              {formatPrice(price)}
            </span>
          </h3>
          <p className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] ${status.strong ? "font-semibold text-ink" : "text-steel-dark"}`}>
            {dots.length > 1 && (
              <span aria-hidden className="flex gap-1">
                {dots.map((c) => (
                  <span key={c.name} className="h-2.5 w-2.5 rounded-full border border-black/15" style={{ background: c.hex }} />
                ))}
              </span>
            )}
            {status.text}
            {product.salePrice && (
              <span className="font-normal text-steel-dark">
                {" · "}
                <s>
                  <span className="sr-only">was </span>
                  {formatPrice(product.price)}
                </s>
              </span>
            )}
          </p>
          {/* Sizes that can be bought online; the rest are struck through. */}
          {row.length > 1 && (
            <p className="mt-1.5 flex gap-2.5 font-mono text-[11px] text-steel-dark">
              <span className="sr-only">Sizes: </span>
              {row.map((r) =>
                r.stock > 0 ? (
                  <span key={r.size} className={MINE[r.size] ?? ""}>
                    {r.size}
                  </span>
                ) : (
                  <s key={r.size} className="text-[#8e8e93]">
                    {r.size}
                    <span className="sr-only"> sold out</span>
                  </s>
                ),
              )}
            </p>
          )}
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
