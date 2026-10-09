"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CheckoutForm } from "@/app/checkout/checkout-form";
import { formatPrice } from "@/lib/format";
import { useMySize } from "@/lib/my-size";
import type { BagLine } from "@/lib/types";
import { PieceControls, type RailPiece } from "./home/rail-wall";
import { ArrowIcon } from "./icons";
import { ProductImage } from "./product-image";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";

// A drop's pieces as one long strip (owner's reference, 10 Oct 2026; planned by three agents):
//  - it runs from one edge of the screen to the other, whatever the screen's width (the page that
//    uses it clips the few pixels a scrollbar adds: see the wrapper in app/drops/page.tsx);
//  - near-square rounded cards with clear gaps between them, on a soft band of light;
//  - the card at the centre is the largest, flat and sharp; its two neighbours are a little smaller
//    and turned in 3D toward it; the ones beyond are flat, smaller, paler and soft, fading out at
//    both edges of the page.
// It glides freely: drag it, swipe it, scroll it sideways, or use the arrow keys, and it settles on
// the nearest card. There are no arrows and it does not go round in a ring. Tapping a side card
// brings it to the centre; tapping the centre card opens its page.
//
// Everything about a card (where it is, its size, turn and fade) is one function of how far it is
// from the centre, and that distance is a fraction while the strip moves, so nothing jumps. The
// cards are moved by writing their styles directly, one frame at a time; React only hears when a
// different card reaches the centre. Not the home page's cover-flow (ui/coverflow-carousel.tsx).

/** The pieces are the home page's rail pieces, so the controls under the strip are the rail's own. */
export type DropPiece = RailPiece;

/** Blank tiles past each end, so a short drop still reads as a long strip. Never products. */
const GHOSTS = 5;
/** How far along the strip a card sits, in card widths, by its whole-number distance from the centre. */
const OFFSET = [0, 1.03, 1.93, 2.72, 3.46, 4.2, 4.94, 5.68, 6.42, 7.16, 7.9, 8.64];
const SCALE = [1, 0.86, 0.74, 0.64];
const FADE = [1, 1, 0.7, 0.35];
/** Soft and pale in fixed steps, never animated: a blur that changes every frame is too slow on phones. */
const TIERS = ["none", "none", "blur(1.5px) saturate(0.6) brightness(1.06)", "blur(3px) saturate(0.3) brightness(1.12)"];

const at = (table: number[], d: number) => {
  const a = Math.min(Math.abs(d), table.length - 1);
  const i = Math.floor(a);
  return i >= table.length - 1 ? table[table.length - 1] : table[i] + (table[i + 1] - table[i]) * (a - i);
};

/** A card's styles, d cards from the centre (a fraction while moving). `ghost` tiles only show from two cards out. */
function look(d: number, still: boolean, ghost: boolean) {
  const a = Math.abs(d);
  const side = d < 0 ? -1 : 1;
  // The turn peaks on the first neighbour and is gone by the centre and by the second.
  const turn = still ? 0 : -side * 28 * Math.max(0, 1 - Math.abs(a - 1));
  const opacity = at(FADE, d) * (ghost ? Math.min(1, Math.max(0, a - 1)) : 1);
  return {
    transform: `translate(-50%, -50%) translateX(calc(var(--w) * ${(side * at(OFFSET, d)).toFixed(4)})) perspective(900px) rotateY(${turn.toFixed(2)}deg) scale(${at(SCALE, d).toFixed(4)})`,
    opacity: opacity.toFixed(3),
    filter: still ? "none" : TIERS[Math.min(3, Math.round(a))],
    zIndex: String(20 - Math.min(19, Math.round(a))),
  };
}

