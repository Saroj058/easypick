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
                <motion.div layoutId={`offer-${current.offer.id}`} className={`on-dark relative mx-auto max-w-[720px] overflow-hidden rounded-[14px] text-paper shadow-[0_16px_32px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/10 ${SKINS[index % SKINS.length]}`}>
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_20%_0%,rgba(255,255,255,0.12),transparent_60%)]" />
                  <motion.div layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.22, duration: 0.3 } }} exit={{ opacity: 0, transition: { duration: 0.08 } }} className="relative flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-paper/60">
                        Up to {current.upTo}% off · {current.count} pieces
                      </p>
                      <h3 className="display mt-0.5 truncate text-[clamp(1.25rem,1.1rem+0.6vw,1.6rem)] leading-none">{current.offer.name}</h3>
                    </div>
                    <Link href={`/shop?offer=${current.offer.id}`} className="inline-flex h-9 shrink-0 items-center rounded-full bg-paper px-4 text-[13px] font-semibold text-ink transition hover:bg-white">
                      Shop all
                    </Link>
                    <button type="button" onClick={() => setClosing(true)} aria-label="Close this offer" className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-white/10 text-paper transition hover:bg-white/20">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
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
