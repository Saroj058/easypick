import Link from "next/link";

import { allProducts, restockDemand } from "@/lib/catalogue";
import { paidOrders } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { uncollected } from "./orders/order-bits";

export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("en-CA", { timeZone: site.timezone });

export default async function AdminToday({ searchParams }: PageProps<"/admin">) {
  const { denied } = await searchParams;
  const orders = await paidOrders();
  const today = day.format(new Date());
  const todays = orders.filter((o) => day.format(new Date(o.paidAt ?? o.createdAt)) === today);
  const toPack = orders.filter((o) => o.status === "paid" && !o.packedAt && o.kind !== "gift_card" && !(o.gift?.mode === "pick" && o.gift.status !== "chosen" && o.gift.status !== "delivered"));
  const toHandOver = orders.filter((o) => o.status === "paid" && o.packedAt);
  const attention = orders.filter((o) => o.attention);
  const late = orders.filter(uncollected);
  const waitingGifts = orders.filter((o) => o.gift?.mode === "pick" && (o.gift.status === "sent" || o.gift.status === "opened"));
  const demand = await restockDemand();
  const products = await allProducts();
  const low = products
    .filter((p) => p.status === "live")
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
    { label: "Sales today", value: formatPrice(todays.reduce((n, o) => n + o.total, 0)), note: `${todays.length} orders`, href: "/admin/orders?view=all" },
  ];

  return (
    <div className="space-y-12">
      {denied && <p role="alert" className="bg-photo px-4 py-3 text-[15px]">That page is for the owner. Ask them if you need something changed there.</p>}
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
    </div>
  );
}
