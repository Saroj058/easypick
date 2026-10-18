"use client";

import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { ProductImage } from "@/components/product-image";
import { useArrowKeys } from "@/lib/arrow-keys";
import type { Category, ProductImage as Img } from "@/lib/types";

/** A product as a card on the wheel: plain data from the server. */
export interface WheelItem {
  id: string;
  slug: string;
  name: string;
  price: string;
  was: string;
  /** Its own cut, in percent. */
  off: number;
  image: Img;
  category: Category;
  hex: string;
}

/** Degrees between cards, how fast the wheel turns on its own, and how long the opening takes. */
const STEP = 15;
const SPEED = 2.4;
const OPEN_MS = 760;
const STAGGER = 38;

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * One offer's products on a big turning wheel (owner, 18 Oct 2026). It opens out of the offer card:
 * every product starts folded at the top of the curve, where the card was, and springs out along
 * the curve to its place, one after another; closing folds them back the same way. Few products
 * stand still in a small fan; more than five loop round, turning on their own, and stop while one
 * is pointed at. Drag it, or use the arrow keys. Each card opens its product.
 */
export function OfferWheel({ items, closing, onClosed, children }: { items: WheelItem[]; closing: boolean; onClosed: () => void; children?: React.ReactNode }) {
  const still = useReducedMotion();
  const ring = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);
  const angle = useRef(0);
  const target = useRef<number | null>(null);
  const held = useRef(false);
  const drag = useRef<{ x: number; a: number; moved: boolean } | null>(null);
  const born = useRef(0);
  const closedAt = useRef<number | null>(null);
  const radius = useSyncExternalStore(
    (fn) => {
      window.addEventListener("resize", fn);
      return () => window.removeEventListener("resize", fn);
    },
    () => (window.innerWidth < 640 ? 620 : window.innerWidth < 1024 ? 820 : 1000),
    () => 1000,
  );

  // A short list stands still as a fan; a longer one loops, repeated until the ring is full.
  const loops = items.length > 5;
  const shown = loops ? Array.from({ length: Math.max(1, Math.ceil(12 / items.length)) }, () => items).flat() : items;
  const n = shown.length;
  const span = n * STEP;

  useEffect(() => {
    if (closing && closedAt.current === null) closedAt.current = performance.now();
  }, [closing]);

  useEffect(() => {
    born.current = performance.now();
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (target.current !== null) {
        const d = target.current - angle.current;
        angle.current += d * Math.min(1, dt * 8);
        if (Math.abs(d) < 0.05) {
          angle.current = target.current;
          target.current = null;
        }
      } else if (loops && !still && !held.current && !drag.current && closedAt.current === null && now - born.current > OPEN_MS) {
        angle.current -= SPEED * dt;
      }
      // How far each card has come out of the card (0 folded, 1 in place).
      const opening = still ? 1 : (i: number) => ease(Math.min(1, Math.max(0, (now - born.current - i * STAGGER) / OPEN_MS)));
      const closingBy = closedAt.current === null ? null : (i: number) => (still ? 0 : 1 - ease(Math.min(1, Math.max(0, (now - (closedAt.current ?? now) - (n - 1 - i) * (STAGGER / 2)) / (OPEN_MS * 0.7)))));
      let allFolded = closedAt.current !== null;
      cards.current.forEach((el, i) => {
        if (!el) return;
        let a = loops ? (i * STEP + angle.current) % span : (i - (n - 1) / 2) * STEP + angle.current;
        if (loops) {
          if (a > span / 2) a -= span;
          if (a < -span / 2) a += span;
        }
        const p = closingBy ? closingBy(i) : typeof opening === "number" ? opening : opening(i);
        if (p > 0.001) allFolded = false;
        const far = Math.min(1, Math.abs(a) / 70);
        el.style.transform = `rotate(${a * p}deg) translateY(-${radius}px) scale(${0.55 + 0.45 * p})`;
        el.style.opacity = String(Math.abs(a) > 75 ? 0 : (1 - far * 0.35) * Math.min(1, p * 1.6));
        el.style.zIndex = String(100 - Math.round(Math.abs(a * p)));
      });
      if (closedAt.current !== null && (allFolded || still)) {
        onClosed();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // The wheel is made once per opening; closing is read from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, span, still, loops, n]);

  useArrowKeys(ring, (d) => {
    const from = target.current ?? angle.current;
    target.current = Math.round(from / STEP) * STEP - d * STEP;
  });

  return (
    <div
      ref={ring}
      role="region"
      aria-roledescription="carousel"
      aria-label="Pieces in this offer"
      onPointerLeave={() => {
        held.current = false;
        drag.current = null;
      }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, a: angle.current, moved: false };
        target.current = null;
      }}
      onPointerMove={(e) => {
        const g = drag.current;
        if (!g) return;
        const dx = e.clientX - g.x;
        if (Math.abs(dx) > 4) g.moved = true;
        angle.current = g.a + (dx / radius) * (180 / Math.PI);
      }}
      onPointerUp={() => {
        if (drag.current?.moved) target.current = Math.round(angle.current / STEP) * STEP;
        setTimeout(() => (drag.current = null), 0);
      }}
      className="relative mx-[calc(50%-50vw)] h-[440px] cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing sm:h-[480px] lg:h-[540px]"
    >
      <div className="absolute left-1/2" style={{ top: `calc(100% + ${radius - (radius > 900 ? 340 : radius > 700 ? 310 : 280)}px)` }}>
        {shown.map((p, i) => (
          <Link
            key={`${p.id}-${i}`}
            ref={(el) => {
              cards.current[i] = el;
            }}
            href={`/product/${p.slug}`}
            onClick={(e) => drag.current?.moved && e.preventDefault()}
            onPointerEnter={() => (held.current = true)}
            onPointerLeave={() => (held.current = false)}
            onFocus={() => (held.current = true)}
            onBlur={() => (held.current = false)}
            draggable={false}
            tabIndex={i < items.length ? 0 : -1}
            aria-hidden={i >= items.length || undefined}
            aria-label={`${p.name}, ${p.price}, was ${p.was}, ${p.off}% off`}
            className="absolute left-0 top-0 -ml-[70px] -mt-[100px] block h-[200px] w-[140px] origin-[50%_50%] opacity-0 will-change-transform sm:-ml-[96px] sm:-mt-[136px] sm:h-[272px] sm:w-[192px]"
            style={{ transform: `translateY(-${radius}px) scale(0.55)` }}
          >
            <span className="group relative flex h-full w-full flex-col overflow-hidden rounded-[18px] bg-[#f2f2f0] shadow-[0_24px_50px_-28px_rgba(0,0,0,0.55)] ring-1 ring-ink/5 transition-transform duration-300 hover:-translate-y-2">
              <span className="absolute left-3 top-3 z-10 rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-paper">{p.off}% off</span>
              <span className="relative block flex-1">
                <span className="absolute inset-2">
                  <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative ground="bg-transparent" className="h-full [&_img]:mix-blend-multiply" sizes="200px" />
                </span>
              </span>
              <span className="block bg-paper px-3 py-2.5">
                <span className="block truncate text-[12.5px] font-semibold sm:text-[13.5px]">{p.name}</span>
                <span className="mt-0.5 flex items-baseline gap-2 font-mono text-[12px] tabular-nums">
                  {p.price} <s className="text-[10.5px] text-steel-dark">{p.was}</s>
                </span>
              </span>
            </span>
          </Link>
        ))}
      </div>
      {children && <div className="pointer-events-none absolute inset-x-0 bottom-5 z-[200] flex flex-col items-center gap-3 text-center sm:bottom-8 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">{children}</div>}
    </div>
  );
}
