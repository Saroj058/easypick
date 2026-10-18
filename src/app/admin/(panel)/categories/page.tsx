import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { allProducts, restockDemand } from "@/lib/catalogue";
import { formatPrice } from "@/lib/format";
import { kindsSetting } from "@/lib/settings/categories";
import { kindView } from "@/lib/settings/categories-rules";
import { FAMILY } from "@/lib/site";
import { KindsForm } from "./kinds-form";
import { requireOwner } from "@/lib/staff";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

const label = "font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]";
const FAMILY_LABEL = { top: "Top", layer: "Layer", bottom: "Bottom", set: "Set", extra: "Extra" } as const;

/** The twelve kinds at a glance: how many pieces each has live, its stock, empty sizes, sales and restock asks. */
export default async function AdminCategories({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner();
  const editing = (await searchParams).tab === "edit";
  const [products, demand, kindList] = await Promise.all([allProducts(), restockDemand(), kindsSetting.getForAdmin()]);
  const kv = kindView(kindList);

  const kinds = kv.all.map((c) => {
    const list = products.filter((p) => p.category === c);
    const live = list.filter((p) => p.status === "live");
    const stock = list.reduce((n, p) => n + p.variants.reduce((m, v) => m + v.stock, 0), 0);
    const value = list.reduce((n, p) => n + p.variants.reduce((m, v) => m + v.stock, 0) * (p.salePrice ?? p.price), 0);
    const empty = live.reduce((n, p) => n + p.variants.filter((v) => v.stock === 0).length, 0);
    const onSale = live.filter((p) => p.salePrice).length;
    const asked = list.reduce((n, p) => n + p.variants.reduce((m, v) => m + (demand[v.sku] ?? 0), 0), 0);
    const prices = live.map((p) => p.salePrice ?? p.price);
    return { c, total: list.length, live: live.length, stock, value, empty, onSale, asked, low: prices.length ? Math.min(...prices) : 0, high: prices.length ? Math.max(...prices) : 0 };
  });
  const thin = kinds.filter((k) => k.live < 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={label}>Run the shop</p>
          <h1 className="mt-1 text-[40px] font-light leading-none tracking-[-0.02em]">Categories</h1>
          <p className="mt-2 text-[14px] text-[#55575c]">The twelve kinds the shop is sorted by. Open one to see and change its pieces.</p>
        </div>
        <Link href="/admin/products/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-paper hover:bg-graphite">
          <Plus className="h-4 w-4" aria-hidden />
          Add product
        </Link>
      </div>

      <nav aria-label="Category views" className="flex w-fit gap-1 rounded-full bg-[#f4f4f2] p-1">
        {[
          ["", "Overview"],
          ["edit", "Names, order and pictures"],
        ].map(([t, name]) => (
          <Link key={t} href={t ? `/admin/categories?tab=${t}` : "/admin/categories"} aria-current={(t === "edit") === editing ? "page" : undefined} className={`inline-flex h-9 items-center rounded-full px-4 text-[13.5px] ${(t === "edit") === editing ? "bg-white font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-[#55575c] hover:text-ink"}`}>
            {name}
          </Link>
        ))}
      </nav>

      {editing ? (
        <KindsForm initial={kindList} />
      ) : (
        <>
      {thin.length > 0 && (
        <p className="rounded-2xl bg-[#fff1e0] px-4 py-3 text-[14px] text-[#7a3e00]">
          Thin on the site: {thin.map((k) => `${kv.name(k.c)} (${k.live} live)`).join(", ")}. Six or more live pieces make a kind look full.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kinds.map((k) => (
          <li key={k.c}>
            <Link href={`/admin/products?kind=${k.c}`} className="group block h-full rounded-[24px] bg-[#f4f4f2] p-5 transition-colors hover:bg-ink/[0.07]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a tiny garment picture */}
                    <img src={kv.picture(k.c)} alt="" className="h-9 w-9 object-contain" />
                  </span>
                  <span>
                    <span className="block text-[17px] font-semibold group-hover:underline">{kv.name(k.c)}</span>
                    <span className="text-[12px] text-[#6b6d72]">{FAMILY_LABEL[FAMILY[k.c]]}</span>
                  </span>
                </div>
                <span className={`rounded-full px-2.5 py-1 font-mono text-[12px] ${k.live < 6 ? "bg-[#fff1e0] text-[#7a3e00]" : "bg-white"}`}>
                  {k.live} live
                  {k.total > k.live ? ` / ${k.total}` : ""}
                </span>
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-2 text-[12.5px]">
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="text-[#6b6d72]">Stock</dt>
                  <dd className="mt-0.5 font-mono text-[16px] font-semibold tabular-nums">{k.stock}</dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="text-[#6b6d72]">Sizes at 0</dt>
                  <dd className={`mt-0.5 font-mono text-[16px] font-semibold tabular-nums ${k.empty ? "text-[#9b0010]" : ""}`}>{k.empty}</dd>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <dt className="text-[#6b6d72]">On sale</dt>
                  <dd className="mt-0.5 font-mono text-[16px] font-semibold tabular-nums">{k.onSale}</dd>
                </div>
              </dl>
              <p className="mt-3 flex flex-wrap justify-between gap-2 text-[12.5px] text-[#55575c]">
                <span>{k.live ? `${formatPrice(k.low)} – ${formatPrice(k.high)}` : "Nothing live yet"}</span>
                <span>
                  worth {formatPrice(k.value)}
                  {k.asked ? ` · ${k.asked} asked` : ""}
                </span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
        </>
      )}
    </div>
  );
}
