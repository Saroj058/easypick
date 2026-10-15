"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { BagItem } from "@/components/bag-item";
import { useBag } from "@/components/bag-provider";
import { GiftBagList } from "@/components/gift/gift-bag";
import { useMe } from "@/components/session";
import { formatPrice } from "@/lib/format";
import { useGiftBag } from "@/lib/gift-bag";
import { site } from "@/lib/site";

const noSubscribe = () => () => {};
/** /bag?tab=gift opens on the gift bag. */
const wantsGift = () => new URLSearchParams(window.location.search).get("tab") === "gift";

export default function BagPage() {
  const { lines, ready, subtotal, setQty, remove } = useBag();
  const me = useMe();
  const gifts = useGiftBag();
  const linked = useSyncExternalStore(noSubscribe, wantsGift, () => false);
  const [chosen, setTab] = useState<"bag" | "gift" | null>(null);
  const tab = chosen ?? (linked ? "gift" : "bag");
  const pieces = lines.reduce((n, l) => n + l.qty, 0);
  const tabClass = (on: boolean) =>
    `flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-colors ${on ? "bg-paper text-ink shadow-[0_1px_4px_rgba(0,0,0,0.12)]" : "text-ink/60 hover:text-ink"}`;

  // Free delivery: how far there is to go, as a line that fills.
  const free = site.delivery.freeAbove;
  const toFree = Math.max(0, free - subtotal);
  const filled = Math.min(100, Math.round((subtotal / free) * 100));

  return (
    <div className="container-ep pb-24 pt-8 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-[44px] leading-none md:text-[72px]">{tab === "gift" ? "Gift bag" : "Bag"}</h1>
        {/* The bag, and the gift bag: pieces to send together as one gift */}
        <div role="tablist" aria-label="Bags" className="inline-grid grid-cols-2 gap-1 rounded-full bg-mist p-1">
          <button type="button" role="tab" aria-selected={tab === "bag"} onClick={() => setTab("bag")} className={tabClass(tab === "bag")}>
            Bag{ready && pieces > 0 ? <span className="font-mono text-[12px] text-steel-dark">{pieces}</span> : null}
          </button>
          <button type="button" role="tab" aria-selected={tab === "gift"} onClick={() => setTab("gift")} className={tabClass(tab === "gift")}>
            Gift bag{gifts.length > 0 ? <span className="font-mono text-[12px] text-steel-dark">{gifts.length}</span> : null}
          </button>
        </div>
      </div>

      {tab === "gift" ? (
        <div className="max-w-3xl">
          <GiftBagList />
        </div>
      ) : !ready || me === undefined ? (
        <div className="mt-10 h-40" aria-hidden />
      ) : lines.length === 0 ? (
        // Empty: a calm card with the two ways in.
        <div className="mt-10 flex max-w-xl flex-col items-start rounded-[28px] border border-ink/10 p-8 md:p-10">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-mist">
            <ShoppingBag aria-hidden className="h-6 w-6" strokeWidth={1.6} />
          </span>
          <p className="mt-5 text-xl font-semibold">Your bag is empty.</p>
          <p className="mt-1 text-steel-dark">Tap the bag on any piece to add it here.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/drops" className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-[14px] font-semibold text-paper">
              See the drop
            </Link>
            <Link href="/shop" className="inline-flex h-11 items-center rounded-full border border-ink/25 px-5 text-[14px] font-semibold hover:border-ink">
              Shop all
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12">
          <ul className="space-y-3" aria-label="In your bag">
            {lines.map((l) => (
              <BagItem key={l.sku} slug={l.slug} name={l.name} colour={l.colour} size={l.size} price={l.price} qty={l.qty} onQty={(n) => setQty(l.sku, n)} onRemove={() => remove(l.sku)} />
            ))}
          </ul>

          {/* The summary: stays in view on larger screens */}
          <aside aria-label="Summary" className="rounded-[24px] bg-mist/50 p-5 md:p-6 lg:sticky lg:top-28">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-steel-dark">Summary</p>
            <dl className="mt-4 space-y-2 text-[15px]">
              <div className="flex justify-between">
                <dt>
                  Subtotal <span className="text-steel-dark">· {pieces === 1 ? "1 piece" : `${pieces} pieces`}</span>
                </dt>
                <dd className="font-mono tabular-nums">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-steel-dark">
                <dt>Store pickup</dt>
                <dd>Free</dd>
              </div>
              <div className="flex justify-between text-steel-dark">
                <dt>Delivery in the Valley</dt>
                <dd className="font-mono tabular-nums">{toFree === 0 ? "Free" : formatPrice(site.delivery.flatFee)}</dd>
              </div>
            </dl>

            {/* How far to free delivery */}
            <div className="mt-4 rounded-xl bg-paper p-3">
              <p className="text-[13px]">{toFree === 0 ? "Delivery is free on this order." : <>Add {formatPrice(toFree)} more for free delivery.</>}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                <div className="h-full rounded-full bg-volt transition-[width] duration-500" style={{ width: `${filled}%` }} />
              </div>
            </div>

            <div className="mt-5 flex items-baseline justify-between border-t border-ink/10 pt-4">
              <span className="text-lg font-semibold">Total</span>
              <span className="font-mono text-xl font-semibold tabular-nums">{formatPrice(subtotal)}</span>
            </div>
            <p className="text-right text-[12.5px] text-steel-dark">{toFree === 0 ? "pickup or delivery" : `pickup · ${formatPrice(subtotal + site.delivery.flatFee)} delivered`}</p>

            <Link href="/checkout" className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-volt text-[15px] font-semibold text-ink transition-[background-color,scale] hover:bg-[#b5f020] active:scale-[0.98]">
              Checkout
            </Link>
            <Link href="/shop" className="mt-2 flex h-11 w-full items-center justify-center rounded-full text-[14px] font-semibold underline-offset-4 hover:underline">
              Keep shopping
            </Link>
            <p className="mt-3 text-[12.5px] leading-relaxed text-steel-dark">
              VAT included. Stock is checked again when you pay.
              {me === null && " We'll text you a code at checkout to confirm your number. Your bag stays as it is."}
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
