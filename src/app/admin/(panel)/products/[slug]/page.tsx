import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { findProduct, restockDemand, stockHistory } from "@/lib/catalogue";
import { requireStaff } from "@/lib/staff";
import { ProductForm } from "./product-form";
import { StockForm } from "./stock-form";
import { StockHistory } from "./stock-history";

export const dynamic = "force-dynamic";


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

        <StockHistory history={history} />
      </div>
    </div>
  );
}
