"use client";

import { useRouter } from "next/navigation";

import { useBag } from "@/components/bag-provider";
import { openBuyNow, openSendGift } from "@/components/buy-sheets";
import type { OrderLine } from "@/lib/orders";

/** After an expired payment: one piece goes back to Buy now; several go back into the bag. */
export function TryAgain({ lines, gift }: { lines: OrderLine[]; gift: boolean }) {
  const { add, lines: bag } = useBag();
  const router = useRouter();
  if (gift) {
    return (
      <button type="button" onClick={() => openSendGift({ slug: lines[0].slug, name: lines[0].name, price: lines[0].unitPrice }, { colour: lines[0].colour })} className="btn btn-volt mt-4">
        Send the gift again
      </button>
    );
  }
  if (lines.length === 1 && lines[0].qty === 1) {
    return (
      <button
        type="button"
        onClick={() => openBuyNow([{ slug: lines[0].slug, sku: lines[0].sku, name: lines[0].name, size: lines[0].size, colour: lines[0].colour, price: lines[0].unitPrice, qty: 1 }])}
        className="btn btn-volt mt-4"
      >
        Try again
      </button>
    );
  }
  return (
    <button
      type="button"
      className="btn btn-volt mt-4"
      onClick={() => {
        // The bag is only emptied once an order is paid, so these may still be in it: top up, don't double.
        for (const l of lines) for (let i = bag.find((b) => b.sku === l.sku)?.qty ?? 0; i < l.qty; i++) add({ slug: l.slug, sku: l.sku, name: l.name, size: l.size, colour: l.colour, price: l.unitPrice });
        router.push("/bag");
      }}
    >
      Put them back in my bag
    </button>
  );
}
