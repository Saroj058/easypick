"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useBag } from "@/components/bag-provider";
import type { OrderLine } from "@/lib/orders";

/** After an expired payment: one piece goes back to Buy now; several go back into the bag. */
export function TryAgain({ lines, gift }: { lines: OrderLine[]; gift: boolean }) {
  const { add, lines: bag } = useBag();
  const router = useRouter();
  if (gift) {
    return (
      <Link href={`/gift/${lines[0].slug}`} className="btn btn-volt mt-4">
        Send the gift again
      </Link>
    );
  }
  if (lines.length === 1 && lines[0].qty === 1) {
    return (
      <Link href={`/buy/${lines[0].slug}?sku=${encodeURIComponent(lines[0].sku)}`} className="btn btn-volt mt-4">
        Try again
      </Link>
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
