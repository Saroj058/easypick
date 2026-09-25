"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

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

/** The piece waiting on a login, read once in the browser (null on the server). */
function readPending(): Omit<BagLine, "qty">[] | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(PENDING) ?? "null");
    return Array.isArray(v) && v.length ? v : null;
  } catch {
    return null;
  }
}
// A string snapshot, so React sees the same value until the stored piece really changes.
const pendingStore = {
  subscribe: () => () => {},
  get: () => JSON.stringify(readPending()),
};

/**
 * On the login page after "Add to bag": offer to buy that one piece right away instead,
 * with no account (Buy now goes straight to payment).
 */
export function BuyPendingNow() {
  const raw = useSyncExternalStore(pendingStore.subscribe, pendingStore.get, () => null);
  const items = raw ? (JSON.parse(raw) as Omit<BagLine, "qty">[] | null) : null;
  if (!items || items.length !== 1) return null;
  const l = items[0];
  return (
    <Link
      href={`/buy/${l.slug}?sku=${encodeURIComponent(l.sku)}`}
      onClick={() => {
        try {
          sessionStorage.removeItem(PENDING);
        } catch {}
      }}
      className="btn btn-outline mt-6 w-full"
    >
      Buy {l.name} now, no account
    </Link>
  );
}

const TOAST_EVENT = "ep:bag-toast";
const describe = (l: Omit<BagLine, "qty">) => `${l.name} (${l.colour}${l.size === "ONE" ? "" : `, ${l.size}`})`;

/** Shows the small bag confirmation at the bottom of the screen. */
export function showBagToast(text: string) {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: text }));
}

export function addedMessage(l: Omit<BagLine, "qty">) {
  return `Added ${describe(l)} to your bag.`;
}

/**
 * The bag confirmation popup. Also finishes an Add to bag that was waiting on a login.
 * Mounted once in the layout.
 */
export function PendingBagAdd() {
  const me = useMe();
  const { add, ready } = useBag();
  const [message, setMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  // Any "added" / "already in your bag" note from the page.
  useEffect(() => {
    const on = (e: Event) => setMessage((e as CustomEvent<string>).detail);
    window.addEventListener(TOAST_EVENT, on);
    return () => window.removeEventListener(TOAST_EVENT, on);
  }, []);

  // Back from logging in: add what they picked before.
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
    const lines = items as Omit<BagLine, "qty">[];
    lines.forEach(add);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off note after login
    setMessage(lines.length === 1 ? addedMessage(lines[0]) : `${lines.length} pieces added to your bag.`);
  }, [me, ready, add]);

  // Stays 8 seconds, and not while the pointer or keyboard focus is on it.
  useEffect(() => {
    if (!message || paused) return;
    const t = setTimeout(() => setMessage(null), 8000);
    return () => clearTimeout(t);
  }, [message, paused]);

  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8">
      {message && (
        <div
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="animate-fade-up pointer-events-auto flex max-w-md items-center gap-4 rounded-[2px] bg-ink py-1 pl-5 pr-1 text-[15px] text-paper shadow-lg"
        >
          <p className="py-2">{message}</p>
          <Link href="/bag" onClick={() => setMessage(null)} className="shrink-0 font-semibold text-volt underline underline-offset-2">
            View bag
          </Link>
          <button type="button" onClick={() => setMessage(null)} aria-label="Close" className="grid min-h-11 min-w-11 shrink-0 place-items-center text-paper/70 hover:text-paper">
            <span aria-hidden>✕</span>
          </button>
        </div>
      )}
    </div>
  );
}
