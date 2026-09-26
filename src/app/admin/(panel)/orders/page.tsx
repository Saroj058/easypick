import type { Metadata } from "next";
import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { activeOrders, paidOrderCounts, recentDoneOrders, recentPaidOrders, searchOrders, type Order } from "@/lib/orders";
import { deliverOn, giftCardOnly, inView, linesLeft, NextStep, statusLabel, time, views, waitingOnReceiver, type View } from "./order-bits";
import { requireOwner } from "@/lib/staff";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

/** Done and All show the latest this many; older orders are found with the search. */
const RECENT = 200;

function OrderCard({ o }: { o: Order }) {
  const g = o.gift;
  const address = g?.receiver?.address ?? o.address;
  const method = g?.receiver?.method ?? o.method;
  const when = deliverOn(o);
  return (
    <li className={`border p-5 ${o.attention ? "border-[#d70015]" : "border-mist"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link href={`/admin/orders/${o.id}`} className="font-mono text-[15px] font-semibold underline-offset-2 hover:underline">
          {o.number}
        </Link>
        <p className="text-[13px] text-steel-dark">
          {statusLabel(o)} · {o.paidAt ? `paid ${time.format(new Date(o.paidAt))}` : `placed ${time.format(new Date(o.createdAt))}`}
        </p>
      </div>
      {o.attention && (
        <p role="alert" className="mt-3 bg-[#fdecee] px-3 py-2 text-[14px] text-[#9b0010]">
          {o.attention}
        </p>
      )}

      <ul className="mt-3 space-y-1 text-[15px]">
        {linesLeft(o).map(({ line: l, i, qty, refunded, gone }) => (
          <li key={i}>
            <span className={gone ? "text-steel-dark line-through" : ""}>
              <span className="font-semibold">{l.name}</span>{" "}
              <span className="text-steel-dark">
                · {l.colour} · {waitingOnReceiver(o) ? "size not chosen yet" : l.size === "ONE" ? "One size" : l.size}
                {!gone && qty > 1 ? ` × ${qty}` : ""}
              </span>{" "}
              <span className="font-mono text-[12px] text-steel-dark">{l.sku}</span>
            </span>
            {refunded > 0 && <span className="text-[13px] text-steel-dark"> · {gone ? "refunded" : `${refunded} refunded`}</span>}
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-3">
        <div>
          <dt className="text-steel-dark">{g ? "Gift for" : "Customer"}</dt>
          <dd>
            {g ? g.receiverName : null}
            <span className="block font-mono">{g ? (g.receiverPhone ?? "no phone") : o.phone}</span>
            {g && <span className="block text-steel-dark">From {g.senderName ?? "someone (anonymous)"} · buyer {o.phone}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-steel-dark">{method === "pickup" ? "Pickup" : "Deliver to"}</dt>
          <dd>
            {g?.receiver?.tryInStore
              ? "Trying it on in the store"
              : method === "pickup"
                ? "At the counter"
                : address
                  ? `${address.area}, near ${address.landmark}${address.details ? ` · ${address.details}` : ""}`
                  : "Address not given yet"}
            {g?.receiver?.slot && <span className="block text-steel-dark">{g.receiver.slot}</span>}
            {o.rider && <span className="block text-steel-dark">Rider {o.rider.name} {o.rider.phone}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-steel-dark">Total</dt>
          <dd className="font-mono">
            {formatPrice(o.total)} <span className="text-steel-dark">· {o.provider}</span>
          </dd>
        </div>
      </dl>

      {when && <p className={`mt-3 text-[14px] ${when.future ? "font-semibold text-[#7a3e00]" : "text-steel-dark"}`}>{when.text}</p>}
      {g && (
        <p className="mt-3 text-[14px] text-steel-dark">
          {g.wrap === "premium" ? "Premium black box" : "Standard bag + tissue"} · {g.showPrice ? "price may be shown" : "no price inside"}
          {g.message ? ` · card: “${g.message}”` : ""}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <NextStep order={o} />
        <Link href={`/admin/orders/${o.id}`} className="min-h-11 content-center text-[14px] underline underline-offset-2">
          Details
        </Link>
        {!giftCardOnly(o) && (
          <Link href={`/admin/slip/${o.id}`} target="_blank" className="min-h-11 content-center text-[14px] text-steel-dark underline underline-offset-2">
            Packing slip
          </Link>
        )}
      </div>
    </li>
  );
}

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  await requireOwner();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 40) : "";
  // Only what's still moving is loaded in full; Done and All are counted, then the latest few loaded.
  const [active, totals] = await Promise.all([activeOrders(), paidOrderCounts()]);
  const counts = Object.fromEntries((Object.keys(views) as View[]).map((v) => [v, active.filter((o) => inView(o, v)).length])) as Record<View, number>;
  counts.done = totals.done;
  counts.all = totals.all;
  const fallback: View = counts.attention > 0 ? "attention" : "pack";
  const view: View = typeof sp.view === "string" && sp.view in views ? (sp.view as View) : fallback;

  let list: Order[];
  if (q) list = await searchOrders(q);
  else if (view === "done") list = await recentDoneOrders(RECENT);
  else if (view === "all") list = await recentPaidOrders(RECENT);
  else list = active.filter((o) => inView(o, view)).sort((a, b) => Date.parse(a.paidAt ?? a.createdAt) - Date.parse(b.paidAt ?? b.createdAt));
  const more = !q && (view === "done" || view === "all") && counts[view] > list.length;

  return (
    <div>
      <form role="search" action="/admin/orders" className="flex max-w-xl gap-2">
        <label htmlFor="o-q" className="sr-only">
          Find an order
        </label>
        <input
          id="o-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Order number, phone or gift card code"
          className="h-11 min-w-0 flex-1 rounded-[2px] border border-mist bg-paper px-4 text-base outline-none placeholder:text-steel-dark focus:border-ink"
        />
        <button type="submit" className="btn btn-outline">
          Find
        </button>
      </form>

      {q ? (
        <p className="mt-6 text-[14px] text-steel-dark">
          {list.length} {list.length === 1 ? "order" : "orders"} for &ldquo;{q}&rdquo; ·{" "}
          <Link href="/admin/orders" className="underline underline-offset-2">
            Clear
          </Link>
        </p>
      ) : (
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Show">
          {(Object.keys(views) as View[])
            .filter((v) => (v !== "attention" && v !== "late") || counts[v] > 0 || v === view)
            .map((v) => (
              <li key={v}>
                <Link
                  href={`/admin/orders?view=${v}`}
                  aria-current={v === view ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[14px] ${v === view ? "border-ink bg-ink text-paper" : v === "attention" ? "border-[#d70015] text-[#9b0010]" : "border-mist hover:border-ink"}`}
                >
                  {views[v]}
                  <span className="font-mono text-[12px] opacity-70">{counts[v]}</span>
                </Link>
              </li>
            ))}
        </ul>
      )}

      {list.length === 0 ? (
        <p className="mt-10 text-steel-dark">
          {q ? (q.trim().length < 3 ? "Type at least 3 characters (4 digits for a phone number)." : "No orders match. Try the last digits of the phone number.") : "Nothing here right now."}
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {list.map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
        </ul>
      )}
      {more && <p className="mt-6 text-[14px] text-steel-dark">Showing the latest {list.length}. Search to find an older order.</p>}
    </div>
  );
}
