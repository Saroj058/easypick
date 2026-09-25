import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { findProduct, restockDemand, stockHistory } from "@/lib/catalogue";
import { site } from "@/lib/site";
import { requireStaff } from "@/lib/staff";
import { ProductForm } from "./product-form";
import { StockForm } from "./stock-form";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const reasonLabel: Record<string, string> = {
  order_hold: "Online order",
  order_release: "Order expired / released",
  received: "Received",
  count: "Count correction",
  damaged: "Damaged or lost",
  returned: "Returned",
  exchange_in: "Exchange (back in)",
  exchange_out: "Exchange (out)",
  gift_swap: "Gift size swap",
  refund_restock: "Refund, back in stock",
};

export async function generateMetadata({ params }: PageProps<"/admin/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: (await findProduct(slug))?.name ?? "Product" };
}

export default async function AdminProduct({ params, searchParams }: PageProps<"/admin/products/[slug]">) {
  const { slug } = await params;
  const { added } = await searchParams;
  const product = await findProduct(slug);
  if (!product) notFound();
  const [demand, history, me] = await Promise.all([restockDemand(), stockHistory(slug, 25), requireStaff()]);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/products" className="text-[14px] text-steel-dark underline underline-offset-2">
        All products
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="display text-[32px] md:text-[40px]">{product.name}</h2>
        <Link href={`/product/${product.slug}`} className="text-[14px] underline underline-offset-2">
          See it on the site
        </Link>
      </div>
      {added && <p className="mt-4 bg-photo px-4 py-3 text-[14px]">Added. Add its stock below, then set it to Live when it&apos;s ready.</p>}

      <div className="mt-8 space-y-14">
        <StockForm product={product} demand={demand} />

        {me.role === "owner" ? (
          <div className="border-t border-mist pt-10">
            <ProductForm product={product} />
          </div>
        ) : (
          <p className="border-t border-mist pt-6 text-[14px] text-steel-dark">Price, status and photo are changed by the owner.</p>
        )}

        <section aria-labelledby="hist-h" className="border-t border-mist pt-8">
          <h3 id="hist-h" className="text-lg font-semibold">
            Stock history
          </h3>
          {history.length === 0 ? (
            <p className="mt-2 text-[14px] text-steel-dark">No changes recorded yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[14px]">
                <thead className="text-[12px] text-steel-dark">
                  <tr className="border-b border-mist">
                    <th className="py-2 font-normal">When</th>
                    <th className="py-2 font-normal">Size</th>
                    <th className="py-2 text-right font-normal">Change</th>
                    <th className="py-2 text-right font-normal">After</th>
                    <th className="py-2 pl-4 font-normal">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} className="border-b border-mist">
                      <td className="py-2 text-steel-dark">{when.format(new Date(h.at))}</td>
                      <td className="py-2 font-mono">{h.sku}</td>
                      <td className={`py-2 text-right font-mono tabular-nums ${h.delta > 0 ? "text-[#1f7a3d]" : ""}`}>{h.delta > 0 ? `+${h.delta}` : h.delta}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{h.stockAfter ?? ""}</td>
                      <td className="py-2 pl-4">
                        {reasonLabel[h.reason] ?? h.reason}
                        {h.ref ? <span className="text-steel-dark"> · {h.ref}</span> : null}
                        {h.actor ? <span className="text-steel-dark"> · {h.actor}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
