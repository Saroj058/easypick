import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";

import { ProductImage } from "@/components/product-image";
import { duplicateProduct } from "@/app/admin/actions";
import { allDrops, findProduct, restockDemand, stockHistory } from "@/lib/catalogue";
import { getOffersForAdmin } from "@/lib/offers";
import { formatPrice } from "@/lib/format";
import { SIZE_ORDER } from "@/lib/inventory";
import { categoryLabels, site } from "@/lib/site";
import { currentStaff, requireOwner } from "@/lib/staff";
import { ProductForm } from "./product-form";
import { StockForm } from "./stock-form";
import { StockHistory } from "./stock-history";

export const dynamic = "force-dynamic";

const statusLabel = { draft: "Draft", in_review: "In review", scheduled: "Scheduled", live: "Live", sold_out: "Sold out", archived: "Archived" } as const;
const statusDot = { draft: "bg-[#a3a5aa]", in_review: "bg-[#b35c00]", scheduled: "bg-[#2f6fde]", live: "bg-[#1f9d55]", sold_out: "bg-[#d70015]", archived: "bg-[#55575c]" } as const;
const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", year: "numeric" });
const label = "font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]";

export async function generateMetadata({ params }: PageProps<"/admin/products/[slug]">): Promise<Metadata> {
  if (!(await currentStaff())) return { title: "Product" };
  const { slug } = await params;
  return { title: (await findProduct(slug))?.name ?? "Product" };
}

export default async function AdminProduct({ params, searchParams }: PageProps<"/admin/products/[slug]">) {
  await requireOwner();
  const { slug } = await params;
  const { added } = await searchParams;
  const product = await findProduct(slug);
  if (!product) notFound();
  const [demand, history, drops, offers] = await Promise.all([restockDemand(), stockHistory(slug, 25), allDrops(), getOffersForAdmin()]);

  const front = product.images.find((i) => i.kind === "front") ?? product.images[0];
  const stock = product.variants.reduce((n, v) => n + v.stock, 0);
  const asked = product.variants.reduce((n, v) => n + (demand[v.sku] ?? 0), 0);
  const sizes = SIZE_ORDER.filter((s) => product.variants.some((v) => v.size === s)).map((s) => ({ s, n: product.variants.filter((v) => v.size === s).reduce((n, v) => n + v.stock, 0) }));
  const drop = drops.find((d) => d.slug === product.dropSlug);
  const facts: [string, string][] = [
    ["Code", product.variants[0]?.sku.split("-")[0] ?? "—"],
    ["Kind", categoryLabels[product.category]],
    ["Fit", product.fit[0].toUpperCase() + product.fit.slice(1)],
    ["Colours", product.colours.map((c) => c.name).join(", ")],
    ["Drop", drop?.name ?? "—"],
    ["Live since", product.liveAt ? day.format(new Date(product.liveAt)) : "—"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-[13.5px] text-[#55575c] hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All products
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className={label}>Product</p>
            <h1 className="mt-1 text-[34px] font-light leading-[1.05] tracking-[-0.02em] md:text-[40px]">{product.name}</h1>
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#f4f4f2] px-3 py-1 text-[13px]">
              <span className={`h-2 w-2 rounded-full ${statusDot[product.status]}`} aria-hidden />
              {statusLabel[product.status]}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/product/${product.slug}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-[13.5px] font-semibold hover:border-ink">
              <ExternalLink className="h-4 w-4" aria-hidden />
              See it on the site
            </Link>
            <form action={duplicateProduct}>
              <input type="hidden" name="slug" value={product.slug} />
              <button type="submit" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-[13.5px] font-semibold hover:border-ink">
                <Copy className="h-4 w-4" aria-hidden />
                Duplicate
              </button>
            </form>
          </div>
        </div>
      </div>

      {added && (
        <p className="rounded-2xl bg-[#eef7f0] px-4 py-3 text-[14px] text-[#1f5a33]">
          {added === "scheduled"
            ? "Added as scheduled, not live: its drop hasn't started yet, so it goes on sale when the drop is released."
            : added === "copy"
              ? "Copied as a hidden draft with no stock. Change its name, colours' stock and photo, then set it to Live."
              : "Added. Add its stock below, then set it to Live when it's ready."}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-[24px] bg-[#f4f4f2] p-5 md:p-6">
            <StockForm product={product} demand={demand} />
          </section>
          <ProductForm product={product} drops={drops.map((d) => ({ slug: d.slug, name: d.name }))} offers={offers.flatMap((o) => (o.tag ? [{ name: o.name, tag: o.tag }] : []))} />
          <section className="rounded-[24px] bg-[#f4f4f2] p-5 md:p-6">
            <StockHistory history={history} />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24" aria-label="At a glance">
          <div className="rounded-[24px] bg-[#f4f4f2] p-2">
            <div className="overflow-hidden rounded-[18px] bg-white">
              <ProductImage image={front} category={product.category} colourHex={product.colours[0]?.hex ?? "#ccc"} decorative sizes="300px" />
            </div>
            <div className="px-3 pb-2 pt-3">
              <p className="font-semibold">{product.name}</p>
              <p className="mt-0.5 font-mono text-[14px]">
                {product.salePrice ? (
                  <>
                    {formatPrice(product.salePrice)} <s className="text-[12px] text-[#8a8c91]">{formatPrice(product.price)}</s>
                  </>
                ) : (
                  formatPrice(product.price)
                )}
              </p>
              <p className="mt-2 flex gap-1" aria-label="Colours">
                {product.colours.map((c) => (
                  <span key={c.name} title={c.name} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
                ))}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] bg-[#f4f4f2] p-5">
            <p className={label}>Stock</p>
            <p className="mt-2 font-mono text-[30px] font-semibold leading-none tabular-nums">{stock}</p>
            <p className="mt-1 text-[12.5px] text-[#6b6d72]">{asked ? `${asked} waiting for a restock` : "pieces on hand"}</p>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {sizes.map(({ s, n }) => (
                <li key={s} className={`rounded-lg px-2 py-1 font-mono text-[12px] tabular-nums ${n === 0 ? "bg-[#fdecee] text-[#9b0010]" : n <= 2 ? "bg-[#fff1e0] text-[#7a3e00]" : "bg-white"}`}>
                  {s === "ONE" ? "One size" : s} · {n}
                </li>
              ))}
            </ul>
          </div>

          <dl className="space-y-2.5 rounded-[24px] bg-[#f4f4f2] p-5 text-[13.5px]">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-[#6b6d72]">{k}</dt>
                <dd className="min-w-0 truncate text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}
