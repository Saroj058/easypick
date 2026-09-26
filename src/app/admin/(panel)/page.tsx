import Link from "next/link";

import { allDrops, allProducts, festivals, restockDemand } from "@/lib/catalogue";
import { formatPrice } from "@/lib/format";
import { ktmDay, ktmMidnight } from "@/lib/ktm-day";
import { activeOrders, ordersWithPaymentAttempts, paidOrdersBetween } from "@/lib/orders";
import { countsAsOrder, netSales } from "@/lib/reports";
import { effectiveStatus } from "@/lib/store";
import { inView, statusLabel, time } from "./orders/order-bits";
import { requireOwner } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function AdminToday({ searchParams }: PageProps<"/admin">) {
  await requireOwner();
  const { denied } = await searchParams;
  const today = ktmDay();
  const [orders, todays, toCheck, demand, products, drops, fests] = await Promise.all([
    activeOrders(),
    paidOrdersBetween(ktmMidnight(today)),
    ordersWithPaymentAttempts(7),
    restockDemand(),
    allProducts(),
    allDrops(),
    festivals(),
  ]);
  // The same lists the tiles link to.
  const toPack = orders.filter((o) => inView(o, "pack"));
  const toHandOver = orders.filter((o) => inView(o, "handover"));
  const attention = orders.filter((o) => inView(o, "attention"));
  const late = orders.filter((o) => inView(o, "late"));
  const waitingGifts = orders.filter((o) => inView(o, "gifts"));
  const noFestival = !fests.some((f) => f.date > today);
  const low = products
    .filter((p) => effectiveStatus(p, drops) === "live")
    .flatMap((p) => p.variants.map((v) => ({ p, v })))
    .filter(({ v }) => v.stock <= 2)
    .sort((a, b) => a.v.stock - b.v.stock || (demand[b.v.sku] ?? 0) - (demand[a.v.sku] ?? 0))
    .slice(0, 12);

  const tiles = [
    ...(attention.length ? [{ label: "Needs you", value: attention.length, href: "/admin/orders?view=attention", alert: true }] : []),
    { label: "To pack", value: toPack.length, href: "/admin/orders?view=pack" },
    { label: "Packed, to hand over", value: toHandOver.length, href: "/admin/orders?view=handover" },
    { label: "Gifts waiting on a size", value: waitingGifts.length, href: "/admin/orders?view=gifts" },
    ...(late.length ? [{ label: "Not collected, 5+ days", value: late.length, href: "/admin/orders?view=late", alert: true }] : []),
    { label: "Sales today", value: formatPrice(todays.reduce((n, o) => n + netSales(o), 0)), note: `${todays.filter(countsAsOrder).length} orders`, href: "/admin/orders?view=all" },
  ];

  return (
    <div className="space-y-12">
      {denied && <p role="alert" className="bg-photo px-4 py-3 text-[15px]">That page is for the owner. Ask them if you need something changed there.</p>}
      {noFestival && (
        <p className="bg-[#fff1e0] px-4 py-3 text-[15px] text-[#7a3e00]">
          No festival is dated after today, so customers see no upcoming festival or &ldquo;order by&rdquo; date.{" "}
          <Link href="/admin/festivals" className="font-semibold underline underline-offset-2">
            Add the next festivals
          </Link>
        </p>
      )}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className={`block h-full p-5 ${"alert" in t && t.alert ? "bg-[#fdecee] text-[#9b0010] hover:bg-[#fbd9dd]" : "bg-photo hover:bg-mist"}`}>
              <p className="text-[13px] text-steel-dark">{t.label}</p>
              <p className="mt-2 font-mono text-[32px] font-semibold leading-none tabular-nums">{t.value}</p>
              {t.note && <p className="mt-1 text-[13px] text-steel-dark">{t.note}</p>}
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="low">
        <h2 id="low" className="text-lg font-semibold">
          Running low
        </h2>
        <p className="mt-1 text-[14px] text-steel-dark">Live sizes with 2 or fewer left. &ldquo;Asked for&rdquo; is people waiting for a restock message.</p>
        {low.length === 0 ? (
          <p className="mt-4 text-steel-dark">Nothing is running low.</p>
        ) : (
          <table className="mt-4 w-full text-left text-[15px]">
            <thead className="text-[13px] text-steel-dark">
              <tr className="border-b border-mist">
                <th className="py-2 font-normal">Piece</th>
                <th className="py-2 font-normal">Colour · size</th>
                <th className="py-2 text-right font-normal">Left</th>
                <th className="py-2 text-right font-normal">Asked for</th>
              </tr>
            </thead>
            <tbody>
              {low.map(({ p, v }) => (
                <tr key={v.sku} className="border-b border-mist">
                  <td className="py-3">
                    <Link href={`/admin/products/${p.slug}`} className="font-semibold hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-3 text-steel-dark">
                    {v.colour} · {v.size === "ONE" ? "One size" : v.size}
                  </td>
                  <td className={`py-3 text-right font-mono tabular-nums ${v.stock === 0 ? "text-[#d70015]" : ""}`}>{v.stock}</td>
                  <td className="py-3 text-right font-mono tabular-nums">{demand[v.sku] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {toCheck.length > 0 && (
        <section aria-labelledby="pay-check">
          <h2 id="pay-check" className="text-lg font-semibold">
            Payments to check
          </h2>
          <p className="mt-1 text-[14px] text-steel-dark">
            Not paid in time or cancelled, but the customer opened the payment page in the last 7 days. Check the eSewa merchant portal in case money arrived.
          </p>
          <ul className="mt-4 divide-y divide-mist border-y border-mist text-[15px]">
            {toCheck.map((o) => {
              const tries = o.payments ?? (o.payment ? [o.payment] : []);
              return (
                <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold hover:underline">
                    {o.number}
                  </Link>
                  <span className="text-[14px] text-steel-dark">
                    {statusLabel(o)} · {formatPrice(o.total)} · {tries.length} {tries.length === 1 ? "try" : "tries"} · placed {time.format(new Date(o.createdAt))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
