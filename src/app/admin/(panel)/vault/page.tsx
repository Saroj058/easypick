import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { vaultBrands, vaultPieces } from "@/components/home/vault";
import { allProducts } from "@/lib/catalogue";
import { vaultSetting } from "@/lib/settings/vault";
import { requireOwner } from "@/lib/staff";
import { PageHead } from "../kit";
import { VaultForm } from "./vault-form";

export const metadata: Metadata = { title: "The Vault" };
export const dynamic = "force-dynamic";

export default async function AdminVault() {
  await requireOwner();
  const [products, initial] = await Promise.all([allProducts(), vaultSetting.getForAdmin()]);
  const pieces = vaultPieces(products);
  return (
    <div className="space-y-6">
      <PageHead group="Storefront" title="The Vault" lead="Each brand's colours and story, the Vault's own blue, its words, and the pieces it opens on. Pieces join the Vault from their product page (Details → The Vault).">
        <Link href="/admin/products/new?vault=1" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-paper hover:bg-graphite">
          <Plus className="h-4 w-4" aria-hidden />
          Add a Vault piece
        </Link>
      </PageHead>
      <VaultForm
        initial={initial}
        brandsHere={vaultBrands(pieces).map((b) => ({ name: b.name, n: b.pieces.length }))}
        pieces={pieces.map((p) => ({ slug: p.slug, name: p.name, brand: p.brand ?? "", sold: p.status === "sold_out", image: p.images[0]?.src ?? null }))}
      />
    </div>
  );
}
