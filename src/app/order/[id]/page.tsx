import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CheckStatus } from "./check-status";
import { ClearBag } from "./clear-bag";
import { ShareGiftLink } from "@/components/share-gift-link";
import { Barcode } from "@/components/hang-tag";
import { formatPrice } from "@/lib/format";
import { findOrder, type Order } from "@/lib/orders";
import { advanceOrderInTestMode, payInTestMode } from "@/app/actions";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };
export const dynamic = "force-dynamic";

const providerLabel = { esewa: "eSewa", khalti: "Khalti", fonepay: "Fonepay" } as const;

const time = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Sent → Opened → Size picked → Packed → Delivered, with times. Never shows the receiver's address. */
function GiftProgress({ order }: { order: Order }) {
  const g = order.gift!;
  const first = g.receiverName.split(" ")[0];
  const converted = g.status === "converted";
  const steps: { label: string; at?: string; done: boolean }[] = [
    { label: `Sent to ${first}`, at: order.createdAt, done: true },
    { label: "Opened", at: g.openedAt, done: Boolean(g.openedAt) || g.status !== "sent" },
    ...(converted
      ? [{ label: "Turned into a gift card (their size was sold out)", done: true }]
      : [
          {
            label: g.receiver?.tryInStore ? "Trying it on in the store" : g.mode === "pick" ? "Size picked" : "Size chosen by you",
            at: g.chosenAt,
            done: g.mode === "set" || Boolean(g.chosenAt),
          },
          { label: "Packed", at: g.packedAt, done: Boolean(g.packedAt) },
          { label: "Delivered", at: g.deliveredAt, done: Boolean(g.deliveredAt) || g.status === "delivered" },
        ]),
  ];
  return (
    <section aria-labelledby="gift-progress" className="mt-10 bg-photo p-5 md:p-6">
      <h2 id="gift-progress" className="text-lg font-semibold">
        Gift for {g.receiverName}
      </h2>
      <ShareGiftLink url={`${site.url}/g/${g.token}`} name={g.receiverName} from={g.senderName} />
      {g.receiverEmail && (
        <p className="mt-3 text-[14px] text-steel-dark">
          {g.emailStatus === "failed" ? (
            <>
              <span className="font-semibold">We couldn&apos;t email {first} at {g.receiverEmail}.</span> Share the link above instead.
            </>
          ) : g.emailStatus === "sent" ? (
            <>We emailed the gift link to {g.receiverEmail}.</>
          ) : (
            <>We&apos;ll email the gift link to {g.receiverEmail} shortly.</>
          )}
        </p>
      )}
      <ol className="mt-5 space-y-4">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-3">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.done ? "bg-ink" : "border border-steel-dark"}`} aria-hidden />
            <span className={s.done ? "" : "text-steel-dark"}>
              {s.label}
              {s.at && <span className="ml-2 text-[13px] text-steel-dark">{time.format(new Date(s.at))}</span>}
              <span className="sr-only">{s.done ? " (done)" : " (not yet)"}</span>
            </span>
          </li>
        ))}
      </ol>
      {g.thanks && (
        <figure className="mt-6 bg-paper p-5">
          <blockquote className="text-lg">&ldquo;{g.thanks.text}&rdquo;</blockquote>
          <figcaption className="mt-2 text-[13px] text-steel-dark">
            {first} said thank you · {time.format(new Date(g.thanks.at))}
          </figcaption>
        </figure>
      )}
      {g.message && !g.thanks && <p className="mt-6 text-[15px] text-steel-dark">Your note: &ldquo;{g.message}&rdquo;</p>}
      <p className="mt-3 text-[13px] text-steel-dark">{g.showPrice ? "The price is shown to them." : "The price is hidden from them."}</p>
      <CheckStatus className="mt-6" />
    </section>
  );
}

