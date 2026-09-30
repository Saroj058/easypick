import type { Metadata } from "next";
import Link from "next/link";

import { RecentlyViewed } from "@/components/local-lists";
import { formatPrice } from "@/lib/format";
import { ProductGrid } from "@/components/product-card";
import { categoryLabels } from "@/lib/site";
import { getProducts } from "@/lib/store";
import type { Category, Fit, Product } from "@/lib/types";
import { FestivalNotice } from "@/components/festival-notice";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Oversized tees, hoodies, joggers, jeans and jackets at fixed fair prices. Streetwear in Kathmandu, with live stock by size.",
  alternates: { canonical: "/shop" },
};

// "Under" chips are what the home rail links to; the old band key still works for shared links.
const prices = [
  { key: "u1000", label: "Under Rs 1,000", test: (n: number) => n < 1000, chip: true },
  { key: "u1500", label: "Under Rs 1,500", test: (n: number) => n < 1500, chip: true },
  { key: "u2500", label: "Under Rs 2,500", test: (n: number) => n < 2500, chip: true },
  { key: "o2500", label: "Over Rs 2,500", test: (n: number) => n > 2500, chip: true },
  { key: "1000-2500", label: "Rs 1,000–2,500", test: (n: number) => n >= 1000 && n <= 2500, chip: false },
];

const fits: { key: Fit; label: string }[] = [
  { key: "oversized", label: "Oversized" },
  { key: "relaxed", label: "Relaxed" },
  { key: "regular", label: "Regular" },
];

