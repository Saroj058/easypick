import { setOrderStep } from "@/app/admin/actions";
import { ktmDay } from "@/lib/ktm-day";
import { formatBS } from "@/lib/nepali-date";
import { refundedQty, type Order } from "@/lib/orders";
import { site } from "@/lib/site";

export const time = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const waitingOnReceiver = (o: Order) => o.gift?.mode === "pick" && (o.gift.status === "sent" || o.gift.status === "opened");
export const giftCardOnly = (o: Order) => o.kind === "gift_card" || o.gift?.status === "converted";

/** Ready at the counter / out for delivery for 5+ days without being collected. */
export const uncollected = (o: Order) => (o.status === "ready_for_pickup" || o.status === "out_for_delivery") && Date.now() - Date.parse(o.readyAt ?? o.paidAt ?? o.createdAt) > 5 * 86_400_000;

/** The owner's order lists (tabs on /admin/orders, tiles on Today). */
export const views = {
  attention: "Needs you",
  pack: "To pack",
  handover: "To hand over",
  gifts: "Gifts waiting",
  late: "Not collected",
  done: "Done",
  all: "All",
} as const;
export type View = keyof typeof views;

/** Whether a paid order belongs in a list. Today's tiles and the Orders tabs both use this. */
export function inView(o: Order, view: View) {
  if (view === "all") return true;
  if (view === "attention") return Boolean(o.attention);
  if (view === "done") return o.status === "completed" || o.status === "cancelled";
  if (view === "gifts") return o.status === "paid" && waitingOnReceiver(o);
  if (view === "late") return uncollected(o);
  if (giftCardOnly(o) || waitingOnReceiver(o)) return false;
  if (view === "pack") return o.status === "paid" && !o.packedAt;
  return (o.status === "paid" && Boolean(o.packedAt)) || o.status === "ready_for_pickup" || o.status === "out_for_delivery";
}

/** Each line with what's left after refunds (`qty`); `gone` when every piece was refunded. */
export function linesLeft(o: Order) {
  const done = refundedQty(o);
  return o.lines.map((line, i) => ({ line, i, qty: Math.max(0, line.qty - done[i]), refunded: done[i], gone: done[i] >= line.qty }));
}

const deliverDay = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, weekday: "short", day: "numeric", month: "short" });

/** "Deliver on Sat 3 Oct (Asoj 17)" for a gift with a date, and whether that day is still ahead. */
export function deliverOn(o: Order): { text: string; future: boolean } | null {
  const d = o.gift?.deliverOn;
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const at = new Date(`${d}T12:00:00+05:45`);
  return { text: `Deliver on ${deliverDay.format(at)} (${formatBS(at)})`, future: d > ktmDay() };
}

const small = "h-11 w-full rounded-[2px] border border-mist bg-paper px-3 text-[15px] outline-none focus:border-ink sm:w-40";

function Step({ order, step, label }: { order: Order; step: string; label: string }) {
  const rider = step === "ready" && (order.gift?.receiver?.method ?? order.method) === "delivery";
  return (
    <form action={setOrderStep} className={rider ? "flex w-full flex-wrap items-end gap-2 sm:w-auto" : ""}>
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="step" value={step} />
      {rider && (
        <>
          <label className="sr-only" htmlFor={`rn-${order.id}`}>
            Rider name
          </label>
          <input id={`rn-${order.id}`} name="riderName" placeholder="Rider name" autoComplete="off" className={small} />
          <label className="sr-only" htmlFor={`rp-${order.id}`}>
            Rider phone
          </label>
          <input id={`rp-${order.id}`} name="riderPhone" placeholder="Rider phone" inputMode="tel" autoComplete="off" className={small} />
        </>
      )}
      <button type="submit" className="btn btn-ink w-full sm:w-auto">
        {label}
      </button>
    </form>
  );
}

/** The next step for an order, as one button (rider details when it goes out for delivery). */
export function NextStep({ order }: { order: Order }) {
  if (order.status === "cancelled") return <p className="text-[14px] text-steel-dark">Cancelled.</p>;
  if (order.status === "awaiting_payment" || order.status === "expired") return <p className="text-[14px] text-steel-dark">{order.status === "expired" ? "Not paid in time." : "Waiting for payment."}</p>;
  if (giftCardOnly(order)) return <p className="text-[14px] text-steel-dark">Digital gift card. Nothing to pack.</p>;
  if (waitingOnReceiver(order)) return <p className="text-[14px] text-steel-dark">Waiting for {order.gift!.receiverName.split(" ")[0]} to pick a size.</p>;
  const pickup = (order.gift?.receiver?.method ?? order.method) === "pickup";
  if (order.status === "paid" && !order.packedAt) return <Step order={order} step="packed" label="Mark packed" />;
  if (order.status === "paid") return <Step order={order} step="ready" label={pickup ? "Ready at the counter" : "Out for delivery"} />;
  if (order.status === "ready_for_pickup" || order.status === "out_for_delivery") return <Step order={order} step="completed" label={pickup ? "Collected" : "Delivered"} />;
  if (order.status === "completed") return <p className="text-[14px] text-steel-dark">Done · {order.completedAt ? time.format(new Date(order.completedAt)) : ""}</p>;
  return null;
}

export function statusLabel(o: Order) {
  if (o.status === "cancelled") return (o.refunds ?? []).length ? "Cancelled, refunded" : "Cancelled";
  if (o.status === "expired") return "Expired (not paid)";
  if (o.status === "awaiting_payment") return "Waiting for payment";
  if (o.status === "completed") return o.method === "pickup" ? "Collected" : "Delivered";
  if (o.status === "ready_for_pickup") return "Ready at the counter";
  if (o.status === "out_for_delivery") return "Out for delivery";
  if (waitingOnReceiver(o)) return "Gift: waiting on size";
  if (o.packedAt) return "Packed";
  return "Paid";
}
