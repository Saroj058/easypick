"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { PriceTag } from "@/components/hang-tag";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";
import type { Category, ProductImage as Img } from "@/lib/types";

// An offer on the left (what it is, how much, where to see all of it) and the pieces on offer in
// a row on the right. The row keeps moving along by itself, without a break and without an end
// (the cards are laid out twice, and the row slips back by one set where nobody can see it). It
// holds still while the mouse is over it, while it is touched or focused, when it is off screen,
// and for people who have turned motion off; it carries on from where it was left.

export interface OfferItem {
  id: string;
  href: string;
  name: string;
  /** A short second line: the colour, the kind. */
  sub: string;
  /** Formatted: "Rs 799". */
  price: string;
  was: string;
  /** Whole per cent off, worked out from the two prices. */
  off: number;
  sku: string;
  image: Img;
  category: Category;
  hex: string;
}

export interface OffersCarouselProps {
  eyebrow?: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  items: OfferItem[];
  /** How fast the row moves by itself, in pixels a second; 0 turns it off. */
  speed?: number;
  className?: string;
}

/** `copy` marks the second set of cards, there only so the row has no end: hidden from screen readers and the Tab key. */
function ItemCard({ item, copy = false }: { item: OfferItem; copy?: boolean }) {
  return (
    <motion.li aria-hidden={copy || undefined} className="group w-[62%] max-w-[240px] shrink-0 snap-start sm:w-56" whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
      <Link href={item.href} tabIndex={copy ? -1 : undefined} className="block">
        <div className="relative">
          <div className="relative overflow-hidden">
            <ProductImage image={item.image} category={item.category} colourHex={item.hex} decorative sizes="(min-width: 640px) 224px, 62vw" className="transition-transform duration-300 group-hover:scale-[1.03]" />
            <span className="absolute bottom-2 left-2 bg-ink px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-paper">{item.off}% off</span>
          </div>
          {/* The price, on a tag tied to the bottom of the photo and hanging beside the words. */}
          <PriceTag price={item.price} sku={item.sku} className="absolute right-2 top-full -mt-3" />
        </div>
        <h3 className="mt-3 line-clamp-1 pr-[72px] text-[15px] md:pr-[88px] font-semibold decoration-1 underline-offset-4 group-hover:underline">{item.name}</h3>
        <p className="mt-0.5 line-clamp-1 pr-[72px] text-[13px] text-steel-dark md:pr-[88px]">{item.sub}</p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 pr-[72px] font-mono tabular-nums md:pr-[88px]">
          <span className="text-[16px] font-semibold">
            <span className="sr-only">now </span>
            {item.price}
          </span>
          <s className="text-[13px] text-steel-dark">
            <span className="sr-only">was </span>
            {item.was}
          </s>
        </p>
      </Link>
    </motion.li>
  );
}

/** Fewer cards than this fit on a wide screen at once, so the row stays put and is not doubled. */
const LOOP_FROM = 6;

