"use client";

import { useActionState, useState } from "react";

import { exchangeLine, refundOrder, type SaveState } from "@/app/admin/actions";
import { formatPrice } from "@/lib/format";

const input = "mt-2 h-11 w-full rounded-[2px] border border-mist bg-paper px-3 text-base outline-none focus:border-ink";
const label = "block text-sm font-semibold";

function Status({ state }: { state: SaveState }) {
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={`min-h-5 text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-steel-dark"}`}>
      {state.status === "idle" ? "" : state.message}
    </p>
  );
}

export type RefundLine = { i: number; name: string; detail: string; unitPrice: number; left: number };

/** Owner: refund some or all pieces. Gift card money goes back to the card first; the rest is refunded by hand in eSewa. */
export function RefundForm({ orderId, lines, deliveryFee, cardLeft }: { orderId: string; lines: RefundLine[]; deliveryFee: number; cardLeft: number }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(refundOrder, { status: "idle" });
  const [qty, setQty] = useState<Record<number, number>>({});
  const [delivery, setDelivery] = useState(false);
  const value = lines.reduce((n, l) => n + (qty[l.i] ?? 0) * l.unitPrice, 0) + (delivery ? deliveryFee : 0);
  const toCard = Math.min(value, cardLeft);
  const toWallet = value - toCard;

  return (
    <form action={action} className="space-y-5" aria-labelledby="refund-h">
      <input type="hidden" name="orderId" value={orderId} />
      <h3 id="refund-h" className="text-lg font-semibold">
        Refund
      </h3>
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.i} className="flex items-center justify-between gap-4 text-[15px]">
            <label htmlFor={`rq-${l.i}`}>
              <span className="font-semibold">{l.name}</span> <span className="text-steel-dark">· {l.detail} · {formatPrice(l.unitPrice)}</span>
            </label>
            <select
              id={`rq-${l.i}`}
              name={`qty:${l.i}`}
              value={qty[l.i] ?? 0}
              onChange={(e) => setQty((q) => ({ ...q, [l.i]: Number(e.target.value) }))}
              className="h-11 w-20 rounded-[2px] border border-mist bg-paper px-2"
            >
              {Array.from({ length: l.left + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {deliveryFee > 0 && (
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="includeDelivery" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} className="h-5 w-5 accent-ink" />
          Also refund delivery ({formatPrice(deliveryFee)})
        </label>
      )}
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" name="restock" defaultChecked className="h-5 w-5 accent-ink" />
        Put the pieces back in stock
      </label>
      <p className="bg-photo px-4 py-3 text-[14px]">
        Refund {formatPrice(value)}
        {toCard > 0 ? ` · ${formatPrice(toCard)} goes back to their gift card by itself` : ""}
        {toWallet > 0 ? ` · refund ${formatPrice(toWallet)} in the eSewa merchant portal first` : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="r-ref" className={label}>
            eSewa refund reference {toWallet > 0 ? "" : <span className="font-normal text-steel-dark">(not needed)</span>}
          </label>
          <input id="r-ref" name="walletRef" required={toWallet > 0} className={input} />
        </div>
        <div>
          <label htmlFor="r-note" className={label}>
            Note <span className="font-normal text-steel-dark">(optional)</span>
          </label>
          <input id="r-note" name="note" placeholder="e.g. too small, asked for money back" className={input} />
        </div>
      </div>
      <Status state={state} />
      <button type="submit" disabled={pending || value === 0} className="btn btn-ink">
        {pending ? "Refunding…" : value ? `Refund ${formatPrice(value)}` : "Refund"}
      </button>
    </form>
  );
}

export type ExchangeLine = { i: number; name: string; current: string; options: { sku: string; label: string; stock: number }[] };

/** Any staff: swap one piece for another size or colour. */
export function ExchangeForm({ orderId, lines, windowDays, pastWindow }: { orderId: string; lines: ExchangeLine[]; windowDays: number; pastWindow: boolean }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(exchangeLine, { status: "idle" });
  const [line, setLine] = useState(lines[0]?.i ?? 0);
  const current = lines.find((l) => l.i === line) ?? lines[0];
  if (!current) return null;
  return (
    <form action={action} className="space-y-5" aria-labelledby="ex-h">
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <h3 id="ex-h" className="text-lg font-semibold">
          Exchange a size or colour
        </h3>
        <p className="mt-1 text-[14px] text-steel-dark">Within {windowDays} days. The old piece goes back in stock and the new one comes off.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ex-line" className={label}>
            Piece
          </label>
          <select id="ex-line" name="line" value={line} onChange={(e) => setLine(Number(e.target.value))} className={input}>
            {lines.map((l) => (
              <option key={l.i} value={l.i}>
                {l.name} · {l.current}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ex-sku" className={label}>
            Swap for
          </label>
          <select id="ex-sku" name="newSku" key={line} className={input}>
            {current.options.map((o) => (
              <option key={o.sku} value={o.sku} disabled={o.stock <= 0}>
                {o.label} {o.stock <= 0 ? "(none left)" : `(${o.stock} left)`}
              </option>
            ))}
          </select>
        </div>
      </div>
      {pastWindow && (
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="override" className="h-5 w-5 accent-ink" />
          It&apos;s past {windowDays} days. Allow anyway
        </label>
      )}
      <Status state={state} />
      <button type="submit" disabled={pending} className="btn btn-outline">
        {pending ? "Exchanging…" : "Exchange"}
      </button>
    </form>
  );
}
