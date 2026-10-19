"use client";

import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { OfferSummary } from "@/lib/offer-rules";
import type { Product } from "@/lib/types";
import { OfferStack, SKINS, SPRING } from "./offer-stack";
import { ProductImage } from "./product-image";
import { QuickBuy } from "./quick-buy";

/** An offer's piece, as the opened offer lists it. */
export interface OfferPiece {
  id: string;
  slug: string;
  name: string;
  price: string;
  was: string;
  /** Its own cut, in percent. */
  off: number;
}

/**
 * The festival offers in one place (owner, 19 Oct 2026: "smooth and relaxing, like Apple; buttons
 * that do something"). The stack of offer cards; tapping the front one grows it into the open
 * offer: the card becomes the header, and its pieces rise in a row below, each one tappable and
 * buyable. ×, Esc or tapping the header again folds it back into the same card, on the same spring.
 */
export function OfferExplorer({ offers, pieces, products, start }: { offers: OfferSummary[]; pieces: Record<string, OfferPiece[]>; products: Record<string, Product>; start?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [last, setLast] = useState(start);
  const current = offers.find((o) => o.offer.id === open);
  const index = offers.findIndex((o) => o.offer.id === open);

  // Esc folds it back.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
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
                    setOpen(id);
                  }}
                />
              </motion.div>
            ) : (
              <motion.div key="open" className="mx-auto max-w-[1100px]">
                {/* The card, grown into the header */}
                <motion.div layoutId={`offer-${current.offer.id}`} className={`on-dark relative overflow-hidden rounded-[22px] text-paper shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] ring-1 ring-white/10 ${SKINS[index % SKINS.length]}`}>
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
                    <button type="button" onClick={() => setOpen(null)} aria-label="Close this offer" className="absolute right-3 top-3 grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white/10 text-paper transition hover:bg-white/20 sm:static">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </motion.div>
                </motion.div>

                {/* Its pieces, rising in one after another */}
                <motion.ul
                  aria-label={`${current.offer.name} pieces`}
                  className="no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
                  initial="hidden"
                  animate="shown"
                  exit="gone"
                  variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.04, delayChildren: 0.14 } }, gone: {} }}
                >
                  {(pieces[current.offer.id] ?? []).map((p) => {
                    const product = products[p.id];
                    return (
                      <motion.li
                        key={p.id}
                        variants={{ hidden: { opacity: 0, y: 18, scale: 0.97 }, shown: { opacity: 1, y: 0, scale: 1 }, gone: { opacity: 0, transition: { duration: 0.12 } } }}
                        className="relative w-[44vw] max-w-[200px] shrink-0 snap-start sm:w-[190px]"
                      >
                        <Link href={`/product/${p.slug}`} aria-label={`${p.name}, ${p.price}, was ${p.was}, ${p.off}% off`} className="group block overflow-hidden rounded-[18px] bg-[#f2f2f0] ring-1 ring-ink/5">
                          <span className="relative block overflow-hidden">
                            {product && <ProductImage image={product.images[0] ?? { src: null, alt: p.name, kind: "front" }} category={product.category} colourHex={product.colours[0]?.hex ?? "#888"} decorative sizes="200px" className="transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]" />}
                            <span className="absolute bottom-2.5 left-2.5 rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-paper">{p.off}% off</span>
                          </span>
                          <span className="block bg-paper px-3 py-2.5">
                            <span className="block truncate text-[13px] font-semibold">{p.name}</span>
                            <span className="mt-0.5 flex items-baseline gap-2 font-mono text-[12px] tabular-nums">
                              {p.price} <s className="text-[10.5px] text-steel-dark">{p.was}</s>
                            </span>
                          </span>
                        </Link>
                        {product && <QuickBuy product={product} className="absolute right-2 top-2 z-20" />}
                      </motion.li>
                    );
                  })}
                </motion.ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
