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
// a row on the right. The row moves along by itself, one card every few seconds, and goes back to
// the start at the end. It stops while it is being pointed at, touched or focused, when it is off
// screen, and for people who have turned motion off.

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
  /** Seconds between moves; 0 turns the auto-rotation off. */
  every?: number;
  className?: string;
}

function ItemCard({ item }: { item: OfferItem }) {
  return (
    <motion.li className="group w-[62%] max-w-[240px] shrink-0 snap-start sm:w-56" whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
      <Link href={item.href} className="block">
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

export function OffersCarousel({ eyebrow, title, subtitle, ctaText, ctaHref, items, every = 3.5, className }: OffersCarouselProps) {
  const row = React.useRef<HTMLUListElement>(null);
  const [edge, setEdge] = React.useState({ start: true, end: false });
  /** Reasons the row is holding still right now. */
  const held = React.useRef({ pointer: false, focus: false, hidden: true });

  // Which arrows have somewhere to go.
  React.useEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () => setEdge({ start: el.scrollLeft < 10, end: el.scrollWidth - el.scrollLeft - el.clientWidth < 10 });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [items.length]);

  /** One card along; at the end, back to the first. */
  const step = React.useCallback((dir: 1 | -1, wrap = false) => {
    const el = row.current;
    if (!el) return;
    const card = el.querySelector("li");
    const pitch = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    const atEnd = el.scrollWidth - el.scrollLeft - el.clientWidth < 10;
    if (wrap && dir === 1 && atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
    else el.scrollBy({ left: dir * pitch, behavior: "smooth" });
  }, []);

  // The auto-rotation.
  React.useEffect(() => {
    const el = row.current;
    if (!el || !every || items.length < 2) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hold = held.current;
    const seen = new IntersectionObserver(([entry]) => (hold.hidden = !entry.isIntersecting), { threshold: 0.4 });
    seen.observe(el);
    const timer = setInterval(() => {
      if (hold.pointer || hold.focus || hold.hidden || document.hidden) return;
      if (el.scrollWidth <= el.clientWidth + 10) return; // everything already fits
      step(1, true);
    }, every * 1000);
    return () => {
      clearInterval(timer);
      seen.disconnect();
    };
  }, [every, items.length, step]);

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

      {/* Right: the pieces, moving along by themselves */}
      <div
        className="relative min-w-0 lg:col-span-9"
        onPointerEnter={() => (held.current.pointer = true)}
        onPointerLeave={() => (held.current.pointer = false)}
        onFocus={() => (held.current.focus = true)}
        onBlur={() => (held.current.focus = false)}
      >
        <ul ref={row} className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-5 pt-2 lg:mx-0 lg:scroll-px-0 lg:px-1">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </ul>
        {!edge.start && (
          <button type="button" onClick={() => step(-1)} aria-label="Earlier offers" className={`${arrow} left-0 lg:-translate-x-1/2`}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        )}
        {!edge.end && (
          <button type="button" onClick={() => step(1)} aria-label="More offers" className={`${arrow} right-0 lg:translate-x-1/2`}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
