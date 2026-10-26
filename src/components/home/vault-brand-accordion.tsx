"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ProductImage } from "@/components/product-image";
import type { Category, ProductImage as Img } from "@/lib/types";

export interface AccordionBrand {
  name: string;
  href: string;
  n: number;
  /** The lowest price still for sale, already written out ("Rs 2,999"), or "" when none is left. */
  from: string;
  /** Up to three of its pieces: the first stands behind the card, all three show small when it's open. */
  pics: { image: Img; category: Category; hex: string; name: string }[];
}

/**
 * The Vault's brands on the home page as cards that open one at a time (owner, 26 Oct 2026, after
 * the "Fey" reference): the open one wide, with the brand large, what it has and costs from, and
 * one of its pieces in black and white behind; the rest slim, the name running upright. Pointing at
 * one opens it and a click goes to its page; on a phone the first tap opens it, the second goes in.
 */
export function VaultBrandAccordion({ brands }: { brands: AccordionBrand[] }) {
  const [open, setOpen] = useState(0);
  // Which card is open right now, set the moment it's pointed at, so a mouse click always goes in.
  const now = useRef(0);
  const show = (i: number) => {
    now.current = i;
    setOpen(i);
  };
  return (
    <nav aria-label="Vault brands" className="flex flex-col gap-2 md:h-[320px] md:flex-row md:gap-2.5">
      {brands.map((b, i) => {
        const on = i === open;
        return (
          <Link
            key={b.name}
            href={b.href}
            aria-label={`${b.name} · ${b.n} ${b.n === 1 ? "piece" : "pieces"}${b.from ? ` · from ${b.from}` : ""} · Show all`}
            onPointerEnter={(e) => e.pointerType === "mouse" && show(i)}
            onFocus={() => show(i)}
            onClick={(e) => {
              // A first tap on a closed card opens it; the next one goes in.
              if (now.current !== i) {
                e.preventDefault();
                show(i);
              }
            }}
            className={`group relative isolate overflow-hidden rounded-[18px] bg-[linear-gradient(160deg,#2a2a2c_0%,#161617_45%,#0c0c0d_100%)] ring-1 ring-white/10 transition-[flex-grow,height,background-color] duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] md:h-auto md:min-w-0 md:basis-0 ${on ? "h-[220px] md:grow-[5]" : "h-[64px] md:grow"}`}
          >
            {/* Pictures (owner, 26 Oct 2026: "add pictures in it"): closed, its piece faint in black and
                white behind the name; open, the piece large in its own colours on the right */}
            {b.pics[0] && (
              <>
                <span aria-hidden className={`pointer-events-none absolute left-1/2 top-[52%] -z-10 hidden w-[190%] max-w-[220px] -translate-x-1/2 -translate-y-1/2 brightness-[1.8] grayscale transition-opacity duration-500 md:block ${on ? "opacity-0" : "opacity-45 group-hover:opacity-70"}`}>
                  <ProductImage image={b.pics[0].image} category={b.pics[0].category} colourHex={b.pics[0].hex} decorative ground="bg-transparent" sizes="200px" />
                </span>
                <span aria-hidden className={`pointer-events-none absolute -bottom-6 right-0 -z-10 w-[52%] max-w-[300px] transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${on ? "translate-y-0 opacity-90" : "translate-y-8 opacity-0"}`}>
                  <ProductImage image={b.pics[0].image} category={b.pics[0].category} colourHex={b.pics[0].hex} decorative ground="bg-transparent" sizes="300px" className="[filter:drop-shadow(0_20px_30px_rgba(0,0,0,0.6))]" />
                </span>
              </>
            )}
            {/* A soft sheen across the top, as on glass */}
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_20%_0%,rgba(255,255,255,0.10),transparent_60%)]" />

            {/* Closed: the name running upright (side by side) or across (stacked), and the count */}
            <span aria-hidden className={`absolute inset-0 flex items-center justify-between px-5 transition-opacity duration-300 md:flex-col md:items-center md:justify-between md:px-0 md:py-5 ${on ? "opacity-0" : "opacity-100 delay-200"}`}>
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-white md:rotate-180 md:[writing-mode:vertical-rl]">{b.name}</span>
              <span className="font-mono text-[11px] tabular-nums text-white/60">{String(b.n).padStart(2, "0")}</span>
            </span>

            {/* Open: the brand, what it has, what it costs from, and the way in */}
            <span aria-hidden className={`absolute inset-0 flex flex-col justify-between p-5 transition-opacity duration-500 md:p-7 ${on ? "opacity-100 delay-300" : "opacity-0"}`}>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/60">
                {String(i + 1).padStart(2, "0")} · {b.n} {b.n === 1 ? "piece" : "pieces"}
              </span>
              <span className="max-w-[60%]">
                <span className="block whitespace-nowrap text-[clamp(1.8rem,1.3rem+1.6vw,2.8rem)] font-semibold leading-none tracking-[-0.04em] text-white">{b.name}</span>
                {b.from && <span className="mt-2 block text-[14px] font-semibold tabular-nums text-white/85">From {b.from}</span>}
                {/* Three of its pieces, small */}
                {b.pics.length > 1 && (
                  <span className="mt-4 hidden gap-2 sm:flex">
                    {b.pics.slice(0, 3).map((p) => (
                      <span key={p.name} className="block w-12 overflow-hidden rounded-[8px] bg-[#e4e3df]">
                        <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative ground="bg-transparent" className="[&_img]:mix-blend-multiply" sizes="48px" />
                      </span>
                    ))}
                  </span>
                )}
                <span className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-white">
                  Show all
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#111] transition-transform duration-500 group-hover:-rotate-45">→</span>
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
