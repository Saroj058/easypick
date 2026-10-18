import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { allDrops, allProducts, restockDemand } from "@/lib/catalogue";
import { formatPrice } from "@/lib/format";
import { SIZE_ORDER } from "@/lib/inventory";
import { categoryLabels } from "@/lib/site";
import { requireOwner } from "@/lib/staff";
import { ProductsBoard, type BoardRow } from "./products-board";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const label = "font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]";

/** Every piece in one board: find, filter, sort, change status in bulk, duplicate. */
export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner();
  const sp = await searchParams;
  const kind = typeof sp.kind === "string" && sp.kind in categoryLabels ? (sp.kind as keyof typeof categoryLabels) : "";
  const [products, demand, drops] = await Promise.all([allProducts(), restockDemand(), allDrops()]);
  const dropName = new Map(drops.map((d) => [d.slug, d.name]));

  const rows: BoardRow[] = products.map((p, i) => {
    const sizes = SIZE_ORDER.filter((s) => p.variants.some((v) => v.size === s)).map((s) => ({
      size: s,
      n: p.variants.filter((v) => v.size === s).reduce((n, v) => n + v.stock, 0),
    }));
    return {
      slug: p.slug,
      name: p.name,
      code: p.variants[0]?.sku.split("-")[0] ?? "",
      category: p.category,
      categoryLabel: categoryLabels[p.category],
      status: p.status,
      price: p.price,
      salePrice: p.salePrice ?? null,
      stock: sizes.reduce((n, s) => n + s.n, 0),
      sizes,
      colours: p.colours.map((c) => c.hex),
      asked: p.variants.reduce((n, v) => n + (demand[v.sku] ?? 0), 0),
      vault: Boolean(p.vault),
      staffPick: Boolean(p.staffPick),
      drop: p.dropSlug ? (dropName.get(p.dropSlug) ?? p.dropSlug) : null,
      image: p.images.find((x) => x.kind === "front") ?? p.images[0] ?? { src: null, alt: p.name, kind: "front" },
      colourHex: p.colours[0]?.hex ?? "#ccc",
      order: i,
    };
  });

  const live = rows.filter((r) => r.status === "live");
  const stockValue = rows.reduce((n, r) => n + r.stock * (r.salePrice ?? r.price), 0);
  const emptySizes = live.reduce((n, r) => n + r.sizes.filter((s) => s.n === 0).length, 0);
  const asked = rows.reduce((n, r) => n + r.asked, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={label}>Run the shop</p>
          <h1 className="mt-1 text-[40px] font-light leading-none tracking-[-0.02em]">Products</h1>
        </div>
        <Link href="/admin/products/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-paper hover:bg-graphite">
          <Plus className="h-4 w-4" aria-hidden />
          Add product
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Live on the site", `${live.length}`, `of ${rows.length} pieces`],
          ["Stock on hand", `${rows.reduce((n, r) => n + r.stock, 0)}`, `worth ${formatPrice(stockValue)}`],
          ["Live sizes at 0", `${emptySizes}`, emptySizes ? "Restock or mark sold out" : "Every size has stock"],
          ["Asked for a restock", `${asked}`, asked ? "Told the moment it's back" : "Nobody waiting"],
        ].map(([k, v, note]) => (
          <div key={k} className="rounded-[22px] bg-[#f4f4f2] p-4">
            <dt className="text-[13px] text-[#55575c]">{k}</dt>
            <dd className="mt-2 font-mono text-[26px] font-semibold leading-none tabular-nums">{v}</dd>
            <dd className="mt-1.5 text-[12px] text-[#6b6d72]">{note}</dd>
          </div>
        ))}
      </dl>

      <ProductsBoard rows={rows} initialKind={kind} />
    </div>
  );
}
