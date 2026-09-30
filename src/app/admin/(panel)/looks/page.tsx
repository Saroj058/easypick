import type { Metadata } from "next";

import { allProducts } from "@/lib/catalogue";
import { readSavedLooks } from "@/lib/looks";
import { OCCASIONS } from "@/lib/occasions";
import { categoryLabels } from "@/lib/site";
import { requireOwner } from "@/lib/staff";
import type { Category } from "@/lib/types";
import { LooksForm, type PieceOption } from "./looks-form";

export const metadata: Metadata = { title: "Looks" };
export const dynamic = "force-dynamic";

export default async function AdminLooks() {
  await requireOwner();
  const [products, saved] = await Promise.all([allProducts(), readSavedLooks()]);
  const options: PieceOption[] = products
    .filter((p) => p.status === "live" || p.status === "scheduled")
    .flatMap((p) =>
      p.colours.map((c) => ({
        value: `${p.slug}~${c.name}`,
        label: `${p.name} · ${c.name}`,
        group: categoryLabels[p.category as Category] ?? p.category,
      })),
    );

  return (
    <div className="max-w-3xl">
      <p className="text-steel-dark">
        The ready fits in &ldquo;Wear it to…&rdquo; on the home page. Pick two or three pieces for each occasion, or leave one empty and the site
        picks from what&apos;s live. Pieces that sell out drop out on their own.{" "}
        <a href="/#occasion-title" target="_blank" rel="noopener" className="underline underline-offset-2">
          See the home page
        </a>
      </p>
      <LooksForm occasions={OCCASIONS} options={options} saved={saved} />
    </div>
  );
}
