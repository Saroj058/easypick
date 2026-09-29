import type { Metadata } from "next";
import Link from "next/link";

import { requireOwner } from "@/lib/staff";
import { MIN_ORDERS, trendingForAdmin, WEIGHTS } from "@/lib/trending";

export const metadata: Metadata = { title: "Trending" };
export const dynamic = "force-dynamic";

export default async function AdminTrending() {
  await requireOwner();
  const { enough, rows, live } = await trendingForAdmin();
  return (
    <div className="max-w-5xl">
      <h2 className="display text-[32px] md:text-[40px]">Trending</h2>
      <p className="mt-2 text-steel-dark">
        The public page shows{" "}
        <span className="font-semibold text-ink">{live.mode === "trending" ? `real Trending (${live.items.length} pieces)` : `${live.label} (${live.items.length} pieces)`}</span>.{" "}
        {enough ? "There's enough data for real Trending." : "Real Trending starts after 50 paid orders or four weeks of data."} A piece needs {MIN_ORDERS}+ orders this week to rank.
        Points: order {WEIGHTS.order}, bag {WEIGHTS.bag}, restock request {WEIGHTS.restock}, save {WEIGHTS.save}, view {WEIGHTS.view}. Updated hourly.
      </p>
      <p className="mt-2 text-[14px] text-steel-dark">Staff picks and hiding are set on each product&apos;s page (owner only, recorded in the activity log).</p>

      {rows.length === 0 ? (
        <p className="mt-10 text-steel-dark">No activity this week yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[14px]">
            <thead className="text-[12px] text-steel-dark">
              <tr className="border-b border-mist">
                <th className="py-2 font-normal">Piece</th>
                <th className="py-2 text-right font-normal">Score</th>
                <th className="py-2 text-right font-normal">Orders</th>
                <th className="py-2 text-right font-normal">Bag</th>
                <th className="py-2 text-right font-normal">Restock</th>
                <th className="py-2 text-right font-normal">Saves</th>
                <th className="py-2 text-right font-normal">Views</th>
                <th className="py-2 pl-4 font-normal">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product.slug} className="border-b border-mist">
                  <td className="py-2">
                    <Link href={`/admin/products/${r.product.slug}`} className="font-semibold hover:underline">
                      {r.product.name}
                    </Link>
                  </td>
                  <td className="py-2 text-right font-mono font-semibold">{r.score}</td>
                  <td className="py-2 text-right font-mono">{r.signals.orders}</td>
                  <td className="py-2 text-right font-mono">{r.signals.bag}</td>
                  <td className="py-2 text-right font-mono">{r.signals.restock}</td>
                  <td className="py-2 text-right font-mono">{r.signals.save}</td>
                  <td className="py-2 text-right font-mono">{r.signals.view}</td>
                  <td className="py-2 pl-4 text-[13px] text-steel-dark">
                    {[r.eligible ? "ranks" : `needs ${MIN_ORDERS}+ orders`, r.product.staffPick ? "staff pick" : "", r.product.hideFromTrending ? "kept off Trending" : ""].filter(Boolean).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
