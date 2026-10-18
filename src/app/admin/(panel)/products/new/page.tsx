import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { allDrops } from "@/lib/catalogue";
import { requireOwner } from "@/lib/staff";
import { NewProductForm } from "./new-product-form";

export const metadata: Metadata = { title: "Add product" };
export const dynamic = "force-dynamic";

export default async function NewProduct() {
  await requireOwner();
  const drops = (await allDrops()).map((x) => ({ slug: x.slug, name: x.name }));
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-[13.5px] text-[#55575c] hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All products
        </Link>
        <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]">Products</p>
        <h1 className="mt-1 text-[40px] font-light leading-none tracking-[-0.02em]">Add a piece</h1>
        <p className="mt-2 text-[14px] text-[#55575c]">Five short steps. It starts as a hidden draft unless you put it live.</p>
      </div>
      <NewProductForm drops={drops} />
    </div>
  );
}
