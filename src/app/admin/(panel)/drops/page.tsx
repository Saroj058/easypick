import type { Metadata } from "next";
import Link from "next/link";

import { allDrops, allProducts } from "@/lib/catalogue";
import { formatDropTime, requestTime } from "@/lib/format";
import { requireOwner } from "@/lib/staff";
import { DropForm } from "./drop-form";

export const metadata: Metadata = { title: "Drops" };
export const dynamic = "force-dynamic";

/** ISO time → "yyyy-mm-ddThh:mm" in Kathmandu (UTC+5:45), for a datetime-local input. */
const toLocal = (iso: string) => new Date(Date.parse(iso) + 345 * 60_000).toISOString().slice(0, 16);

export default async function AdminDrops({ searchParams }: PageProps<"/admin/drops">) {
  await requireOwner();
  const { edit } = await searchParams;
  const [drops, products] = await Promise.all([allDrops(), allProducts()]);
  const sorted = [...drops].sort((a, b) => Date.parse(b.releaseAt) - Date.parse(a.releaseAt));
  const editing = typeof edit === "string" ? drops.find((d) => d.slug === edit) : undefined;
  const nextNumber = String(Math.max(0, ...drops.map((d) => Number(d.slug) || 0)) + 1).padStart(2, "0");

  const initial = editing
    ? { slug: editing.slug, name: editing.name, story: editing.story, releaseAt: toLocal(editing.releaseAt), products: products.filter((p) => p.dropSlug === editing.slug).map((p) => p.slug) }
    : { slug: nextNumber, name: `Drop ${nextNumber}`, story: "", releaseAt: "", products: [] };
  const choices = products.filter((p) => p.status !== "archived").map((p) => ({ slug: p.slug, name: p.name, status: p.status, dropSlug: p.dropSlug }));

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
      <section aria-labelledby="drops-h">
        <h2 id="drops-h" className="display text-[32px] md:text-[40px]">
          Drops
        </h2>
        <ul className="mt-6 divide-y divide-mist border-y border-mist">
          {sorted.map((d) => {
            const pieces = products.filter((p) => p.dropSlug === d.slug);
            const left = pieces.reduce((n, p) => n + p.variants.reduce((m, v) => m + v.stock, 0), 0);
            const upcoming = Date.parse(d.releaseAt) > requestTime();
            return (
              <li key={d.slug} className={`flex flex-wrap items-baseline justify-between gap-2 py-4 ${editing?.slug === d.slug ? "bg-photo px-3" : ""}`}>
                <div>
                  <p className="font-semibold">
                    {d.name} {upcoming && <span className="ml-1 rounded-full bg-volt px-2 py-0.5 text-[12px] font-semibold text-ink">Coming</span>}
                  </p>
                  <p className="text-[14px] text-steel-dark">
                    {formatDropTime(d.releaseAt)} · {pieces.length} {pieces.length === 1 ? "piece" : "pieces"} · {left} left of {d.pieceCount}
                  </p>
                </div>
                <Link href={`/admin/drops?edit=${d.slug}`} className="min-h-11 content-center text-[14px] underline underline-offset-2">
                  Edit
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="form-h">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="form-h" className="text-lg font-semibold">
            {editing ? `Edit ${editing.name}` : "New drop"}
          </h3>
          {editing && (
            <Link href="/admin/drops" className="text-[14px] underline underline-offset-2">
              New drop instead
            </Link>
          )}
        </div>
        <div className="mt-4">
          <DropForm key={editing?.slug ?? "new"} initial={initial} products={choices} isNew={!editing} />
        </div>
      </section>
    </div>
  );
}