export function DropStrip({ pieces, label, soon = false }: { pieces: DropPiece[]; label: string; /** A drop still to come: its pieces can be looked at, not bought. */ soon?: boolean }) {
  const router = useRouter();
  const mySize = useMySize();
  /** The piece being bought in the pop-up (the rail's Buy now, without leaving the page). */
  const [buying, setBuying] = useState<BagLine | null>(null);
  const n = pieces.length;
  const start = Math.floor((n - 1) / 2);
  const [active, setActive] = useState(start);

  const frame = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const pos = useRef(start); // which card is at the centre, as a fraction
  const target = useRef(start);
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const centre = useRef(start);
  const still = useRef(false); // the visitor asked for less motion
  const drag = useRef<{ id: number; x: number; y: number; pos: number; locked: boolean; v: number; t: number; lastX: number } | null>(null);
  const dragged = useRef(false);
  const wheelIdle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paint = useCallback(() => {
    for (let k = 0; k < cards.current.length; k++) {
      const el = cards.current[k];
      if (!el) continue;
      const i = k - GHOSTS;
      const s = look(i - pos.current, still.current, i < 0 || i >= n);
      el.style.transform = s.transform;
      el.style.opacity = s.opacity;
      if (el.style.filter !== s.filter) el.style.filter = s.filter;
      el.style.zIndex = s.zIndex;
    }
    const c = Math.min(n - 1, Math.max(0, Math.round(pos.current)));
    if (c !== centre.current) {
      centre.current = c;
      setActive(c);
    }
  }, [n]);

  const run = useCallback(() => {
    if (raf.current !== null) return;
    last.current = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last.current) / 1000);
      last.current = now;
      const gap = target.current - pos.current;
      // Eases in to the target with no bounce; about half a second to settle.
      pos.current = still.current || Math.abs(gap) < 0.0015 ? target.current : pos.current + gap * (1 - Math.exp(-dt * 9));
      paint();
      raf.current = pos.current === target.current ? null : requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [paint]);

  const go = useCallback(
    (to: number) => {
      target.current = Math.min(n - 1, Math.max(0, Math.round(to)));
      run();
    },
    [n, run],
  );

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => {
      still.current = m.matches;
      paint();
    };
    set();
    m.addEventListener("change", set);
    return () => {
      m.removeEventListener("change", set);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [paint]);

  // Sideways wheel / trackpad only: an up-and-down scroll belongs to the page.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const w = cards.current[GHOSTS]?.offsetWidth || 240;
      const to = Math.min(n - 1 + 0.3, Math.max(-0.3, pos.current + e.deltaX / w));
      pos.current = to;
      target.current = to;
      paint();
      if (wheelIdle.current) clearTimeout(wheelIdle.current);
      wheelIdle.current = setTimeout(() => go(pos.current), 110);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [n, go, paint]);

  const piece = pieces[Math.min(active, n - 1)];
  if (!piece) return null;
  const gone = (p: DropPiece) => p.status === "sold_out" || p.colours.every((c) => c.sizes.every((v) => v.left <= 0));

  return (
    <div className="mt-6">
      <div
        ref={frame}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${label}: ${n} ${n === 1 ? "piece" : "pieces"}`}
        tabIndex={0}
        onKeyDown={(e) => {
          const to = e.key === "ArrowRight" ? target.current + 1 : e.key === "ArrowLeft" ? target.current - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
          if (to === null) return;
          e.preventDefault();
          go(to);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          dragged.current = false;
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, pos: pos.current, locked: false, v: 0, t: performance.now(), lastX: e.clientX };
        }}
        onPointerMove={(e) => {
          const g = drag.current;
          if (!g || g.id !== e.pointerId) return;
          const dx = e.clientX - g.x;
          if (!g.locked) {
            // Sideways first: the strip takes it. Up or down first: it is the page's.
            if (Math.abs(dx) < 8) return;
            if (Math.abs(e.clientY - g.y) > Math.abs(dx)) {
              drag.current = null;
              return;
            }
            g.locked = true;
            dragged.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            if (raf.current !== null) cancelAnimationFrame(raf.current);
            raf.current = null;
          }
          const now = performance.now();
          const w = cards.current[GHOSTS]?.offsetWidth || 240;
          g.v = (e.clientX - g.lastX) / Math.max(1, now - g.t) / w; // cards per millisecond
          g.t = now;
          g.lastX = e.clientX;
          let to = g.pos - dx / w;
          // Past either end it follows the hand at a third of the speed, then springs back.
          if (to < 0) to *= 0.3;
          if (to > n - 1) to = n - 1 + (to - (n - 1)) * 0.3;
          pos.current = to;
          target.current = to;
          paint();
        }}
        onPointerUp={(e) => {
          const g = drag.current;
          drag.current = null;
          if (!g || !g.locked) return;
          e.currentTarget.releasePointerCapture(e.pointerId);
          // Carries on a little in the direction it was thrown, then settles on a card.
          go(pos.current - g.v * 110);
        }}
        onPointerCancel={() => {
          const g = drag.current;
          drag.current = null;
          if (g?.locked) go(pos.current);
        }}
        className="relative mx-[calc(50%-50vw)] h-[calc(var(--w)*1.32)] cursor-grab touch-pan-y select-none overflow-hidden bg-paper outline-none [--w:clamp(176px,20vw,248px)] [mask-image:linear-gradient(90deg,transparent,#000_9%,#000_91%,transparent)] focus-visible:shadow-[inset_0_0_0_2px_var(--color-ink)] active:cursor-grabbing"
      >
        {/* The band of light the cards sit on */}
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-[46%] -translate-y-1/2 bg-[linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.045)_50%,rgba(0,0,0,0))]" />

        {Array.from({ length: n + GHOSTS * 2 }, (_, k) => {
          const i = k - GHOSTS;
          const ghost = i < 0 || i >= n;
          const first = look(i - start, false, ghost);
          const style = { transform: first.transform, opacity: Number(first.opacity), filter: first.filter, zIndex: Number(first.zIndex) };
          const box = "absolute left-1/2 top-1/2 block aspect-[10/11] w-[var(--w)] overflow-hidden rounded-[14px] bg-[#efefef] will-change-transform";
          if (ghost)
            return (
              <span
                key={k}
                aria-hidden
                ref={(el) => {
                  cards.current[k] = el;
                }}
                className={box}
                style={style}
              />
            );
          const p = pieces[i];
          return (
            <button
              key={p.id}
              type="button"
              ref={(el) => {
                cards.current[k] = el;
              }}
              tabIndex={-1}
              aria-label={`${p.name}, ${formatPrice(p.price)}, ${i + 1} of ${n}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => {
                if (dragged.current) return; // the end of a drag is not a tap
                if (i === centre.current) router.push(`/product/${p.slug}`);
                else go(i);
              }}
              className={`${box} cursor-pointer transition-shadow duration-300 [@media(hover:hover)]:hover:shadow-[0_14px_30px_-14px_rgba(0,0,0,0.35)]`}
              style={style}
            >
              {/* The photo is 4:5 and the card a little squarer: it is cropped from the foot */}
              <span className="pointer-events-none absolute inset-x-0 -top-[4%] block">
                <ProductImage image={p.image} category={p.category} colourHex={p.colours[0]?.hex ?? "#888888"} decorative priority={Math.abs(i - start) < 2} sizes="(min-width: 1240px) 248px, (min-width: 880px) 20vw, 176px" className={!soon && gone(p) ? "opacity-60 grayscale" : ""} />
              </span>
            </button>
          );
        })}
      </div>

      {/* How far along the strip: a thin line, in place of arrows */}
      <div className="mt-5 flex flex-col items-center">
        {n <= 12 ? (
          <div aria-hidden className="flex gap-1.5">
            {pieces.map((p, i) => (
              <span key={p.id} className={`h-[2px] rounded-full transition-[width,background-color] duration-300 ${i === active ? "w-7 bg-ink" : "w-3 bg-ink/20"}`} />
            ))}
          </div>
        ) : (
          // Too many for a dash each: say where they are instead.
          <p aria-hidden className="font-mono text-[11px] tabular-nums tracking-[0.14em] text-steel-dark">
            <span className="font-semibold text-ink">{String(active + 1).padStart(2, "0")}</span> / {String(n).padStart(2, "0")}
          </p>
        )}
      </div>

      {soon ? (
        <div className="mt-4 flex flex-col items-center text-center" aria-live="polite">
          <h4 className="text-lg font-semibold">{piece.name}</h4>
          <p className="mt-1 font-mono text-[13px] tabular-nums">{formatPrice(piece.price)}</p>
          <Link href={`/product/${piece.slug}`} className="group mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold uppercase tracking-[0.06em]">
            View piece
            <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      ) : (
        // The home rail's controls, as they are there: name and price, colour, size, Buy now and the bag.
        <div className="mt-4" aria-live="polite">
          <PieceControls key={piece.id} piece={piece} mySize={mySize} onAdded={() => {}} onBuy={setBuying} />
        </div>
      )}

      {/* Buy now: the piece and the payment form in a pop-up, without leaving the page (the rail's own). */}
      <Sheet open={buying !== null} onOpenChange={(o) => !o && setBuying(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto border-mist bg-paper p-5 pt-6 sm:max-w-md">
          <SheetTitle className="display text-[34px] leading-none">Buy now</SheetTitle>
          {buying && (
            <>
              <SheetDescription className="mt-2 text-[14px] text-steel-dark">
                {buying.name} · {buying.colour}
                {buying.size === "ONE" ? "" : ` · ${buying.size}`} · {formatPrice(buying.price)}
              </SheetDescription>
              <CheckoutForm buyNow={buying} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
