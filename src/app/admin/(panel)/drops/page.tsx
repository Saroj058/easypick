import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { ProductImage } from "@/components/product-image";
import { allDrops, allProducts } from "@/lib/catalogue";
import { formatDropTime, requestTime } from "@/lib/format";
import { kindsSetting } from "@/lib/settings/categories";
import { kindView } from "@/lib/settings/categories-rules";
import { requireOwner } from "@/lib/staff";
import type { Product } from "@/lib/types";
import { PageHead } from "../kit";
import { DropForm } from "./drop-form";

export const metadata: Metadata = { title: "Drops" };
export const dynamic = "force-dynamic";

/** ISO time → "yyyy-mm-ddThh:mm" in Kathmandu (UTC+5:45), for a datetime-local input. */
const toLocal = (iso: string) => new Date(Date.parse(iso) + 345 * 60_000).toISOString().slice(0, 16);

/** "in 3 days", "in 5 hours", "in 20 min". */
function until(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `in ${h} ${h === 1 ? "hour" : "hours"}`;
  return `in ${Math.round(h / 24)} days`;
}

const stockOf = (p: Product) => p.variants.reduce((n, v) => n + v.stock, 0);

/**
 * Drops, made simple (owner, 19 Oct 2026: "it is so cluttered, make it easy"): every drop as a card
 * with its pieces, when it lands and what's left; open one to change it, pick its pieces from
 * photos, or add a brand-new piece straight into it.
 */
export default async function AdminDrops({ searchParams }: PageProps<"/admin/drops">) {
  await requireOwner();
  const sp = await searchParams;
  const [drops, products, kindList] = await Promise.all([allDrops(), allProducts(), kindsSetting.getForAdmin()]);
  const kv = kindView(kindList);
  const now = requestTime();
  const sorted = [...drops].sort((a, b) => Date.parse(b.releaseAt) - Date.parse(a.releaseAt));
  const editing = typeof sp.edit === "string" ? drops.find((d) => d.slug === sp.edit) : undefined;
  const creating = sp.new === "1";

  if (editing || creating) {
    const nextNumber = String(Math.max(0, ...drops.map((d) => Number(d.slug) || 0)) + 1).padStart(2, "0");
    const initial = editing
      ? { slug: editing.slug, name: editing.name, story: editing.story, releaseAt: toLocal(editing.releaseAt), products: products.filter((p) => p.dropSlug === editing.slug).map((p) => p.slug) }
      : { slug: nextNumber, name: `Drop ${nextNumber}`, story: "", releaseAt: "", products: [] };
    // Archived pieces can't be added, but ones already in this drop are listed (and kept) so saving doesn't drop them.
    const choices = products
      .filter((p) => p.status !== "archived" || (editing && p.dropSlug === editing.slug))
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        status: p.status,
        dropSlug: p.dropSlug,
        dropName: drops.find((d) => d.slug === p.dropSlug)?.name ?? null,
        category: p.category,
        kind: kv.name(p.category),
        price: p.salePrice ?? p.price,
        stock: stockOf(p),
        image: p.images[0] ?? { src: null, alt: p.name, kind: "front" as const },
        hex: p.colours[0]?.hex ?? "#cccccc",
      }));
    return (
      <div className="space-y-6">
        <Link href="/admin/drops" className="inline-flex items-center gap-1.5 text-[13.5px] text-[#55575c] hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All drops
        </Link>
        <PageHead group="Storefront" title={editing ? editing.name : "New drop"} lead={editing ? `${formatDropTime(editing.releaseAt)} · /drop/${editing.slug}` : "Give it a number, a name and a time, then pick its pieces."} />
        <DropForm initial={initial} products={choices} kinds={kv.order.map((c) => ({ id: c, name: kv.name(c) }))} isNew={!editing} saved={sp.saved === "1"} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHead group="Storefront" title="Drops" lead="Each drop lands at its time; until then its pieces show as coming soon.">
        <Link href="/admin/drops?new=1" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-paper hover:bg-graphite">
          <Plus className="h-4 w-4" aria-hidden />
          New drop
        </Link>
      </PageHead>

      {sorted.length === 0 ? (
        <p className="rounded-[24px] bg-[#f4f4f2] p-8 text-center text-[15px] text-[#55575c]">No drops yet. Start the first one.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((d) => {
            const pieces = products.filter((p) => p.dropSlug === d.slug);
            const left = pieces.reduce((n, p) => n + stockOf(p), 0);
            const at = Date.parse(d.releaseAt);
            const coming = at > now;
            const shown = pieces.slice(0, 4);
            return (
              <li key={d.slug}>
                <Link href={`/admin/drops?edit=${d.slug}`} className="group block h-full rounded-[24px] bg-[#f4f4f2] p-3 transition-colors hover:bg-ink/[0.07]">
                  <div style={{ gridTemplateColumns: `repeat(${Math.max(1, shown.length)}, minmax(0, 1fr))` }} className="grid aspect-[16/10] gap-1 overflow-hidden rounded-[18px] bg-white">
                    {shown.length ? (
                      shown.map((p) => (
                        <div key={p.slug} className="relative overflow-hidden">
                          <ProductImage image={p.images[0] ?? { src: null, alt: p.name, kind: "front" }} category={p.category} colourHex={p.colours[0]?.hex ?? "#ccc"} decorative sizes="200px" className="h-full w-full" />
                        </div>
                      ))
                    ) : (
                      <p className="grid place-items-center text-[13px] text-[#8a8c91]">No pieces yet</p>
                    )}
                  </div>
                  <div className="px-2 pb-1 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[17px] font-semibold group-hover:underline">{d.name}</p>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${coming ? "bg-ink text-paper" : left === 0 && pieces.length ? "bg-white text-[#6b6d72]" : "bg-white"}`}>
                        {coming ? `Lands ${until(at - now)}` : left === 0 && pieces.length ? "Sold through" : "Live"}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-[#55575c]">{formatDropTime(d.releaseAt)}</p>
                    <p className="mt-2 font-mono text-[12.5px] text-[#55575c]">
                      {pieces.length} {pieces.length === 1 ? "piece" : "pieces"} · {left} in stock
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
