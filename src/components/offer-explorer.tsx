"use client";

import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { OfferSummary } from "@/lib/offer-rules";
import { OfferStack, SKINS, SPRING } from "./offer-stack";
import { OfferWheel, type WheelItem } from "./offer-wheel";

/**
 * The festival offers in one place (owner, 19 Oct 2026: "smooth and relaxing, like Apple; buttons
 * that do something"). The stack of offer cards; tapping the front one grows it into the open
 * offer: the card becomes the header, and its pieces spring out below onto the turning wheel (the
 * owner's pick). × or Esc folds the pieces back, then the header shrinks into the same card.
 */
export function OfferExplorer({ offers, products, start }: { offers: OfferSummary[]; products: Record<string, WheelItem[]>; start?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  /** Closing: the wheel folds its pieces back first, then the header shrinks into the card. */
  const [closing, setClosing] = useState(false);
  const [last, setLast] = useState(start);
  const current = offers.find((o) => o.offer.id === open);
  const index = offers.findIndex((o) => o.offer.id === open);

  // Esc folds it back.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setClosing(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!offers.length) return null;

  return (
    <MotionConfig reducedMotion="user" transition={SPRING}>
      <LayoutGroup>
        {/* The same height open or closed, so the page never jumps. */}
        <div className="relative min-h-[520px] sm:min-h-[548px]">
          <AnimatePresence initial={false} mode="popLayout">
            {!current ? (
              <motion.div key="stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }}>
                <OfferStack
                  offers={offers}
                  start={last}
                  label="Festival"
                  onOpen={(id) => {
                    setLast(id);
                    setClosing(false);
                    setOpen(id);
                  }}
                />
              </motion.div>
            ) : (
              <motion.div key="open" className="mx-auto">
                {/* The card, grown into the header */}
                <motion.div layoutId={`offer-${current.offer.id}`} className={`on-dark relative mx-auto max-w-[1100px] overflow-hidden rounded-[22px] text-paper shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] ring-1 ring-white/10 ${SKINS[index % SKINS.length]}`}>
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_20%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
                  <motion.div layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.22, duration: 0.3 } }} exit={{ opacity: 0, transition: { duration: 0.08 } }} className="relative flex flex-wrap items-center gap-x-6 gap-y-3 p-5 sm:p-6">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper/60">
                        Up to {current.upTo}% off · {current.count} pieces
                      </p>
                      <h3 className="display mt-1 text-[clamp(2rem,1.5rem+2vw,3rem)] leading-[0.9]">{current.offer.name}</h3>
                      {current.offer.note && <p className="mt-1.5 text-[13.5px] text-paper/65">{current.offer.note}</p>}
                    </div>
                    <Link href={`/shop?offer=${current.offer.id}`} className="inline-flex h-11 items-center rounded-full bg-paper px-5 text-[14px] font-semibold text-ink transition hover:bg-white">
                      Shop all {current.count} pieces
                    </Link>
                    <button type="button" onClick={() => setClosing(true)} aria-label="Close this offer" className="absolute right-3 top-3 grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white/10 text-paper transition hover:bg-white/20 sm:static">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </motion.div>
                </motion.div>

                {/* Its pieces, springing out onto the turning wheel */}
                <OfferWheel
                  items={products[current.offer.id] ?? []}
                  closing={closing}
                  onClosed={() => {
                    setOpen(null);
                    setClosing(false);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
