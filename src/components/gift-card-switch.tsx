"use client";

import { formatPrice } from "@/lib/format";

// A gift card at checkout (and when sending a gift): on by default when one is found, with a
// clear switch to pay without it, so the card's balance is kept for later (owner, 16 Oct 2026).

export function GiftCardSwitch({
  card,
  use,
  onUse,
  applied,
  onRemove,
}: {
  card: { code: string; balance: number; saved?: boolean };
  use: boolean;
  onUse: (on: boolean) => void;
  /** What the card pays on this order, when used. */
  applied: number;
  onRemove: () => void;
}) {
  const code = card.saved ? card.code.replace(/^EP-[A-Z0-9]{4}-/, "EP-••••-") : card.code;
  return (
    <div className="rounded-xl border border-ink/15 p-3">
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={use} onChange={(e) => onUse(e.target.checked)} className="peer sr-only" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold">Use {card.saved ? "my " : ""}gift card</span>
          <span className="block font-mono text-[12px] text-steel-dark">
            {code} · {formatPrice(card.balance)} on it
          </span>
        </span>
        <span
          aria-hidden
          className="relative h-6 w-10 shrink-0 rounded-full bg-ink/15 transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-paper after:shadow-[0_1px_3px_rgba(0,0,0,0.3)] after:transition-transform after:duration-200 peer-checked:bg-ink peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
        />
      </label>
      <p className="mt-1.5 text-[12.5px] text-steel-dark">
        {use ? `It pays ${formatPrice(applied)}; ${formatPrice(card.balance - applied)} stays on the card.` : "Not used. The whole balance stays on the card."}{" "}
        <button type="button" onClick={onRemove} className="cursor-pointer font-semibold text-ink underline underline-offset-2">
          Use another
        </button>
      </p>
    </div>
  );
}
