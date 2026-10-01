"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { track } from "@/lib/track";
import type { BagLine } from "@/lib/types";
import { useBag } from "./bag-provider";

// Adding to the bag needs no account: guests have a bag on this phone, and the phone code is
// only asked for at checkout (docs/BLUEPRINT.md, section 06 and rule 4 of section 18).

/** Adds pieces to the bag. Returns true so callers can show their "added" note. */
export function useAddToBag() {
  const { add } = useBag();
  return useCallback(
    (items: Omit<BagLine, "qty">[]) => {
      items.forEach(add);
      items.forEach((l) => track(l.slug, "bag"));
      return true;
    },
    [add],
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

/** The small bag confirmation at the bottom of the screen. Mounted once in the layout. */
export function PendingBagAdd() {
  const [message, setMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  // Any "added" / "already in your bag" note from the page.
  useEffect(() => {
    const on = (e: Event) => setMessage((e as CustomEvent<string>).detail);
    window.addEventListener(TOAST_EVENT, on);
    return () => window.removeEventListener(TOAST_EVENT, on);
  }, []);

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
