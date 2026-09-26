import type { Metadata } from "next";
import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { salesReport } from "@/lib/reports";
import { site } from "@/lib/site";
import { requireOwner } from "@/lib/staff";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90] as const;
const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, weekday: "short", day: "numeric", month: "short" });
const dropDay = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", year: "numeric" });

export default async function AdminReports({ searchParams }: PageProps<"/admin/reports">) {
  await requireOwner();
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p) === sp.days) ?? 30;
  const r = await salesReport(days);
  const best = Math.max(1, ...r.rows.map((x) => x.sales));

  return (
    <div className="space-y-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-[32px] md:text-[40px]">Reports</h2>
          <p className="mt-1 text-[14px] text-steel-dark">Sales are what was bought, less refunds, by Kathmandu day of payment. Gift card purchases (and gifts turned into a card) are counted when the card is spent.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/reports?days=${p}`}
              aria-current={p === days ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[14px] ${p === days ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
            >
              {p} days
            </Link>
          ))}
          <a href={`/admin/reports/csv?days=${days}`} download className="btn btn-outline">
            Orders CSV
          </a>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Sales", value: formatPrice(r.totals.sales) },
          { label: "Orders", value: r.totals.orders },
          { label: "Pieces", value: r.totals.pieces },
          { label: "Gift cards sold", value: formatPrice(r.totals.cards) },
        ].map((t) => (
          <li key={t.label} className="bg-photo p-5">
            <p className="text-[13px] text-steel-dark">{t.label}</p>
            <p className="mt-2 font-mono text-[28px] font-semibold leading-none tabular-nums">{t.value}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="day-h">
        <h3 id="day-h" className="text-lg font-semibold">
          Day by day
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[14px]">
            <thead className="text-[12px] text-steel-dark">
              <tr className="border-b border-mist">
                <th className="py-2 font-normal">Day</th>
                <th className="w-1/3 py-2 font-normal">
                  <span className="sr-only">Chart</span>
                </th>
                <th className="py-2 text-right font-normal">Sales</th>
                <th className="py-2 text-right font-normal">Orders</th>
                <th className="py-2 text-right font-normal">Pieces</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((d) => (
                <tr key={d.day} className="border-b border-mist">
                  <td className="py-2 text-steel-dark">{dayLabel.format(new Date(`${d.day}T12:00:00+05:45`))}</td>
                  <td className="py-2 pr-4">
                    <span className="block h-2 bg-ink" style={{ width: `${(d.sales / best) * 100}%` }} aria-hidden />
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">{d.sales ? formatPrice(d.sales) : "–"}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{d.orders || "–"}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{d.pieces || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="top-h">
          <h3 id="top-h" className="text-lg font-semibold">
            Best sellers
          </h3>
          {r.top.length === 0 ? (
            <p className="mt-2 text-[14px] text-steel-dark">Nothing sold in this period.</p>
          ) : (
            <table className="mt-3 w-full text-left text-[14px]">
              <thead className="text-[12px] text-steel-dark">
                <tr className="border-b border-mist">
                  <th className="py-2 font-normal">Piece</th>
                  <th className="py-2 text-right font-normal">Sold</th>
                  <th className="py-2 text-right font-normal">Sales</th>
                  <th className="py-2 text-right font-normal">Left</th>
                </tr>
              </thead>
              <tbody>
                {r.top.map((p) => (
                  <tr key={p.slug} className="border-b border-mist">
                    <td className="py-2">
                      <Link href={`/admin/products/${p.slug}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-mono">{p.sold}</td>
                    <td className="py-2 text-right font-mono">{formatPrice(p.sales)}</td>
                    <td className={`py-2 text-right font-mono ${p.left <= 2 ? "text-[#d70015]" : ""}`}>{p.left}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section aria-labelledby="slow-h">
          <h3 id="slow-h" className="text-lg font-semibold">
            Not selling
          </h3>
          <p className="mt-1 text-[14px] text-steel-dark">Live pieces with stock and no sales in {days} days. Worth a better photo, a new spot on the rail, or a sale price.</p>
          {r.slow.length === 0 ? (
            <p className="mt-2 text-[14px] text-steel-dark">Everything live has sold at least once.</p>
          ) : (
            <ul className="mt-3 divide-y divide-mist border-y border-mist text-[14px]">
              {r.slow.map((p) => (
                <li key={p.slug} className="flex justify-between py-2">
                  <Link href={`/admin/products/${p.slug}`} className="hover:underline">
                    {p.name}
                  </Link>
                  <span className="font-mono">{p.left} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="drops-h">
        <h3 id="drops-h" className="text-lg font-semibold">
          Drops: how much has sold
        </h3>
        <ul className="mt-3 space-y-3">
          {r.drops.map((d) => (
            <li key={d.slug} className="text-[14px]">
              <div className="flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-semibold">{d.name}</span> <span className="text-steel-dark">· {dropDay.format(new Date(d.releaseAt))}</span>
                </span>
                <span className="font-mono">
                  {Math.round(d.rate * 100)}% · {d.sold} sold, {d.left} left
                </span>
              </div>
              <span className="mt-1 block h-2 bg-mist" aria-hidden>
                <span className="block h-2 bg-ink" style={{ width: `${d.rate * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
