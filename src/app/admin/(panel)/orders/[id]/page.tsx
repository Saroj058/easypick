import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelUnpaid, clearAttention } from "@/app/admin/actions";
import { findProduct } from "@/lib/catalogue";
import { formatPrice, requestTime } from "@/lib/format";
import { findGiftCard } from "@/lib/gift-cards";
import { cardBehindOrder, piecesOnHold } from "@/lib/order-admin";
import { findOrder, refundedQty } from "@/lib/orders";
import { currentStaff, requireOwner, requireStaff } from "@/lib/staff";
import { giftCardOnly, NextStep, statusLabel, time, waitingOnReceiver } from "../order-bits";
import { ExchangeForm, RefundForm, type ExchangeLine, type RefundLine } from "./order-tools";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  if (!(await currentStaff())) return { title: "Order" };
  const o = await findOrder((await params).id);
  return { title: o?.number ?? "Order" };
}

const sizeText = (size: string) => (size === "ONE" ? "One size" : size);

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  await requireOwner();
  const { id } = await params;
  const [o, me] = await Promise.all([findOrder(id), requireStaff()]);
  if (!o) notFound();
  const owner = me.role === "owner";
  const g = o.gift;
  const method = g?.receiver?.method ?? o.method;
  const address = g?.receiver?.address ?? o.address;
  const done = refundedQty(o);
  const live = ["paid", "ready_for_pickup", "out_for_delivery", "completed"].includes(o.status);
  const goods = !giftCardOnly(o);

  const refundLines: RefundLine[] = o.lines
    .map((l, i) => ({ i, name: l.name, detail: `${l.colour} ${sizeText(l.size)}`, unitPrice: l.unitPrice, left: l.qty - done[i] }))
    .filter((l) => l.left > 0);
  const cardLeft = Math.max(0, (o.giftCard?.applied ?? 0) - (o.refunds ?? []).reduce((n, r) => n + r.toGiftCard, 0));
  // Fees still refundable (each only once), and the gift card this order's goods became, if any.
  const deliveryLeft = o.deliveryRefunded ? 0 : o.deliveryFee;
  const wrapLeft = o.wrapRefunded ? 0 : (o.wrapFee ?? 0);
  const behindCode = cardBehindOrder(o);
  const behind = behindCode ? await findGiftCard(behindCode) : null;
  const canRefund = owner && Boolean(o.paidAt) && (live || o.status === "cancelled") && (refundLines.length > 0 || deliveryLeft > 0 || wrapLeft > 0);

  const products = await Promise.all([...new Set(o.lines.map((l) => l.slug))].map(findProduct));
  const exchangeLines: ExchangeLine[] = o.lines.flatMap((l, i) => {
    const p = products.find((x) => x?.slug === l.slug);
    if (!p || done[i] >= l.qty || waitingOnReceiver(o)) return [];
    const options = p.variants.filter((v) => v.sku !== l.sku).map((v) => ({ sku: v.sku, label: `${v.colour} ${sizeText(v.size)}`, stock: v.stock }));
    return options.length ? [{ i, name: l.name, current: `${l.colour} ${sizeText(l.size)}`, options }] : [];
  });
  const windowDays = g ? 14 : 7;
  const pastWindow = requestTime() - Date.parse(o.completedAt ?? o.paidAt ?? o.createdAt) > windowDays * 86_400_000;
  const attempts = o.payments ?? (o.payment ? [o.payment] : []);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/orders" className="text-[14px] text-steel-dark underline underline-offset-2">
        All orders
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-[28px] font-semibold md:text-[34px]">{o.number}</h2>
        <p className="text-[14px] text-steel-dark">
          {statusLabel(o)} · placed {time.format(new Date(o.createdAt))}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-[14px]">
        <Link href={`/order/${o.id}`} target="_blank" className="min-h-11 content-center underline underline-offset-2">
          Customer&apos;s view ↗
        </Link>
        {goods && (
          <Link href={`/admin/slip/${o.id}`} target="_blank" className="min-h-11 content-center underline underline-offset-2">
            Packing slip ↗
          </Link>
        )}
      </div>

      {o.attention && (
        <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 bg-[#fdecee] px-4 py-3 text-[15px] text-[#9b0010]">
          <p>{o.attention}</p>
          {owner && (
            <form action={clearAttention}>
              <input type="hidden" name="orderId" value={o.id} />
              <button type="submit" className="min-h-11 font-semibold underline underline-offset-2">
                Mark as sorted
              </button>
            </form>
          )}
        </div>
      )}

      <section aria-label="Next step" className="mt-6 flex flex-wrap items-center gap-3">
        <NextStep order={o} />
        {owner && o.status === "awaiting_payment" && (
          <form action={cancelUnpaid}>
            <input type="hidden" name="orderId" value={o.id} />
            <button type="submit" className="btn btn-outline">
              Cancel and release the pieces
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="lines-h" className="mt-10 border-t border-mist pt-6">
        <h3 id="lines-h" className="text-lg font-semibold">
          Pieces
        </h3>
        <ul className="mt-3 divide-y divide-mist border-y border-mist">
          {o.lines.map((l, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-[15px]">
              <span>
                <Link href={`/admin/products/${l.slug}`} className="font-semibold hover:underline">
                  {l.name}
                </Link>{" "}
                <span className="text-steel-dark">
                  · {l.colour} · {sizeText(l.size)}
                  {l.qty > 1 ? ` × ${l.qty}` : ""}
                </span>{" "}
                <span className="font-mono text-[12px] text-steel-dark">{l.sku}</span>
                {done[i] > 0 && <span className="ml-2 text-[13px] text-[#9b0010]">{done[i]} refunded</span>}
              </span>
              <span className="font-mono tabular-nums">{formatPrice(l.unitPrice * l.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 text-[14px]">
          {o.deliveryFee > 0 && (
            <div className="flex justify-between">
              <dt className="text-steel-dark">Delivery</dt>
              <dd className="font-mono">{formatPrice(o.deliveryFee)}</dd>
            </div>
          )}
          {(o.wrapFee ?? 0) > 0 && (
            <div className="flex justify-between">
              <dt className="text-steel-dark">Gift box</dt>
              <dd className="font-mono">{formatPrice(o.wrapFee!)}</dd>
            </div>
          )}
          {o.giftCard && (
            <div className="flex justify-between">
              <dt className="text-steel-dark">Gift card {o.giftCard.code}</dt>
              <dd className="font-mono">−{formatPrice(o.giftCard.applied)}</dd>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <dt>Paid by {o.provider}</dt>
            <dd className="font-mono">{formatPrice(o.total)}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Customer and delivery" className="mt-8 grid gap-6 border-t border-mist pt-6 text-[15px] sm:grid-cols-2">
        <div>
          <h3 className="text-[13px] text-steel-dark">{g ? "Gift for" : "Customer"}</h3>
          {g && <p className="mt-1 font-semibold">{g.receiverName}</p>}
          <p className="mt-1 font-mono">{g ? (g.receiverPhone ?? "no phone") : o.phone}</p>
          {g && (
            <p className="mt-1 text-[14px] text-steel-dark">
              From {g.senderName ?? "someone (anonymous)"} · buyer <span className="font-mono">{o.phone}</span>
              {g.receiverEmail ? ` · ${g.receiverEmail}` : ""}
            </p>
          )}
        </div>
        <div>
          <h3 className="text-[13px] text-steel-dark">{method === "pickup" ? "Pickup" : "Deliver to"}</h3>
          <p className="mt-1">
            {g?.receiver?.tryInStore
              ? "Trying it on in the store"
              : method === "pickup"
                ? "At the counter"
                : address
                  ? `${address.area}, near ${address.landmark}${address.details ? ` · ${address.details}` : ""}`
                  : "Address not given yet"}
          </p>
          {g?.receiver?.slot && <p className="text-[14px] text-steel-dark">{g.receiver.slot}</p>}
          {o.rider && (
            <p className="mt-1 text-[14px]">
              Rider {o.rider.name} <span className="font-mono">{o.rider.phone}</span>
            </p>
          )}
        </div>
        {g && (
          <div className="sm:col-span-2">
            <h3 className="text-[13px] text-steel-dark">Gift</h3>
            <p className="mt-1 text-[14px]">
              {g.wrap === "premium" ? "Premium black box" : "Standard bag + tissue"} · {g.showPrice ? "price may be shown" : "no price inside"} · {g.mode === "pick" ? "they pick the size" : "size chosen by buyer"} · status {g.status}
              {g.deliverOn ? ` · deliver on ${g.deliverOn}` : ""}
            </p>
            {g.message && <p className="mt-2 border-l-2 border-mist pl-3 text-[14px]">&ldquo;{g.message}&rdquo;</p>}
          </div>
        )}
      </section>

      {live && goods && exchangeLines.length > 0 && (
        <div className="mt-10 border-t border-mist pt-8">
          <ExchangeForm key={(o.events ?? []).length} orderId={o.id} lines={exchangeLines} windowDays={windowDays} pastWindow={pastWindow} canOverride={owner} />
        </div>
      )}

      {canRefund && (
        <div className="mt-10 border-t border-mist pt-8">
          <RefundForm
            key={(o.refunds ?? []).length}
            orderId={o.id}
            lines={refundLines}
            deliveryFee={deliveryLeft}
            wrapFee={wrapLeft}
            cardLeft={cardLeft}
            restockable={piecesOnHold(o)}
            giftCard={behindCode ? { code: behindCode, left: behind?.balance ?? 0, blocked: behind?.status === "blocked" } : null}
          />
        </div>
      )}

      {(o.refunds ?? []).length > 0 && (
        <section aria-labelledby="ref-h" className="mt-10 border-t border-mist pt-6">
          <h3 id="ref-h" className="text-lg font-semibold">
            Refunds
          </h3>
          <ul className="mt-3 space-y-2 text-[14px]">
            {o.refunds!.map((r, i) => (
              <li key={i}>
                <span className="font-mono">{formatPrice(r.amount)}</span> · {time.format(new Date(r.at))} by {r.by}
                {r.toGiftCard ? ` · ${formatPrice(r.toGiftCard)} to gift card` : ""}
                {r.walletRef ? ` · eSewa ref ${r.walletRef}` : ""}
                {r.note ? ` · ${r.note}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {attempts.length > 0 && (
        <section aria-labelledby="pay-h" className="mt-10 border-t border-mist pt-6">
          <h3 id="pay-h" className="text-lg font-semibold">
            Payment attempts
          </h3>
          <ul className="mt-3 space-y-2 text-[14px]">
            {attempts.map((a) => (
              <li key={a.ref}>
                <span className="font-mono">{a.ref}</span> · {a.provider} · started {time.format(new Date(a.startedAt))}
                {a.verifiedAt ? (
                  <span className="text-[#1f7a3d]">
                    {" "}
                    · paid {a.amount ? formatPrice(a.amount) : ""} {a.gatewayRef ? `(${a.gatewayRef})` : ""}
                  </span>
                ) : (
                  <span className="text-steel-dark"> · not completed</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="ev-h" className="mt-10 border-t border-mist pt-6">
        <h3 id="ev-h" className="text-lg font-semibold">
          History
        </h3>
        <ol className="mt-3 space-y-2 text-[14px]">
          {[...(o.events ?? [])].reverse().map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-32 shrink-0 text-steel-dark">{time.format(new Date(e.at))}</span>
              <span>
                {e.what} <span className="text-steel-dark">· {e.by}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
