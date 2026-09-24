"use client";

import Link from "next/link";

import { useBag } from "@/components/bag-provider";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";

export default function BagPage() {
  const { lines, ready, subtotal, setQty, remove } = useBag();

  return (
    <div className="container-ep max-w-3xl pb-24 pt-10 md:pt-16">
      <title>Bag | Easypick</title>
      <h1 className="display text-[40px] md:text-[72px]">Bag</h1>

      {!ready ? (
        <div className="mt-10 h-40" aria-hidden />
      ) : lines.length === 0 ? (
        <div className="mt-10">
          <p className="text-steel-dark">Your bag is empty.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/drops" className="btn btn-volt">
              See the drop
            </Link>
            <Link href="/shop" className="btn btn-outline">
              Shop all
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-10 divide-y divide-mist border-y border-mist">
            {lines.map((l) => (
              <li key={l.sku} className="flex items-start justify-between gap-4 py-6">
                <div className="min-w-0">
                  <Link href={`/product/${l.slug}`} className="font-semibold hover:underline">
                    {l.name}
                  </Link>
                  <p className="font-mono text-[14px] text-steel-dark">
                    {l.colour} · {l.size === "ONE" ? "One size" : l.size}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <label className="sr-only" htmlFor={`qty-${l.sku}`}>
                      Quantity for {l.name}
                    </label>
                    <select
                      id={`qty-${l.sku}`}
                      value={l.qty}
                      onChange={(e) => setQty(l.sku, Number(e.target.value))}
                      className="h-11 rounded-[2px] border border-mist bg-paper px-3 font-mono"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => remove(l.sku)} className="h-11 text-sm underline underline-offset-2">
                      Remove
                    </button>
                  </div>
                </div>
                <p className="shrink-0 font-mono">{formatPrice(l.price * l.qty)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-6 space-y-2 font-mono">
            <div className="flex justify-between text-lg font-semibold">
              <dt className="font-sans">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-[14px] text-steel-dark">
              <dt className="font-sans">Pickup</dt>
              <dd>Free</dd>
            </div>
            <div className="flex justify-between text-[14px] text-steel-dark">
              <dt className="font-sans">Delivery in the Valley</dt>
              <dd>{subtotal >= site.delivery.freeAbove ? "Free" : formatPrice(site.delivery.flatFee)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[13px] text-steel-dark">VAT included. Stock is checked again when you pay.</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/checkout" className="btn btn-volt flex-1">
              Checkout
            </Link>
            <Link href="/shop" className="btn btn-outline flex-1">
              Keep shopping
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
