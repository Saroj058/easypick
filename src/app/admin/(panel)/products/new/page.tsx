import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { describeAvailable } from "@/lib/ai/describe";
import { allDrops, allProducts } from "@/lib/catalogue";
import { requestTime } from "@/lib/format";
import { OCCASIONS } from "@/lib/occasions";
import { getOffersForAdmin } from "@/lib/offers";
import { kindsSetting } from "@/lib/settings/categories";
import { kindView } from "@/lib/settings/categories-rules";
import { requireOwner } from "@/lib/staff";
import { SmartAddForm } from "./smart-form";

export const metadata: Metadata = { title: "Add product" };
export const dynamic = "force-dynamic";

/**
 * Add a piece (owner, 19 Oct 2026). Drops, the Vault, Designer Fits and Categories link here with
 * ?drop=, ?vault=1, ?look= or ?kind= so the piece starts where it was asked for.
 */
export default async function NewProduct({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const [dropList, products, kindList, offers] = await Promise.all([allDrops(), allProducts(), kindsSetting.getForAdmin(), getOffersForAdmin()]);
  const kv = kindView(kindList);
  const now = requestTime();
  const drops = [...dropList].sort((a, b) => Date.parse(b.releaseAt) - Date.parse(a.releaseAt)).map((d) => ({ slug: d.slug, name: d.name, coming: Date.parse(d.releaseAt) > now }));
  const brands = [...new Set(products.map((p) => p.brand).filter((b): b is string => Boolean(b)))].sort();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-[13.5px] text-[#55575c] hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All products
        </Link>
        <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]">Products</p>
        <h1 className="mt-1 text-[40px] font-light leading-none tracking-[-0.02em]">Add a piece</h1>
        <p className="mt-2 text-[14px] text-[#55575c]">Start with the photos; the page crops them, cuts the piece out and reads its colour. It starts as a hidden draft unless you put it live.</p>
      </div>
      <SmartAddForm
        kinds={kv.all.map((id) => ({ id, label: kv.name(id) }))}
        drops={drops}
        offers={offers.flatMap((o) => (o.tag ? [{ tag: o.tag, name: o.name }] : []))}
        fits={OCCASIONS}
        brands={brands}
        preset={{ drop: drops.some((d) => d.slug === one("drop")) ? one("drop") : "", vault: one("vault") === "1", look: OCCASIONS.some((o) => o.key === one("look")) ? one("look") : "", category: one("kind") }}
        aiOn={describeAvailable()}
      />
    </div>
  );
}
