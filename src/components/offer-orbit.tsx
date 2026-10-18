"use client";

import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { ProductImage } from "@/components/product-image";
import { useArrowKeys } from "@/lib/arrow-keys";
import type { OfferSummary } from "@/lib/offer-rules";
import type { Category, ProductImage as Img } from "@/lib/types";

/** A piece from an offer, for the photo cards. */
export interface OfferPicture {
  image: Img;
  category: Category;
  hex: string;
}

/** Degrees between cards along the ring, and how fast it turns on its own (degrees a second). */
const STEP = 15;
const SPEED = 2.4;

/**
 * The festival offers in orbit (owner's reference, "Orbit", 18 Oct 2026): every offer is a card on
 * a huge circle whose top rises into view, the cards tilted along it, the ring turning slowly on
 * its own. Each card has its own look: a giant figure, a giant letter, a piece from the offer, a
 * solid colour. It stops while a card is pointed at; drag it, or use the arrow keys, to turn it by hand.
 * Every card opens its offer in the shop. Nothing moves for people who ask for less motion.
 */
export function OfferOrbit({ offers, pictures, children }: { offers: OfferSummary[]; pictures: Record<string, OfferPicture | undefined>; /** Set in the curve, under the cards. */ children?: React.ReactNode }) {
  const still = useReducedMotion();
  const ring = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);
  const angle = useRef(0);
  const target = useRef<number | null>(null);
  const held = useRef(false);
  const drag = useRef<{ x: number; a: number; moved: boolean } | null>(null);
  // The ring's size follows the window: a gentler curve on a wide screen.
  const radius = useSyncExternalStore(
    (fn) => {
      window.addEventListener("resize", fn);
      return () => window.removeEventListener("resize", fn);
    },
    () => (window.innerWidth < 640 ? 620 : window.innerWidth < 1024 ? 820 : 1000),
    () => 1000,
  );
  const n = offers.length;
  const span = n * STEP;

  // Every frame: turn a little (or ease toward a card chosen by key), then place each card.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const place = () => {
      cards.current.forEach((el, i) => {
        if (!el) return;
        // This card's angle, folded into -span/2 … span/2 so the ring loops without a seam.
        let a = (i * STEP + angle.current) % span;
        if (a > span / 2) a -= span;
        if (a < -span / 2) a += span;
        const far = Math.min(1, Math.abs(a) / 70);
        el.style.transform = `rotate(${a}deg) translateY(-${radius}px)`;
        el.style.opacity = String(Math.abs(a) > 75 ? 0 : 1 - far * 0.35);
        el.style.zIndex = String(100 - Math.round(Math.abs(a)));
      });
    };
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
      } else if (!still && !held.current && !drag.current) {
        angle.current -= SPEED * dt;
      }
      place();
      raf = requestAnimationFrame(tick);
    };
    place();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [radius, span, still]);

  // The arrow keys move one card along, to the nearest whole place.
  useArrowKeys(ring, (d) => {
    const from = target.current ?? angle.current;
    target.current = Math.round(from / STEP) * STEP - d * STEP;
  });

  if (!n) return null;

  return (
    <div
      ref={ring}
      role="region"
      aria-roledescription="carousel"
      aria-label="Festival offers in orbit"
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
        // Let go: settle on the nearest card.
        if (drag.current?.moved) target.current = Math.round(angle.current / STEP) * STEP;
        setTimeout(() => (drag.current = null), 0);
      }}
      className="relative mx-[calc(50%-50vw)] h-[420px] cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing sm:h-[460px] lg:h-[520px]"
    >
      {/* The ring's centre sits far below; every card hangs from it */}
      <div className="absolute left-1/2" style={{ top: `calc(100% + ${radius - (radius > 900 ? 330 : radius > 700 ? 300 : 270)}px)` }}>
        {offers.map((s, i) => (
          <Link
            key={s.offer.id}
            ref={(el) => {
              cards.current[i] = el;
            }}
            href={`/shop?offer=${s.offer.id}`}
            onClick={(e) => drag.current?.moved && e.preventDefault()}
            // The ring stops only while a card is pointed at (owner, 18 Oct 2026).
            onPointerEnter={() => (held.current = true)}
            onPointerLeave={() => (held.current = false)}
            onFocus={() => (held.current = true)}
            onBlur={() => (held.current = false)}
            draggable={false}
            aria-label={`${s.offer.name}: ${s.count} pieces, up to ${s.upTo}% off`}
            className="absolute left-0 top-0 -ml-[70px] -mt-[98px] block h-[196px] w-[140px] origin-[50%_50%] will-change-transform sm:-ml-[100px] sm:-mt-[140px] sm:h-[280px] sm:w-[200px]"
            style={{ transform: `rotate(${i * STEP}deg) translateY(-${radius}px)` }}
          >
            {/* Four looks in turn; the last one never repeats the first where the ring joins */}
            <OrbitCard s={s} look={i === n - 1 && i % 4 === 0 && n > 1 ? 3 : i % 4} picture={pictures[s.offer.id]} />
          </Link>
        ))}
      </div>
      {/* The heading and the way in, in the curve under the cards */}
      {children && <div className="pointer-events-none absolute inset-x-0 bottom-5 z-[200] [&_a]:pointer-events-auto flex flex-col items-center gap-4 text-center sm:bottom-8">{children}</div>}
    </div>
  );
}

