"use client";

import { Gift } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatPrice } from "@/lib/format";
import { removeFromGiftBag, useGiftBag, type GiftBagItem } from "@/lib/gift-bag";
import type { Product } from "@/lib/types";
import { GiftForm } from "../gift-form";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../ui/sheet";

// The Bag page's "Gift bag" tab: pieces set aside to send together as one gift. "Send as one gift"
// opens the usual send-as-gift form over the page, with every piece in it.

export function GiftBagList() {
  const items = useGiftBag();
  const [sending, setSending] = useState(false);
  const total = items.reduce((n, i) => n + i.price, 0);

  if (!items.length) {
    return (
      <div className="mt-10">
        <p className="text-steel-dark">Your gift bag is empty.</p>
        <p className="mt-1 max-w-[46ch] text-[14px] text-steel-dark">On the Gift page, tap the gift button on a piece to add it here. Then send them together, in one box.</p>
        <Link href="/gift#pieces" className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-paper">
          <Gift aria-hidden className="h-4 w-4" />
          Find pieces to gift
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-8 divide-y divide-mist border-y border-mist">
        {items.map((i) => (
          <li key={i.sku} className="flex items-start justify-between gap-4 py-5">
            <div className="min-w-0">
              <Link href={`/product/${i.slug}?from=gift`} className="font-semibold hover:underline">
                {i.name}
              </Link>
              <p className="font-mono text-[14px] text-steel-dark">
                {i.colour} · {i.size === "ONE" ? "One size" : i.size}
              </p>
              <button type="button" onClick={() => removeFromGiftBag(i.sku)} className="mt-2 h-11 cursor-pointer text-sm underline underline-offset-2">
                Remove
              </button>
            </div>
            <p className="shrink-0 font-mono">{formatPrice(i.price)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-baseline justify-between text-lg font-semibold">
        <span>{items.length === 1 ? "1 piece" : `${items.length} pieces`}</span>
        <span className="font-mono">{formatPrice(total)}</span>
      </div>
      <p className="mt-1 text-[13px] text-steel-dark">One box, one note, one link. Wrapping and delivery are chosen next. Up to 6 pieces.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => setSending(true)} className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-volt sm:flex-1 px-6 text-[14px] font-semibold text-ink transition-[background-color,scale] hover:bg-[#b5f020] active:scale-[0.98]">
          <Gift aria-hidden className="h-4 w-4" />
          Send as one gift
        </button>
        <Link href="/gift#pieces" className="inline-flex h-12 items-center justify-center rounded-full border sm:flex-1 border-ink/25 px-6 text-[14px] font-semibold hover:border-ink">
          Add more pieces
        </Link>
      </div>
      <GiftBagSheet items={sending ? items : null} onClose={() => setSending(false)} />
    </>
  );
}

/** The send-as-gift form for the whole gift bag, over the page. */
function GiftBagSheet({ items, onClose }: { items: GiftBagItem[] | null; onClose: () => void }) {
  const first = items?.[0]?.slug ?? null;
  const [loaded, setLoaded] = useState<{ slug: string; product: Product | null } | null>(null);
  useEffect(() => {
    if (!first) return;
    let live = true;
    fetch(`/api/products/${first}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((product: Product | null) => live && setLoaded({ slug: first, product }))
      .catch(() => live && setLoaded({ slug: first, product: null }));
    return () => {
      live = false;
    };
  }, [first]);
  const product = loaded && loaded.slug === first ? loaded.product : undefined;

  return (
    <Sheet open={items !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto overscroll-contain border-mist bg-paper p-0 sm:max-w-lg">
        <SheetTitle className="sr-only">Send your gift bag</SheetTitle>
        <SheetDescription className="sr-only">{items ? `${items.length} pieces as one gift` : ""}</SheetDescription>
        {product === undefined ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center" role="status">
            <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-ink" />
            <p className="text-[14px] text-steel-dark">Getting your gift bag ready…</p>
          </div>
        ) : product && items ? (
          <GiftForm product={product} pieces={items} sheet />
        ) : (
          <p className="p-6 pt-16 text-[14px]">A piece in your gift bag isn&apos;t available any more. Remove it and try again.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** On the order page: the pieces just sent leave the gift bag. */
export function ForgetGiftBag({ skus }: { skus: string[] }) {
  useEffect(() => {
    skus.forEach(removeFromGiftBag);
  }, [skus]);
  return null;
}