/** Paid → Packed → Ready at the counter / On the way → Collected / Delivered, with times. */
function OrderTracker({ order }: { order: Order }) {
  const pickup = order.method === "pickup";
  const ready = order.status === "ready_for_pickup" || order.status === "out_for_delivery" || order.status === "completed";
  const done = order.status === "completed";
  const steps: { label: string; note?: string; at?: string; done: boolean }[] = [
    { label: "Paid", at: order.paidAt ?? order.createdAt, done: true },
    { label: "Packed", note: "The helper has picked your pieces off the rack.", at: order.packedAt, done: Boolean(order.packedAt) || ready },
    pickup
      ? { label: "Ready at the counter", note: "Bring your order number. We hold it for 7 days.", at: order.readyAt, done: ready }
      : { label: "On the way", note: "The rider calls before arriving.", at: order.readyAt, done: ready },
    { label: pickup ? "Collected" : "Delivered", at: order.completedAt, done },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <section aria-labelledby="order-status" className="mt-10 bg-photo p-5 md:p-6">
      <h2 id="order-status" className="text-lg font-semibold">
        Order status
      </h2>
      <ol className="mt-5">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span className={`absolute left-[5px] top-4 h-full w-px ${steps[i + 1].done ? "bg-ink" : "bg-mist"}`} aria-hidden />
            )}
            <span
              className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ${
                s.done ? "bg-ink" : i === current ? "border-2 border-ink bg-volt" : "border border-steel-dark bg-paper"
              }`}
              aria-hidden
            />
            <span>
              <span className={s.done || i === current ? "font-semibold" : "text-steel-dark"}>{s.label}</span>
              {s.at && s.done && <span className="ml-2 text-[13px] text-steel-dark">{time.format(new Date(s.at))}</span>}
              {i === current && <span className="ml-2 text-[13px] text-steel-dark">Next</span>}
              {s.note && (s.done || i === current) && <span className="block text-[14px] text-steel-dark">{s.note}</span>}
              <span className="sr-only">{s.done ? " (done)" : i === current ? " (next)" : " (not yet)"}</span>
            </span>
          </li>
        ))}
      </ol>
      <CheckStatus className="mt-6" />
      {process.env.NODE_ENV !== "production" && !done && (
        <form action={advanceOrderInTestMode}>
          <input type="hidden" name="orderId" value={order.id} />
          <button type="submit" className="min-h-11 text-[13px] text-steel-dark underline underline-offset-2">
            Move to the next step (test mode, until the helper&apos;s screen exists)
          </button>
        </form>
      )}
      <p className="mt-3 text-[13px] text-steel-dark">
        Come back any time: <Link href="/track" className="underline underline-offset-2">{site.url.replace(/^https?:\/\//, "")}/track</Link> with <span className="whitespace-nowrap">{order.number}</span> and your
        phone number.
      </p>
    </section>
  );
}

export default async function OrderPage({ params }: PageProps<"/order/[id]">) {
  const { id } = await params;
  const order = findOrder(id);
  if (!order) notFound();

  const awaiting = order.status === "awaiting_payment";
  const paid = !awaiting && order.status !== "expired";
  const heading = awaiting
    ? "Almost there."
    : order.status === "expired"
      ? "Order expired."
      : order.gift
        ? "Your gift is ready."
        : order.kind === "gift_card"
          ? "Gift card sent."
          : "Order confirmed.";
  const receiverFirst = order.gift?.receiverName.split(" ")[0];

  return (
    <div className="container-ep max-w-3xl pb-24 pt-10 md:pt-16">
      {order.source === "bag" && <ClearBag />}
      <p className="text-sm font-semibold text-steel-dark">Order {order.number}</p>
      <h1 className="display mt-3 text-[40px] md:text-[72px]">{heading}</h1>

      {awaiting && (
        <div className="mt-8 border-l-4 border-volt bg-photo p-5">
          {order.gift && (
            <p className="mb-3 text-[15px]">
              <span className="font-semibold">Pay to send your gift.</span> As soon as payment is confirmed we email {receiverFirst} the link, and
              it appears here for you to share too.
            </p>
          )}
          <p className="font-semibold">Test mode: {providerLabel[order.provider]} isn&apos;t connected yet.</p>
          <p className="mt-1 text-[15px] text-steel-dark">
            Once merchant accounts are live, this step sends you to {providerLabel[order.provider]} to pay. Your order is confirmed when the
            payment is verified server-to-server, and we hold your sizes for 15 minutes until then.
          </p>
          {process.env.NODE_ENV !== "production" && (
            <form action={payInTestMode} className="mt-4">
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="btn btn-ink">
                Pay now (test)
              </button>
            </form>
          )}
        </div>
      )}
      {order.status === "expired" && (
        <p className="mt-6 text-steel-dark">Payment wasn&apos;t completed within 15 minutes, so the items went back on the rack.</p>
      )}

      {order.gift && paid && <GiftProgress order={order} />}
      {!order.gift && order.kind !== "gift_card" && paid && <OrderTracker order={order} />}

      {order.kind === "gift_card" && order.issuedCardCode && (
        <section aria-label="Gift card" className="mt-10 bg-photo p-5 md:p-6">
          {paid ? (
            <>
              <p className="text-lg font-semibold">Their gift card</p>
              <p className="mt-3 inline-block bg-ink px-5 py-3 font-mono text-xl font-semibold tracking-[0.1em] text-paper">{order.issuedCardCode}</p>
              <p className="mt-3 text-[15px] text-steel-dark">
                {order.cardEmail?.status === "sent"
                  ? `We emailed the card to ${order.cardEmail.to}. You can also pass the code on yourself.`
                  : order.cardEmail?.status === "failed"
                    ? `We couldn't email ${order.cardEmail.to}. Send them the code yourself.`
                    : "Pass the code on to them yourself."}
              </p>
            </>
          ) : (
            <p className="text-[15px]">
              <span className="font-semibold">Pay to send the card.</span> We send it to them, and show you the code here, as soon as payment is
              confirmed.
            </p>
          )}
        </section>
      )}

      <dl className="mt-10 grid gap-6 sm:grid-cols-2">
        {order.kind !== "gift_card" && (
          <div>
            <dt className="text-sm font-semibold text-steel-dark">{order.gift ? "Delivery" : order.method === "pickup" ? "Pickup" : "Delivery to"}</dt>
            <dd className="mt-1">
              {order.gift
                ? order.gift.mode === "pick" && order.gift.status !== "chosen"
                  ? "They choose pickup or delivery."
                  : order.method === "pickup"
                    ? "Pickup at the store."
                    : "Delivered to them. We never share their address."
                : order.method === "pickup"
                  ? "Collect at the helper's counter. Bring your order number."
                  : `${order.address?.area}, near ${order.address?.landmark}`}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-sm font-semibold text-steel-dark">Updates by SMS to</dt>
          <dd className="mt-1 font-mono">
            {order.phone.slice(0, 3)}•••{order.phone.slice(-3)}
          </dd>
        </div>
      </dl>

      <figure className="mt-10 bg-photo px-4 py-8">
        <div className="receipt mx-auto max-w-[420px] px-6 pt-7 font-mono text-[13px] leading-relaxed">
          <p className="text-center font-semibold tracking-[0.16em]">EASYPICK</p>
          <p className="text-center text-[11px] uppercase tracking-[0.12em] text-steel-dark">Online order · {site.store.area}</p>
          <div className="my-4 border-t border-dashed border-steel" />
          <p className="flex justify-between text-[12px] uppercase tracking-[0.06em]">
            <span>Bill</span>
            <span>{order.number}</span>
          </p>
          <p className="flex justify-between text-[12px] uppercase tracking-[0.06em]">
            <span>Date</span>
            <span>
              {new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}
            </span>
          </p>
          <div className="my-4 border-t border-dashed border-steel" />
          <ul>
            {order.lines.map((l) => (
              <li key={l.sku} className="flex items-baseline">
                <span className="truncate">
                  {l.name} · {order.gift?.mode === "pick" && order.gift.status !== "chosen" ? "their size" : l.size === "ONE" ? "OS" : l.size}
                  {l.qty > 1 ? ` ×${l.qty}` : ""}
                </span>
                <span className="leader" aria-hidden />
                <span className="tabular-nums">{formatPrice(l.unitPrice * l.qty)}</span>
              </li>
            ))}
            {order.deliveryFee > 0 && (
              <li className="flex items-baseline text-steel-dark">
                <span>Delivery</span>
                <span className="leader" aria-hidden />
                <span className="tabular-nums">{formatPrice(order.deliveryFee)}</span>
              </li>
            )}
            {(order.wrapFee ?? 0) > 0 && (
              <li className="flex items-baseline text-steel-dark">
                <span>Premium gift box</span>
                <span className="leader" aria-hidden />
                <span className="tabular-nums">{formatPrice(order.wrapFee!)}</span>
              </li>
            )}
            {order.giftCard && (
              <li className="flex items-baseline text-steel-dark">
                <span>Gift card {order.giftCard.code}</span>
                <span className="leader" aria-hidden />
                <span className="tabular-nums">−{formatPrice(order.giftCard.applied)}</span>
              </li>
            )}
          </ul>
          <div className="my-4 border-t border-dashed border-steel" />
          <p className="flex items-baseline text-[15px] font-semibold">
            <span>TOTAL</span>
            <span className="leader" aria-hidden />
            <span className="tabular-nums">{formatPrice(order.total)}</span>
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-steel-dark">
            VAT incl. · {order.status === "awaiting_payment" ? `Awaiting ${providerLabel[order.provider]}` : order.status === "expired" ? "Expired" : `Paid by ${providerLabel[order.provider]}`}
          </p>
          <p className="display mt-6 text-center text-[26px] leading-none">Pick it. Pay it. Wear it.</p>
          <Barcode value={order.number} className="mx-auto mt-4 h-8 w-44 text-ink" />
          <p className="mt-1 text-center text-[11px] tracking-[0.12em] text-steel-dark">{order.number}</p>
        </div>
        <figcaption className="sr-only">Your bill for order {order.number}</figcaption>
      </figure>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link href="/drops" className="btn btn-volt flex-1">
          See the drop
        </Link>
        <Link href="/visit" className="btn btn-outline flex-1">
          Find us
        </Link>
      </div>
    </div>
  );
}