/** One offer's card. Four looks in turn, as in the reference: a figure, a letter, a piece, a colour. */
function OrbitCard({ s, look, picture }: { s: OfferSummary; look: number; picture?: OfferPicture }) {
  const base = "relative flex h-full w-full flex-col overflow-hidden rounded-[18px] shadow-[0_24px_50px_-28px_rgba(0,0,0,0.55)] transition-transform duration-300 hover:-translate-y-2";
  const foot = (
    <span className="relative mt-auto flex items-end justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
      <span className="min-w-0 truncate">{s.offer.name}</span>
      <span className="shrink-0 tabular-nums">#{s.count}</span>
    </span>
  );
  if (look === 0)
    return (
      <span className={`${base} on-dark bg-ink p-4 text-paper`}>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/60">Up to</span>
        <span className="display my-auto text-center text-[68px] leading-[0.8] sm:text-[104px]">
          {s.upTo}
          <span className="text-[0.45em]">%</span>
        </span>
        {foot}
      </span>
    );
  if (look === 1)
    return (
      <span className={`${base} bg-paper p-4 text-ink ring-1 ring-ink/10`}>
        <span className="flex justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-steel-dark">
          <span>Easypick</span>
          <span>Offer</span>
        </span>
        <span aria-hidden className="my-auto text-center text-[118px] font-medium leading-none tracking-[-0.06em] sm:text-[176px]">
          {s.offer.name.replace(/^Under /, "").charAt(0)}
        </span>
        {foot}
      </span>
    );
  if (look === 2)
    return (
      <span className={`${base} bg-[#ecebe8] p-4 text-ink`}>
        {picture && (
          <span className="absolute inset-x-3 top-3 bottom-12">
            <ProductImage image={picture.image} category={picture.category} colourHex={picture.hex} decorative ground="bg-transparent" className="h-full [&_img]:mix-blend-multiply" sizes="200px" />
          </span>
        )}
        <span className="relative font-mono text-[10px] uppercase tracking-[0.12em] text-steel-dark">Up to {s.upTo}% off</span>
        {foot}
      </span>
    );
  return (
    <span className={`${base} on-dark bg-[linear-gradient(160deg,#1d4f86,#0c2340)] p-4 text-paper`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/60">{s.offer.group}</span>
      <span className="display my-auto text-[28px] leading-[0.9] sm:text-[40px]">{s.offer.name}</span>
      <span className="relative mt-auto flex items-end justify-between font-mono text-[10px] uppercase tracking-[0.12em]">
        <span>Up to {s.upTo}%</span>
        <span className="tabular-nums">#{s.count}</span>
      </span>
    </span>
  );
}
