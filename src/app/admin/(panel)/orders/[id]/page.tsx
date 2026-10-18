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
  // Where the order is on its way: paid, packed, handed over, done.
  const pickup = method === "pickup";
  const track = ["Paid", "Packed", pickup ? "At the counter" : "Out for delivery", pickup ? "Collected" : "Delivered"];
  const reached =
    o.status === "completed" ? 3 : o.status === "ready_for_pickup" || o.status === "out_for_delivery" ? 2 : o.status === "paid" ? (o.packedAt ? 1 : 0) : -1;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-[13.5px] text-[#55575c] hover:text-ink">
          ← All orders
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]">Order · placed {time.format(new Date(o.createdAt))}</p>
            <h1 className="mt-1 font-mono text-[30px] font-semibold leading-none md:text-[36px]">{o.number}</h1>
            <p className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[#f4f4f2] px-3 py-1 text-[13px]">{statusLabel(o)}</span>
              <span className="rounded-full bg-[#f4f4f2] px-3 py-1 font-mono text-[13px]">{formatPrice(o.total)}</span>
              {g && <span className="rounded-full bg-ink px-3 py-1 text-[13px] text-paper">Gift</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[13.5px] font-semibold">
            <Link href={`/order/${o.id}`} target="_blank" className="inline-flex h-10 items-center rounded-full border border-ink/15 bg-white px-4 hover:border-ink">
              Customer&apos;s view ↗
            </Link>
            {goods && (
              <Link href={`/admin/slip/${o.id}`} target="_blank" className="inline-flex h-10 items-center rounded-full border border-ink/15 bg-white px-4 hover:border-ink">
                Packing slip ↗
              </Link>
            )}
          </div>
        </div>
      </div>

      {goods && reached >= 0 && (
        <ol aria-label="Progress" className="grid grid-cols-4 gap-2">
          {track.map((t, i) => (
            <li key={t} aria-current={i === reached ? "step" : undefined} className="min-w-0">
              <span className={`block h-1.5 rounded-full ${i <= reached ? "bg-ink" : "bg-[#e3e3e0]"}`} aria-hidden />
              <span className={`mt-2 block truncate text-[12.5px] ${i <= reached ? "font-semibold" : "text-[#8a8c91]"}`}>{t}</span>
            </li>
          ))}
        </ol>
      )}

      {o.attention && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#fdecee] px-5 py-3 text-[15px] text-[#9b0010]">
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
      <section aria-label="Next step" className="flex flex-wrap items-center gap-3 rounded-[24px] bg-[#f4f4f2] p-4">
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

      <section aria-labelledby="lines-h" className="rounded-[24px] bg-[#f4f4f2] p-5 md:p-6">
        <h3 id="lines-h" className="text-[17px] font-semibold">
          Pieces
        </h3>
        <ul className="mt-3 divide-y divide-ink/[0.06] rounded-2xl bg-white px-4">
          {o.lines.map((l, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-[15px]">
              <span>
                <Link href={`/admin/products/${l.slug}`} className="font-semibold hover:underline">
                  {l.name}
                </Link>{" "}
                <span className="text-[#6b6d72]">
                  · {l.colour} · {sizeText(l.size)}
                  {l.qty > 1 ? ` × ${l.qty}` : ""}
                </span>{" "}
                <span className="font-mono text-[12px] text-[#6b6d72]">{l.sku}</span>
                {done[i] > 0 && <span className="ml-2 text-[13px] text-[#9b0010]">{done[i]} refunded</span>}
              </span>
              <span className="font-mono tabular-nums">{formatPrice(l.unitPrice * l.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 px-1 text-[14px]">
          {o.deliveryFee > 0 && (
            <div className="flex justify-between">
              <dt className="text-[#6b6d72]">Delivery</dt>
              <dd className="font-mono">{formatPrice(o.deliveryFee)}</dd>
            </div>
          )}
          {(o.wrapFee ?? 0) > 0 && (
            <div className="flex justify-between">
              <dt className="text-[#6b6d72]">Gift box</dt>
              <dd className="font-mono">{formatPrice(o.wrapFee!)}</dd>
            </div>
          )}
          {o.giftCard && (
            <div className="flex justify-between">
              <dt className="text-[#6b6d72]">Gift card {o.giftCard.code}</dt>
              <dd className="font-mono">−{formatPrice(o.giftCard.applied)}</dd>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <dt>Paid by {o.provider}</dt>
            <dd className="font-mono">{formatPrice(o.total)}</dd>
          </div>
        </dl>
      </section>

      {live && goods && exchangeLines.length > 0 && (
        <div className="rounded-[24px] bg-[#f4f4f2] p-5 md:p-6">
          <ExchangeForm key={(o.events ?? []).length} orderId={o.id} lines={exchangeLines} windowDays={windowDays} pastWindow={pastWindow} canOverride={owner} />
        </div>
      )}

      {canRefund && (
        <div className="rounded-[24px] bg-[#f4f4f2] p-5 md:p-6">
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
        <section aria-labelledby="ref-h" className="rounded-[24px] bg-[#f4f4f2] p-5 md:p-6">
          <h3 id="ref-h" className="text-[17px] font-semibold">
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

      </div>

      <aside className="space-y-4 lg:sticky lg:top-24" aria-label="Customer, payment and history">
      <section aria-label="Customer and delivery" className="space-y-5 rounded-[24px] bg-[#f4f4f2] p-5 text-[15px]">
        <div>
          <h3 className="text-[13px] text-[#6b6d72]">{g ? "Gift for" : "Customer"}</h3>
          {g && <p className="mt-1 font-semibold">{g.receiverName}</p>}
          <p className="mt-1 font-mono">{g ? (g.receiverPhone ?? "no phone") : o.phone}</p>
          {g && (
            <p className="mt-1 text-[14px] text-[#6b6d72]">
              From {g.senderName ?? "someone (anonymous)"} · buyer <span className="font-mono">{o.phone}</span>
              {g.receiverEmail ? ` · ${g.receiverEmail}` : ""}
            </p>
          )}
        </div>
        <div>
          <h3 className="text-[13px] text-[#6b6d72]">{method === "pickup" ? "Pickup" : "Deliver to"}</h3>
          <p className="mt-1">
            {g?.receiver?.tryInStore
              ? "Trying it on in the store"
              : method === "pickup"
                ? "At the counter"
                : address
                  ? `${address.area}, near ${address.landmark}${address.details ? ` · ${address.details}` : ""}`
                  : "Address not given yet"}
          </p>
          {g?.receiver?.slot && <p className="text-[14px] text-[#6b6d72]">{g.receiver.slot}</p>}
          {o.rider && (
            <p className="mt-1 text-[14px]">
              Rider {o.rider.name} <span className="font-mono">{o.rider.phone}</span>
            </p>
          )}
        </div>
        {g && (
          <div>
            <h3 className="text-[13px] text-[#6b6d72]">Gift</h3>
            <p className="mt-1 text-[14px]">
              {g.wrap === "premium" ? "Premium black box" : "Standard bag + tissue"} · {g.showPrice ? "price may be shown" : "no price inside"} · {g.mode === "pick" ? "they pick the size" : "size chosen by buyer"} · status {g.status}
              {g.deliverOn ? ` · deliver on ${g.deliverOn}` : ""}
            </p>
            {g.message && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[14px]">&ldquo;{g.message}&rdquo;</p>}
          </div>
        )}
      </section>

      {attempts.length > 0 && (
        <section aria-labelledby="pay-h" className="rounded-[24px] bg-[#f4f4f2] p-5">
          <h3 id="pay-h" className="text-[17px] font-semibold">
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
                  <span className="text-[#6b6d72]"> · not completed</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="ev-h" className="rounded-[24px] bg-[#f4f4f2] p-5">
        <h3 id="ev-h" className="text-[17px] font-semibold">
          History
        </h3>
        <ol className="mt-3 space-y-2 text-[14px]">
          {[...(o.events ?? [])].reverse().map((e, i) => (
            <li key={i} className="relative border-l border-ink/10 pb-1 pl-4">
              <span className={`absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full ${i === 0 ? "bg-ink" : "bg-[#c4c5c8]"}`} aria-hidden />
              <span className="block">{e.what}</span>
              <span className="block text-[12.5px] text-[#6b6d72]">
                {time.format(new Date(e.at))} · {e.by}
              </span>
            </li>
          ))}
        </ol>
      </section>
      </aside>
      </div>
    </div>
  );
}
