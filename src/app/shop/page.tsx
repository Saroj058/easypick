import type { Metadata } from "next";
import Link from "next/link";

import { RecentlyViewed } from "@/components/local-lists";
import { ProductGrid } from "@/components/product-card";
import { categoryLabels } from "@/lib/site";
import { getProducts } from "@/lib/store";
import type { Category, Product } from "@/lib/types";
import { FestivalNotice } from "@/components/festival-notice";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Oversized tees, hoodies, joggers, jeans and jackets at fixed fair prices. Streetwear in Kathmandu, with live stock by size.",
  alternates: { canonical: "/shop" },
};

const prices = [
  { key: "u1000", label: "Under Rs 1,000", test: (n: number) => n < 1000 },
  { key: "1000-2500", label: "Rs 1,000–2,500", test: (n: number) => n >= 1000 && n <= 2500 },
  { key: "o2500", label: "Over Rs 2,500", test: (n: number) => n > 2500 },
];

const sorts = [
  { key: "new", label: "Newest" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
];

type Filters = { category?: string; size?: string; colour?: string; price?: string; sort?: string };

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function href(current: Filters, change: Partial<Filters>) {
  const next = { ...current, ...change };
  const q = new URLSearchParams();
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
  };

  const all = await getProducts();
  const colours = Array.from(new Set(all.flatMap((p) => p.colours.map((c) => c.name)))).sort();
  const sizes = ["S", "M", "L", "XL"];

  const priceOf = (p: Product) => p.salePrice ?? p.price;
  let list = all.filter((p) => p.status !== "scheduled");
  if (f.category) list = list.filter((p) => p.category === f.category);
  if (f.colour) list = list.filter((p) => p.colours.some((c) => c.name === f.colour));
  if (f.size) list = list.filter((p) => p.variants.some((v) => v.size === f.size && v.stock > 0));
  const priceRule = prices.find((x) => x.key === f.price);
  if (priceRule) list = list.filter((p) => priceRule.test(priceOf(p)));
  if (f.sort === "price-asc") list = [...list].sort((a, b) => priceOf(a) - priceOf(b));
  else if (f.sort === "price-desc") list = [...list].sort((a, b) => priceOf(b) - priceOf(a));
  // Sold out sinks to the bottom, but keeps its page for sharing and search.
  list = [...list].sort((a, b) => Number(a.status === "sold_out") - Number(b.status === "sold_out"));

  const active = Boolean(f.category || f.size || f.colour || f.price);

  return (
    <div className="container-ep pb-24 pt-10 md:pt-16">
      <h1 className="display text-[40px] md:text-[72px]">{f.category ? categoryLabels[f.category as Category] ?? "Shop all" : "Shop all"}</h1>
      <FestivalNotice className="mt-4 max-w-2xl" />

      <div className="mt-8 space-y-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Category">
          <Chip active={!f.category} href={href(f, { category: undefined })}>
            All
          </Chip>
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
          <div className="mt-3 grid gap-6 border-t border-mist pt-6 md:grid-cols-4">
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
                {prices.map((p) => (
                  <Chip key={p.key} active={f.price === p.key} href={href(f, { price: f.price === p.key ? undefined : p.key })}>
                    {p.label}
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
          <ProductGrid products={list} priorityCount={4} />
        ) : (
          <p className="py-24 text-center text-steel-dark">Nothing matches that yet. Try another size or colour.</p>
        )}
      </div>
      <RecentlyViewed products={all} />
    </div>
  );
}
