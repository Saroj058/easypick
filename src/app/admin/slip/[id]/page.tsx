import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { formatPrice } from "@/lib/format";
import { findOrder } from "@/lib/orders";
import { site } from "@/lib/site";
import { requireStaff } from "@/lib/staff";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Packing slip", robots: { index: false, follow: false } };

const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "long", year: "numeric" });

/**
 * A printable slip to go in the bag. For a gift with the price hidden, it shows no prices
 * and no buyer phone: only who it's from and their message.
 */
export default async function PackingSlip({ params }: PageProps<"/admin/slip/[id]">) {
  await requireStaff();
  const o = await findOrder((await params).id);
  if (!o) notFound();
  const g = o.gift;
  const prices = !g || g.showPrice;
  const method = g?.receiver?.method ?? o.method;
  const address = g?.receiver?.address ?? o.address;

  return (
    <main className="mx-auto max-w-[680px] bg-paper px-8 py-10 text-ink print:p-0">
      <div className="mb-8 flex items-center justify-between print:hidden">
        <p className="text-[14px] text-steel-dark">A4 or receipt printer. Only the slip prints.</p>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between border-b-2 border-ink pb-4">
        <Image src="/brand/logo.png" alt="Easypick" width={611} height={161} className="h-7 w-auto" priority />
        <div className="text-right">
          <p className="font-mono text-[20px] font-semibold">{o.number}</p>
          <p className="text-[13px]">{day.format(new Date(o.paidAt ?? o.createdAt))}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-6 text-[14px]">
        <div>
          <p className="text-[12px] uppercase tracking-[0.08em] text-steel-dark">{g ? "For" : "Customer"}</p>
          <p className="mt-1 text-[16px] font-semibold">{g ? g.receiverName : o.phone}</p>
          {g?.receiverPhone && <p className="font-mono">{g.receiverPhone}</p>}
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.08em] text-steel-dark">{method === "pickup" ? "Pickup" : "Deliver to"}</p>
          <p className="mt-1">
            {g?.receiver?.tryInStore
              ? "Trying on in the store"
              : method === "pickup"
                ? "At the counter"
                : address
                  ? `${address.area}, near ${address.landmark}${address.details ? `, ${address.details}` : ""}`
                  : "Address to come"}
          </p>
          {g?.receiver?.slot && <p>{g.receiver.slot}</p>}
        </div>
      </section>

      <table className="mt-8 w-full text-left text-[14px]">
        <thead>
          <tr className="border-b border-ink text-[12px] uppercase tracking-[0.08em]">
            <th className="py-2 font-semibold">Piece</th>
            <th className="py-2 font-semibold">Size</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            {prices && <th className="py-2 text-right font-semibold">Price</th>}
            <th className="py-2 pl-3 text-center font-semibold print:table-cell">✓</th>
          </tr>
        </thead>
        <tbody>
          {o.lines.map((l, i) => (
            <tr key={i} className="border-b border-mist">
              <td className="py-3">
                <span className="font-semibold">{l.name}</span>
                <span className="block font-mono text-[11px] text-steel-dark">{l.sku}</span>
              </td>
              <td className="py-3">
                {l.colour} · {l.size === "ONE" ? "One size" : l.size}
              </td>
              <td className="py-3 text-right font-mono">{l.qty}</td>
              {prices && <td className="py-3 text-right font-mono">{formatPrice(l.unitPrice * l.qty)}</td>}
              <td className="py-3 pl-3 text-center">
                <span className="inline-block h-4 w-4 border border-ink" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {prices && (
        <dl className="ml-auto mt-4 w-60 space-y-1 text-[14px]">
          {o.deliveryFee > 0 && (
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd className="font-mono">{formatPrice(o.deliveryFee)}</dd>
            </div>
          )}
          {o.giftCard && (
            <div className="flex justify-between">
              <dt>Gift card</dt>
              <dd className="font-mono">−{formatPrice(o.giftCard.applied)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-ink pt-1 font-semibold">
            <dt>Paid</dt>
            <dd className="font-mono">{formatPrice(o.total)}</dd>
          </div>
        </dl>
      )}

      {g && (
        <section className="mt-10 border-2 border-ink p-6 text-center">
          <p className="text-[12px] uppercase tracking-[0.08em] text-steel-dark">A gift from {g.senderName ?? "someone who likes you"}</p>
          {g.message && <p className="mt-3 text-[18px] leading-snug">&ldquo;{g.message}&rdquo;</p>}
          <p className="mt-4 text-[12px] text-steel-dark">Wrong size? Exchange within 14 days at the store or on {site.url.replace(/^https?:\/\//, "")}.</p>
        </section>
      )}

      <footer className="mt-10 text-center text-[12px] text-steel-dark">
        {site.name} · {site.tagline}
        {!g && <span className="block">Exchanges within 7 days with this slip or your order number.</span>}
      </footer>
    </main>
  );
}
