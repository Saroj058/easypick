"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { OfferSummary } from "@/lib/offer-rules";
import { OfferStack } from "./offer-stack";
import { OfferWheel, type WheelItem } from "./offer-wheel";

/**
 * The festival offers in one place (owner, 18 Oct 2026): the stack of offer cards; tapping the
 * front one opens it, its products springing out of it onto a turning wheel. The ×, Esc or
 * "Back to offers" folds them back into the card and the stack returns. However many offers the
 * owner has set in the admin, one or twenty.
 */
export function OfferExplorer({ offers, products, start }: { offers: OfferSummary[]; products: Record<string, WheelItem[]>; start?: string }) {
  const still = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [last, setLast] = useState(start);
  const current = offers.find((o) => o.offer.id === open);

  // Esc closes the wheel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setClosing(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!offers.length) return null;

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        {!current ? (
          <motion.div key="stack" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: -16, filter: "blur(4px)" }} transition={{ duration: still ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <OfferStack
              key={last ?? "first"}
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
          <motion.div key={`wheel-${current.offer.id}`} initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} className="relative">
            {/* The opened card: it rises, lifts its lid and fades as the pieces come out of it */}
            {!still && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[40px] z-[150] h-[300px] w-[210px] -translate-x-1/2 [perspective:900px] sm:top-[20px] sm:h-[380px] sm:w-[264px]"
                initial={{ opacity: 1, y: 20, scale: 1 }}
                animate={{ opacity: [1, 1, 0], y: [20, -10, -30], scale: [1, 1.04, 0.8] }}
                transition={{ duration: 0.75, times: [0, 0.35, 1], ease: "easeOut" }}
              >
                <motion.div
                  className="on-dark flex h-full origin-top flex-col justify-center rounded-[22px] bg-[linear-gradient(160deg,#2a2a2d_0%,#111113_60%,#0a0a0a_100%)] p-6 text-center text-paper shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)]"
                  initial={{ rotateX: 0 }}
                  animate={{ rotateX: [0, 0, -70] }}
                  transition={{ duration: 0.75, times: [0, 0.3, 1], ease: "easeIn" }}
                >
                  <span className="display text-[38px] leading-[0.9]">{current.offer.name}</span>
                  <span className="mt-3 font-mono text-[12px] uppercase tracking-[0.14em] text-paper/60">Up to {current.upTo}% off</span>
                </motion.div>
              </motion.div>
            )}
            <OfferWheel
              items={products[current.offer.id] ?? []}
              closing={closing}
              onClosed={() => {
                setOpen(null);
                setClosing(false);
              }}
            >
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: closing ? 0 : 1, y: closing ? 10 : 0 }} transition={{ delay: closing ? 0 : 0.45, duration: 0.35 }} className="flex flex-col items-center gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">Up to {current.upTo}% off · {current.count} pieces</p>
                <h3 className="text-[clamp(1.9rem,1.4rem+1.8vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.02em]">{current.offer.name}.</h3>
                <div className="flex items-center gap-3">
                  <Link href={`/shop?offer=${current.offer.id}`} className="inline-flex h-11 items-center rounded-full bg-ink px-6 text-[14px] font-semibold text-paper transition hover:bg-graphite">
                    See all {current.count} pieces
                  </Link>
                  <button type="button" onClick={() => setClosing(true)} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-paper px-5 text-[14px] font-semibold text-ink ring-1 ring-ink/15 transition hover:ring-ink">
                    <span aria-hidden>×</span> Back to offers
                  </button>
                </div>
              </motion.div>
            </OfferWheel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