const sorts = [
  { key: "new", label: "Newest" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
];

type Filters = { category?: string; size?: string; colour?: string; price?: string; fit?: string; sort?: string; sale?: string; new?: string; page?: string };

/** Pieces per page: enough to browse, small enough for a phone on mobile data. */
const PER_PAGE = 48;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function href(current: Filters, change: Partial<Filters>) {
  const next = { ...current, ...change };
  const q = new URLSearchParams();
  // Changing a filter starts again from page 1.
  if (!("page" in change)) delete next.page;
  for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `/shop?${s}` : "/shop";
}

function Chip({ active, href: to, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-11 shrink-0 items-center rounded-[2px] border px-4 text-sm font-semibold ${
        active ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const sp = await searchParams;
  const f: Filters = {
    category: one(sp.category),
    size: one(sp.size),
    colour: one(sp.colour),
    price: one(sp.price),
    sort: one(sp.sort),
    fit: one(sp.fit),
    sale: one(sp.sale) === "1" ? "1" : undefined,
    new: one(sp.new) === "1" ? "1" : undefined,
    page: one(sp.page),
  };

  const all = await getProducts();
  const colours = Array.from(new Set(all.flatMap((p) => p.colours.map((c) => c.name)))).sort();
  const sizes = ["S", "M", "L", "XL"];

  const priceOf = (p: Product) => p.salePrice ?? p.price;
  let list = all.filter((p) => p.status !== "scheduled");
  if (f.sale) list = list.filter((p) => p.salePrice);
  if (f.new) list = list.filter((p) => p.isNew);
  if (f.category) list = list.filter((p) => p.category === f.category);
  if (f.fit) list = list.filter((p) => p.fit === f.fit);
  if (f.colour) list = list.filter((p) => p.colours.some((c) => c.name === f.colour));
  if (f.size) list = list.filter((p) => p.variants.some((v) => v.size === f.size && v.stock > 0));
  const priceRule = prices.find((x) => x.key === f.price);
  if (priceRule) list = list.filter((p) => priceRule.test(priceOf(p)));
  if (f.sort === "price-asc") list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
  else if (f.sort === "price-desc") list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
  // Sold out sinks to the bottom, but keeps its page for sharing and search.
  list = [...list].sort((a, b) => Number(a.status === "sold_out") - Number(b.status === "sold_out"));

  const active = Boolean(f.category || f.size || f.colour || f.price || f.fit || f.sale || f.new);
  const anyNew = all.some((p) => p.isNew && p.status !== "scheduled");
  const onSale = all.filter((p) => p.salePrice && p.status === "live");
  const bestSaving = onSale.reduce((n, p) => Math.max(n, p.price - (p.salePrice ?? p.price)), 0);

  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(f.page) || 1)));
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="container-ep pb-24 pt-10 md:pt-16">
      <h1 className="display text-[40px] md:text-[72px]">
        {f.sale ? "On sale" : f.new ? "New in" : f.category ? categoryLabels[f.category as Category] ?? "Shop all" : "Shop all"}
      </h1>
      {f.sale && bestSaving > 0 && <p className="mt-2 text-steel-dark">Festival prices on {onSale.length} pieces, up to {formatPrice(bestSaving)} off. While stock lasts.</p>}
      <FestivalNotice className="mt-4 max-w-2xl" />

      <div className="mt-8 space-y-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Category">
          <Chip active={!f.category && !f.sale && !f.new} href={href(f, { category: undefined, sale: undefined, new: undefined })}>
            All
          </Chip>
          {onSale.length > 0 && (
            <Chip active={Boolean(f.sale)} href={href(f, { sale: f.sale ? undefined : "1" })}>
              On sale
            </Chip>
          )}
          {anyNew && (
            <Chip active={Boolean(f.new)} href={href(f, { new: f.new ? undefined : "1" })}>
              New in
            </Chip>
          )}
          {(Object.keys(categoryLabels) as Category[]).map((c) => (
            <Chip key={c} active={f.category === c} href={href(f, { category: c })}>
              {categoryLabels[c]}
            </Chip>
          ))}
        </div>

        <details className="group">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em]">
            Filter and sort {active && <span className="tag-volt">On</span>}
          </summary>
          <div className="mt-3 grid gap-6 border-t border-mist pt-6 md:grid-cols-3 lg:grid-cols-5">
            <div>
              <p className="text-sm font-semibold">Size</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <Chip key={s} active={f.size === s} href={href(f, { size: f.size === s ? undefined : s })}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Colour</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {colours.map((c) => (
                  <Chip key={c} active={f.colour === c} href={href(f, { colour: f.colour === c ? undefined : c })}>
                    {c}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Price</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {prices.filter((p) => p.chip).map((p) => (
                  <Chip key={p.key} active={f.price === p.key} href={href(f, { price: f.price === p.key ? undefined : p.key })}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Fit</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {fits.map((x) => (
                  <Chip key={x.key} active={f.fit === x.key} href={href(f, { fit: f.fit === x.key ? undefined : x.key })}>
                    {x.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Sort</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sorts.map((s) => (
                  <Chip key={s.key} active={(f.sort ?? "new") === s.key} href={href(f, { sort: s.key === "new" ? undefined : s.key })}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </details>
      </div>

      <p className="mt-6 font-mono text-[13px] text-steel-dark" aria-live="polite">
        {list.length} {list.length === 1 ? "piece" : "pieces"}
        {pages > 1 && ` · page ${page} of ${pages}`}
        {active && (
          <>
            {" · "}
            <Link href={href({ sort: f.sort }, {})} className="underline">
              Clear filters
            </Link>
          </>
        )}
      </p>

      <div className="mt-8">
        {list.length ? (
          <>
            <ProductGrid products={shown} priorityCount={page === 1 ? 4 : 0} />
            {pages > 1 && (
              <nav aria-label="Pages" className="mt-16 flex flex-wrap items-center justify-center gap-2">
                {page > 1 && (
                  <Link href={href(f, { page: String(page - 1) })} className="btn btn-outline">
                    Previous
                  </Link>
                )}
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <Link
                    key={n}
                    href={href(f, { page: n === 1 ? undefined : String(n) })}
                    aria-current={n === page ? "page" : undefined}
                    className={`grid h-11 min-w-11 place-items-center rounded-[2px] border px-3 font-mono text-[14px] ${n === page ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
                  >
                    {n}
                  </Link>
                ))}
                {page < pages && (
                  <Link href={href(f, { page: String(page + 1) })} className="btn btn-ink">
                    Next
                  </Link>
                )}
              </nav>
            )}
          </>
        ) : (
          <p className="py-24 text-center text-steel-dark">Nothing matches that yet. Try another size or colour.</p>
        )}
      </div>
      <RecentlyViewed />
    </div>
  );
}
