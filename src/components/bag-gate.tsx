"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { BagLine } from "@/lib/types";
import { useBag } from "./bag-provider";
import { useMe } from "./session";

// The bag needs an account (it's saved to you). Buying one piece with "Buy now" doesn't.
// If a logged-out person taps Add to bag, we remember what they picked, send them to
// log in, and add it once they're back.

const PENDING = "ep-bag-pending";

/** Add to bag, or send the person to log in first. Returns true when it was added now. */
export function useAddToBag() {
  const { add } = useBag();
  const me = useMe();
  const router = useRouter();

  return useCallback(
    (items: Omit<BagLine, "qty">[]) => {
      if (me === null) {
        try {
          sessionStorage.setItem(PENDING, JSON.stringify(items));
        } catch {
          // storage blocked: they'll just pick again after logging in
        }
        const here = window.location.pathname + window.location.search;
        router.push(`/login?reason=bag&next=${encodeURIComponent(here)}`);
        return false;
      }
      items.forEach(add);
      return true;
    },
    [me, add, router],
  );
}

/** Finishes an Add to bag that was waiting on a login, and says so. Mounted once in the layout. */
export function PendingBagAdd() {
  const me = useMe();
  const { add, ready } = useBag();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!me || !ready) return;
    let items: unknown;
    try {
      items = JSON.parse(sessionStorage.getItem(PENDING) ?? "null");
      sessionStorage.removeItem(PENDING);
    } catch {
      return;
    }
    if (!Array.isArray(items) || items.length === 0) return;
    (items as Omit<BagLine, "qty">[]).forEach(add);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off note after login
    setCount(items.length);
    const t = setTimeout(() => setCount(0), 5000);
    return () => clearTimeout(t);
  }, [me, ready, add]);

  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8">
      {count > 0 && (
        <p className="pointer-events-auto flex items-center gap-4 rounded-[2px] bg-ink px-5 py-3 text-[15px] text-paper shadow-lg">
          {count === 1 ? "Added to your bag." : `${count} pieces added to your bag.`}
          <Link href="/bag" className="font-semibold text-volt underline underline-offset-2">
            View bag
          </Link>
        </p>
      )}
    </div>
  );
}