export function OffersCarousel({ eyebrow, title, subtitle, ctaText, ctaHref, items, speed = 60, className }: OffersCarouselProps) {
  const row = React.useRef<HTMLUListElement>(null);
  const [edge, setEdge] = React.useState({ start: true, end: false });
  /** Reasons the row is holding still right now. */
  const held = React.useRef({ mouse: false, focus: false, touch: false, hidden: true });
  const release = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const loop = items.length >= LOOP_FROM;

  /** The width of one full set of cards: how far along the second set starts. */
  const span = React.useCallback(() => {
    const el = row.current;
    if (!el || !loop) return 0;
    const first = el.children[0] as HTMLElement | undefined;
    const again = el.children[items.length] as HTMLElement | undefined;
    return first && again ? again.offsetLeft - first.offsetLeft : 0;
  }, [items.length, loop]);

  // A short row has two ends: which arrows have somewhere to go.
  React.useEffect(() => {
    const el = row.current;
    if (!el || loop) return;
    const measure = () => setEdge({ start: el.scrollLeft < 10, end: el.scrollWidth - el.scrollLeft - el.clientWidth < 10 });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [items.length, loop]);

  /** One card along. In the endless row, it first slips a set back or forward (unseen) when it is near an end. */
  const step = React.useCallback(
    (dir: 1 | -1) => {
      const el = row.current;
      if (!el) return;
      const card = el.querySelector("li");
      const pitch = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
      const set = span();
      if (set) {
        if (dir < 0 && el.scrollLeft < pitch) el.scrollLeft += set;
        else if (dir > 0 && el.scrollLeft + el.clientWidth + pitch > el.scrollWidth) el.scrollLeft -= set;
      }
      el.scrollBy({ left: dir * pitch, behavior: "smooth" });
    },
    [span],
  );

  // The row keeps moving until something holds it, and carries on from wherever it was left.
  React.useEffect(() => {
    const el = row.current;
    if (!el || !loop || !speed) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hold = held.current;
    const seen = new IntersectionObserver(([entry]) => (hold.hidden = !entry.isIntersecting), { threshold: 0.2 });
    seen.observe(el);
    let frame = 0;
    let last = 0;
    let at = 0;
    let moving = false;
    const run = (now: number) => {
      frame = requestAnimationFrame(run);
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now;
      if (hold.mouse || hold.focus || hold.touch || hold.hidden || document.hidden) {
        moving = false;
        return;
      }
      const set = span();
      if (!set) return;
      if (!moving) {
        at = el.scrollLeft % set; // the visitor may have scrolled it themselves
        moving = true;
      }
      at += speed * dt;
      if (at >= set) at -= set;
      el.scrollLeft = at;
    };
    frame = requestAnimationFrame(run);
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
    };
  }, [loop, speed, span]);

  React.useEffect(
    () => () => {
      if (release.current) clearTimeout(release.current);
    },
    [],
  );

  const arrow = "absolute top-[38%] z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-ink bg-paper shadow-[0_8px_20px_-10px_rgba(0,0,0,0.5)] hover:bg-ink hover:text-paper md:grid";

  return (
    <div className={cn("grid grid-cols-1 items-center gap-8 lg:grid-cols-12", className)}>
      {/* Left: the offer */}
      <div className="lg:col-span-3">
        {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">{eyebrow}</p>}
        <h2 id="offers-title" className="display mt-2 text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[0.92]">
          {title}
        </h2>
        <p className="mt-3 text-[15px] text-steel-dark">{subtitle}</p>
        <Link href={ctaHref} className="btn btn-outline mt-6 w-full sm:w-auto">
          {ctaText}
        </Link>
      </div>

      {/* Right: the pieces, moving along by themselves until the mouse is over them */}
      <div
        className="relative min-w-0 lg:col-span-9"
        onPointerEnter={(e) => e.pointerType !== "touch" && (held.current.mouse = true)}
        onPointerLeave={() => (held.current.mouse = false)}
        onFocus={() => (held.current.focus = true)}
        onBlur={() => (held.current.focus = false)}
        onTouchStart={() => {
          if (release.current) clearTimeout(release.current);
          held.current.touch = true;
        }}
        onTouchEnd={() => {
          // A swipe keeps gliding after the finger lifts: wait for it before moving on.
          if (release.current) clearTimeout(release.current);
          release.current = setTimeout(() => (held.current.touch = false), 2500);
        }}
      >
        {/* The moving row sets its own position every frame, so it does not snap; a short, still row does. */}
        <ul ref={row} data-loop={loop || undefined} className={cn("no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-5 pt-2 lg:mx-0 lg:px-1", !loop && "snap-x snap-mandatory scroll-px-4 lg:scroll-px-0")}>
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
          {loop && items.map((item) => <ItemCard key={`again-${item.id}`} item={item} copy />)}
        </ul>
        {(loop || !edge.start) && (
          <button type="button" onClick={() => step(-1)} aria-label="Earlier offers" className={`${arrow} left-0 lg:-translate-x-1/2`}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        )}
        {(loop || !edge.end) && (
          <button type="button" onClick={() => step(1)} aria-label="More offers" className={`${arrow} right-0 lg:translate-x-1/2`}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
