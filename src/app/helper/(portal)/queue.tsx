import Link from "next/link";

import { giftCardOnly, NextStep, statusLabel, time, uncollected, waitingOnReceiver } from "@/app/admin/(panel)/orders/order-bits";
import { deliverOnText, HELPER_ATTENTION, packLines } from "@/lib/helper-view";
import type { Order } from "@/lib/orders";

// The helper's view of an order: what to pick, where it goes, and the one next step.
// No prices: helpers don't need them to pack, and gift slips often hide them.

const physical = (o: Order) => !giftCardOnly(o) && !waitingOnReceiver(o);
export const toPack = (o: Order) => o.status === "paid" && !o.packedAt && physical(o);
export const toHandOver = (o: Order) => o.status === "paid" && Boolean(o.packedAt) && physical(o);
export const atCounter = (o: Order) => o.status === "ready_for_pickup";
export const onTheWay = (o: Order) => o.status === "out_for_delivery";

const sizeText = (s: string) => (s === "ONE" ? "One size" : s);

export function HelperOrderCard({ o }: { o: Order }) {
  const g = o.gift;
  const method = g?.receiver?.method ?? o.method;
  const address = g?.receiver?.address ?? o.address;
  const late = uncollected(o);
  // Refunded pieces don't go in the bag.
  const lines = packLines(o);
  const deliverOn = deliverOnText(o);
  return (
    <li className={`border p-4 ${o.attention ? "border-[#d70015]" : late ? "border-[#b35c00]" : "border-mist"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <Link href={`/helper/order/${o.id}`} className="font-mono text-[18px] font-semibold underline-offset-2 hover:underline">
          {o.number}
        </Link>
        <span className="text-[13px] text-steel-dark">{time.format(new Date(o.paidAt ?? o.createdAt))}</span>
      </div>
      {/* The note itself can name refunds or payments; that's for the owner. */}
      {o.attention && <p className="mt-2 bg-[#fdecee] px-3 py-2 text-[14px] text-[#9b0010]">{HELPER_ATTENTION}</p>}
      {late && <p className="mt-2 bg-[#fff1e0] px-3 py-2 text-[14px] text-[#7a3e00]">Not collected for 5+ days. Call the customer.</p>}

      <ul className="mt-3 space-y-2">
        {lines.length === 0 && <li className="text-[14px] text-steel-dark">Nothing left to hand over: every piece was refunded.</li>}
        {lines.map((l, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="grid h-10 min-w-10 place-items-center rounded-[2px] bg-ink px-2 font-mono text-[15px] font-semibold text-paper">{sizeText(l.size)}</span>
            <span className="text-[15px] leading-tight">
              <span className="font-semibold">{l.name}</span>
              <span className="block text-steel-dark">
                {l.colour}
                {l.toPack > 1 ? ` · × ${l.toPack}` : ""} · <span className="font-mono text-[12px]">{l.sku}</span>
                {l.refunded > 0 && <span className="block text-[13px]">{l.refunded} refunded, don&apos;t pack</span>}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[14px]">
        {g ? (
          <>
            <span className="font-semibold">Gift for {g.receiverName}</span>
            {g.wrap === "premium" ? " · premium black box" : " · bag + tissue"}
            {g.showPrice ? "" : " · no price inside"}
            {deliverOn && (
              <span className={`block ${deliverOn.future ? "font-semibold text-[#7a3e00]" : ""}`}>
                {deliverOn.text}
                {deliverOn.future ? " · not before then" : ""}
              </span>
            )}
          </>
        ) : (
          <span className="font-mono">{o.phone}</span>
        )}
        <span className="block text-steel-dark">
          {g?.receiver?.tryInStore
            ? "Trying it on in the store"
            : method === "pickup"
              ? "Pickup at the counter"
              : address
                ? `Deliver: ${address.area}, near ${address.landmark}`
                : "Delivery address to come"}
          {o.rider ? ` · rider ${o.rider.name}` : ""}
        </span>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <NextStep order={o} />
        <Link href={`/admin/slip/${o.id}`} target="_blank" className="min-h-11 content-center text-[14px] underline underline-offset-2">
          Print slip
        </Link>
        <span className="sr-only">Status: {statusLabel(o)}</span>
      </div>
    </li>
  );
}

export function Section({ id, title, hint, orders }: { id: string; title: string; hint?: string; orders: Order[] }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="flex items-baseline gap-2 text-lg font-semibold">
        {title} <span className="font-mono text-[14px] text-steel-dark">{orders.length}</span>
      </h2>
      {hint && <p className="text-[13px] text-steel-dark">{hint}</p>}
      {orders.length === 0 ? (
        <p className="mt-2 text-[14px] text-steel-dark">Nothing here.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {orders.map((o) => (
            <HelperOrderCard key={o.id} o={o} />
          ))}
        </ul>
      )}
    </section>
  );
}
