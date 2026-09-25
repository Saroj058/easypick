import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/orders";
import { site } from "@/lib/site";
import { setOrderStep } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const views = {
  pack: "To pack",
  handover: "To hand over",
  gifts: "Gifts waiting",
  done: "Done",
  all: "All",
} as const;
type View = keyof typeof views;

const time = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const waitingOnReceiver = (o: Order) => o.gift?.mode === "pick" && (o.gift.status === "sent" || o.gift.status === "opened");
const giftCardOnly = (o: Order) => o.kind === "gift_card" || o.gift?.status === "converted";

function inView(o: Order, view: View) {
  if (view === "all") return true;
  if (view === "done") return o.status === "completed";
  if (view === "gifts") return waitingOnReceiver(o);
  if (giftCardOnly(o) || waitingOnReceiver(o)) return false;
  if (view === "pack") return o.status === "paid" && !o.packedAt;
  return (o.status === "paid" && Boolean(o.packedAt)) || o.status === "ready_for_pickup" || o.status === "out_for_delivery";
}

function Step({ order, step, label, primary }: { order: Order; step: string; label: string; primary?: boolean }) {
  return (
    <form action={setOrderStep}>
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="step" value={step} />
      <button type="submit" className={`btn ${primary ? "btn-ink" : "btn-outline"} w-full sm:w-auto`}>
        {label}
      </button>
    </form>
  );
}

function Actions({ order }: { order: Order }) {
  if (giftCardOnly(order)) return <p className="text-[14px] text-steel-dark">Digital gift card. Nothing to pack.</p>;
  if (waitingOnReceiver(order)) return <p className="text-[14px] text-steel-dark">Waiting for {order.gift!.receiverName.split(" ")[0]} to pick a size.</p>;
  const pickup = order.method === "pickup";
  if (order.status === "paid" && !order.packedAt) return <Step order={order} step="packed" label="Mark packed" primary />;
  if (order.status === "paid") return <Step order={order} step="ready" label={pickup ? "Ready at the counter" : "Out for delivery"} primary />;
  if (order.status === "ready_for_pickup" || order.status === "out_for_delivery")
    return <Step order={order} step="completed" label={pickup ? "Collected" : "Delivered"} primary />;
  if (order.status === "completed") return <p className="text-[14px] text-steel-dark">Done · {order.completedAt ? time.format(new Date(order.completedAt)) : ""}</p>;
  return null;
}

function statusLabel(o: Order) {
  if (o.status === "completed") return o.method === "pickup" ? "Collected" : "Delivered";
  if (o.status === "ready_for_pickup") return "Ready at the counter";
  if (o.status === "out_for_delivery") return "Out for delivery";
  if (waitingOnReceiver(o)) return "Gift: waiting on size";
  if (o.packedAt) return "Packed";
  return "Paid";
}

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const view: View = typeof sp.view === "string" && sp.view in views ? (sp.view as View) : "pack";
  const paid = db((d) => d.orders.filter((o) => o.status !== "awaiting_payment" && o.status !== "expired"));
  const list = paid.filter((o) => inView(o, view)).sort((a, b) => Date.parse(a.paidAt ?? a.createdAt) - Date.parse(b.paidAt ?? b.createdAt));
  if (view === "done" || view === "all") list.reverse();

  return (
    <div>
      <ul className="flex flex-wrap gap-2" aria-label="Show">
        {(Object.keys(views) as View[]).map((v) => {
          const n = paid.filter((o) => inView(o, v)).length;
          return (
            <li key={v}>
              <Link
                href={`/admin/orders?view=${v}`}
                aria-current={v === view ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[14px] ${v === view ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
              >
                {views[v]}
                <span className="font-mono text-[12px] opacity-70">{n}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {list.length === 0 ? (
        <p className="mt-10 text-steel-dark">Nothing here right now.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {list.map((o) => {
            const g = o.gift;
            const address = g?.receiver?.address ?? o.address;
            const method = g?.receiver?.method ?? o.method;
            return (
              <li key={o.id} className="border border-mist p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-mono text-[15px] font-semibold">{o.number}</p>
                  <p className="text-[13px] text-steel-dark">
                    {statusLabel(o)} · paid {time.format(new Date(o.paidAt ?? o.createdAt))}
                  </p>
                </div>

                <ul className="mt-3 space-y-1 text-[15px]">
                  {o.lines.map((l) => (
                    <li key={l.sku}>
                      <span className="font-semibold">{l.name}</span>{" "}
                      <span className="text-steel-dark">
                        · {l.colour} · {waitingOnReceiver(o) ? "size not chosen yet" : l.size === "ONE" ? "One size" : l.size}
                        {l.qty > 1 ? ` × ${l.qty}` : ""}
                      </span>{" "}
                      <span className="font-mono text-[12px] text-steel-dark">{l.sku}</span>
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
                    </dd>
                  </div>
                  <div>
                    <dt className="text-steel-dark">Total</dt>
                    <dd className="font-mono">
                      {formatPrice(o.total)} <span className="text-steel-dark">· {o.provider}</span>
                    </dd>
                  </div>
                </dl>

                {g && (
                  <p className="mt-3 text-[14px] text-steel-dark">
                    {g.wrap === "premium" ? "Premium black box" : "Standard bag + tissue"} · {g.showPrice ? "price may be shown" : "no price inside"}
                    {g.message ? ` · card: “${g.message}”` : ""}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Actions order={o} />
                  <Link href={`/order/${o.id}`} className="min-h-11 content-center text-[14px] text-steel-dark underline underline-offset-2">
                    Customer&apos;s view
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
