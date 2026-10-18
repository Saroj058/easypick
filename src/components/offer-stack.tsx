"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion, type PanInfo } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import { useArrowKeys } from "@/lib/arrow-keys";
import type { OfferSummary } from "@/lib/offer-rules";
import { site } from "@/lib/site";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short" });

/** Each offer's card, in turn: ink, a deep festival blue, then graphite. */
const SKINS = [
  "bg-[linear-gradient(160deg,#2a2a2d_0%,#111113_60%,#0a0a0a_100%)]",
  "bg-[linear-gradient(160deg,#1d4f86_0%,#123257_55%,#0c2340_100%)]",
  "bg-[linear-gradient(160deg,#4a4a4f_0%,#2c2c30_60%,#1c1c1f_100%)]",
];

/**
 * The festival offers as a fanned stack of cards (owner's reference, 18 Oct 2026): the one in
 * front large and sharp, the others tucked behind it, turned a little either side. Arrows, a
 * swipe, the arrow keys or a tap on a card behind brings the next one to the front. Under it, when
 * it ends, and one button to shop it.
 */
export function OfferStack({ offers, start, label = "Offers" }: { offers: OfferSummary[]; start?: string; /** The stack's name, e.g. "Festivals". */ label?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <Stack offers={offers} start={start} label={label} />
    </MotionConfig>
  );
}

function Stack({ offers, start, label }: { offers: OfferSummary[]; start?: string; label: string }) {
  const still = useReducedMotion();
  const n = offers.length;
  const [at, setAt] = useState(() => Math.max(0, offers.findIndex((o) => o.offer.id === start)));
  const box = useRef<HTMLDivElement>(null);
  const go = (d: number) => setAt((a) => (a + d + n) % n);
  useArrowKeys(box, go);
  if (!n) return null;
  const front = offers[at];

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
  };

  // Where each card sits by its place behind the front one: 0 in front, then alternating right and left.
  const place = (i: number) => {
    const d = (i - at + n) % n;
    if (d === 0) return { x: 0, rotate: 0, scale: 1, z: 30, opacity: 1 };
    const side = d % 2 === 1 ? 1 : -1;
    const depth = Math.ceil(d / 2);
    // Every offer in one fan (owner, 18 Oct 2026): the further back, the further out and turned.
    return { x: side * (30 + depth * 26), rotate: side * (4 + depth * 3), scale: 1 - depth * 0.05, z: 30 - d, opacity: 1 - depth * 0.1 };
  };

  return (
    <div ref={box} role="region" aria-roledescription="carousel" aria-label={`${label} offers`} className="flex flex-col items-center">
      <p className="sr-only" aria-live="polite">
        {front.offer.name}: {front.count} pieces, up to {front.upTo}% off.
      </p>
      <div className="relative flex w-full items-center justify-center">
        {n > 1 && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous offer" className="absolute left-2 z-40 grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-paper/90 text-ink shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)] ring-1 ring-ink/10 backdrop-blur transition hover:bg-paper sm:left-[calc(50%-330px)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="relative h-[372px] w-[256px] sm:h-[400px] sm:w-[276px]">
          {offers.map(({ offer, count, upTo }, i) => {
            const p = place(i);
            const isFront = i === at;
            return (
              <motion.div
                key={offer.id}
                className={`absolute inset-0 ${isFront ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                style={{ zIndex: p.z }}
                initial={false}
                animate={{ x: p.x, rotate: p.rotate, scale: p.scale, opacity: p.opacity }}
                transition={still ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 28 }}
                drag={isFront && n > 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.5}
                onDragEnd={onDragEnd}
                onClick={() => !isFront && setAt(i)}
                aria-hidden={!isFront}
              >
                <div className={`on-dark relative flex h-full flex-col overflow-hidden rounded-[22px] p-6 text-paper shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] ring-1 ring-white/10 ${SKINS[i % SKINS.length]}`}>
                  {/* A soft sheen across the card */}
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_20%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
                  <span className="relative mx-auto flex items-center gap-2 opacity-80">
                    <Image src="/brand/logo.png" alt="" width={611} height={161} className="h-4 w-auto brightness-0 invert" />
                  </span>
                  <span className="relative my-auto text-center">
                    <span className="display block text-[38px] leading-[0.9]">{offer.name}</span>
                    {offer.note && <span className="mx-auto mt-3 block max-w-[24ch] text-[13px] leading-snug text-paper/65">{offer.note}</span>}
                  </span>
                  <span className="relative flex items-end justify-between text-left">
                    <span>
                      <span className="block text-[10.5px] text-paper/50">Up to</span>
                      <span className="block font-mono text-[15px] font-semibold tabular-nums">{upTo}% off</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[10.5px] text-paper/50">Pieces</span>
                      <span className="block font-mono text-[15px] font-semibold tabular-nums"># {count}</span>
                    </span>
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
        {n > 1 && (
          <button type="button" onClick={() => go(1)} aria-label="Next offer" className="absolute right-2 z-40 grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-paper/90 text-ink shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)] ring-1 ring-ink/10 backdrop-blur transition hover:bg-paper sm:right-[calc(50%-330px)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={front.offer.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="mt-6 text-[13px] text-steel-dark">
          {front.offer.endsOn ? `Ends ${day.format(new Date(`${front.offer.endsOn}T12:00:00+05:45`))}` : "Running now"} · while stock lasts
        </motion.p>
      </AnimatePresence>
      <Link href={`/shop?offer=${front.offer.id}`} className="mt-4 inline-flex h-11 items-center rounded-full bg-paper px-6 text-[14px] font-semibold text-ink shadow-[0_6px_18px_-10px_rgba(0,0,0,0.35)] ring-1 ring-ink/10 transition hover:ring-ink">
        Shop {front.offer.name.toLowerCase().startsWith("under") ? "it" : "the offer"}
      </Link>
      {n > 1 && (
        <div className="mt-5 flex gap-1.5" aria-hidden>
          {offers.map((o, i) => (
            <span key={o.offer.id} className={`h-1.5 rounded-full transition-all duration-300 ${i === at ? "w-6 bg-ink" : "w-1.5 bg-ink/20"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
