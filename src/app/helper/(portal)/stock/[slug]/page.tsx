import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StockForm } from "@/app/admin/(panel)/products/[slug]/stock-form";
import { StockHistory } from "@/app/admin/(panel)/products/[slug]/stock-history";
import { findProduct, restockDemand, stockHistory } from "@/lib/catalogue";
import { currentStaff, requireStaff } from "@/lib/staff";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/helper/stock/[slug]">): Promise<Metadata> {
  if (!(await currentStaff())) return { title: "Stock" };
  return { title: (await findProduct((await params).slug))?.name ?? "Stock" };
}

export default async function HelperProductStock({ params }: PageProps<"/helper/stock/[slug]">) {
  await requireStaff("/helper/login");
  const { slug } = await params;
  const product = await findProduct(slug);
  if (!product) notFound();
  const [demand, history] = await Promise.all([restockDemand(), stockHistory(slug, 15)]);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/helper/stock" className="text-[13.5px] text-[#55575c] hover:text-ink">
        All stock
      </Link>
      <h1 className="mt-3 text-[34px] font-light leading-none tracking-[-0.02em] md:text-[40px]">{product.name}</h1>
      <div className="mt-6 space-y-4 [&>*]:rounded-[24px] [&>*]:bg-[#f4f4f2] [&>*]:p-5">
        <StockForm product={product} demand={demand} />
        <StockHistory history={history} />
      </div>
    </div>
  );
}
