import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StockForm } from "@/app/admin/(panel)/products/[slug]/stock-form";
import { StockHistory } from "@/app/admin/(panel)/products/[slug]/stock-history";
import { findProduct, restockDemand, stockHistory } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/helper/stock/[slug]">): Promise<Metadata> {
  return { title: (await findProduct((await params).slug))?.name ?? "Stock" };
}

export default async function HelperProductStock({ params }: PageProps<"/helper/stock/[slug]">) {
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) notFound();
  const [demand, history] = await Promise.all([restockDemand(), stockHistory(slug, 15)]);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/helper/stock" className="text-[14px] text-steel-dark underline underline-offset-2">
        All stock
      </Link>
      <h1 className="display mt-3 text-[32px]">{product.name}</h1>
      <div className="mt-6 space-y-12">
        <StockForm product={product} demand={demand} />
        <StockHistory history={history} />
      </div>
    </div>
  );
}
