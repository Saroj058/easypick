"use client";

import { Gift, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { addToGiftBag } from "@/lib/gift-bag";
import { useMySize } from "@/lib/my-size";
import type { Addable } from "@/lib/addable";
import type { Size } from "@/lib/types";
import { useAddToBag, showBagToast } from "./bag-gate";
import { useMe } from "./session";

// The small "add to bag" button on product cards across the site (owner, 15 Oct 2026). One tap
// adds the piece when its size is known (one size, or the customer's saved size); otherwise a tiny
// size picker opens on the card. On the gift page it fills the gift bag instead, for sending
// several pieces as one gift.

const ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

export function AddToBag({ piece, to = "bag", className = "" }: { piece: Addable; to?: "bag" | "gift"; className?: string }) {
  const add = useAddToBag();
  const me = useMe();
  const mySize = useMySize();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Close the size picker on a tap anywhere else, or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const inStock = piece.options.filter((o) => o.left > 0);
  // Vault pieces go in the bag only for someone signed in (as on the product page).
  if (!inStock.length || (to === "bag" && piece.vault && !me)) return null;
  const firstColour = inStock[0].colour;
  const colourSizes = inStock.filter((o) => o.colour === firstColour).sort((a, b) => ORDER.indexOf(a.size) - ORDER.indexOf(b.size));
  const oneSize = colourSizes.every((o) => o.size === "ONE");
  const known = oneSize ? colourSizes[0] : mySize ? colourSizes.find((o) => o.size === mySize) : undefined;

  const put = (o: Addable["options"][number]) => {
    setOpen(false);
    const what = `${piece.name} (${o.colour}${o.size === "ONE" ? "" : `, ${o.size}`})`;
    if (to === "gift") {
      const r = addToGiftBag({ slug: piece.slug, sku: o.sku, name: piece.name, colour: o.colour, size: o.size, price: piece.price });
      showBagToast(r === "added" ? `Added ${what} to your gift bag.` : r === "already" ? `${what} is already in your gift bag.` : "Your gift bag is full: 6 pieces at most.");
      return;
    }
    if (add([{ slug: piece.slug, sku: o.sku, name: piece.name, size: o.size, colour: o.colour, price: piece.price }])) showBagToast(`Added ${what} to your bag.`);
  };

  const label = to === "gift" ? `Add ${piece.name} to the gift bag` : `Add ${piece.name} to bag`;
  return (
    <div ref={box} className={className || "relative"}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={known ? undefined : open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (known) put(known);
          else setOpen((v) => !v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex h-11 w-11 cursor-pointer items-center justify-center outline-none"
      >
        <span className="relative grid h-9 w-9 place-items-center rounded-full bg-paper/85 text-ink shadow-[0_2px_8px_-2px_rgba(0,0,0,0.25)] ring-1 ring-ink/10 backdrop-blur-md transition-[background-color,scale] duration-150 hover:bg-paper active:scale-90 [:focus-visible>&]:outline [:focus-visible>&]:outline-2 [:focus-visible>&]:outline-ink">
          {to === "gift" ? <Gift aria-hidden className="h-4 w-4" strokeWidth={1.8} /> : <ShoppingBag aria-hidden className="h-4 w-4" strokeWidth={1.8} />}
          <span aria-hidden className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-ink text-paper">
            <Plus className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        </span>
      </button>
      {open && (
        <div
          role="group"
          aria-label={`Size for ${piece.name}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-30 mt-1 w-max max-w-[220px] rounded-2xl bg-paper p-2 shadow-[0_16px_36px_-16px_rgba(0,0,0,0.45)] ring-1 ring-ink/10"
        >
          <p className="px-1 pb-1.5 text-[11.5px] text-steel-dark">Pick a size</p>
          <div className="flex flex-wrap gap-1">
            {colourSizes.map((o) => (
              <button
                key={o.sku}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  put(o);
                }}
                className="h-9 min-w-10 cursor-pointer rounded-lg border border-ink/15 px-2 font-mono text-[13px] font-semibold transition-colors hover:border-ink hover:bg-ink hover:text-paper"
              >
                {o.size}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
