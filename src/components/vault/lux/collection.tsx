"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useMemo, useState, useSyncExternalStore } from "react";

import { ProductImage } from "@/components/product-image";
import type { TileData } from "@/components/vault/vault-tile";
import { PieceCard, PieceRow } from "./piece-card";
import { EASE, EASE_IO, L, two } from "./tokens";

// Section 6, the collection (owner, 25 Oct 2026: luxury revamp). Everything in the Vault, or in one
// brand: pick a size, "still available" and an order, all at once, and the pieces glide to their new
// places. A grid of cards or a quiet text list; on a desktop mouse the list shows the hovered piece's
// photo following the pointer. Sold pieces stay at the end as the archive.

const SORTS = { new: "Newest", low: "Price, low", high: "Price, high" } as const;
type Sort = keyof typeof SORTS;
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
const sizeName = (s: string) => (s === "ONE" ? "One size" : s);

/** True on a desktop with a real mouse: only there does the list's photo follow the pointer. */
const FINE = "(hover: hover) and (pointer: fine) and (min-width: 1024px)";
function onFineChange(cb: () => void) {
  const m = window.matchMedia(FINE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const isFine = () => window.matchMedia(FINE).matches;
const notFine = () => false;

const PREVIEW_W = 220;
const PREVIEW_H = 275;

export function VaultCollection({ tiles, brand }: { tiles: TileData[]; brand?: string }) {
  const still = useReducedMotion();
  const fine = useSyncExternalStore(onFineChange, isFine, notFine);
  const [size, setSize] = useState<string | null>(null);
  const [avail, setAvail] = useState(false);
  const [sort, setSort] = useState<Sort>("new");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [hover, setHover] = useState<string | null>(null);

  // The list's floating photo: the pointer sets where it wants to be, a calm spring (no overshoot) follows.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 160, damping: 26, mass: 0.5 });
  const sy = useSpring(py, { stiffness: 160, damping: 26, mass: 0.5 });

  const sizes = useMemo(() => SIZE_ORDER.filter((s) => tiles.some((t) => t.sizes.some((x) => x.size === s))), [tiles]);
  const shown = useMemo(() => {
    const out = tiles.filter((t) => (!avail || !t.sold) && (!size || t.sizes.some((x) => x.size === size && x.left)));
    const by: Record<Sort, (a: TileData, b: TileData) => number> = { new: (a, b) => a.order - b.order, low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price };
    return out.sort((a, b) => Number(a.sold) - Number(b.sold) || by[sort](a, b));
  }, [tiles, avail, size, sort]);
  const firstSold = shown.findIndex((t) => t.sold);
  const on = Boolean(size || avail || sort !== "new");
  const follow = view === "list" && fine && !still;
  const hovered = follow && hover ? shown.find((t) => t.id === hover) : undefined;

  const reset = () => {
    setSize(null);
    setAvail(false);
    setSort("new");
  };

  // The empty message says what emptied it (the old one always blamed the size).
  const empty =
    tiles.length === 0
      ? "Nothing in the collection yet. Join the list below to hear when the first piece lands."
      : size && avail
        ? `Nothing in ${sizeName(size)} is still available right now.`
        : size
          ? `Nothing left in ${sizeName(size)} right now.`
          : "Every piece here has found its owner. The archive is still here to look through.";

  const pill = (active: boolean) =>
    `inline-flex h-8 shrink-0 items-center rounded-[2px] border px-3 ${L.label} transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df] ${
      active ? "border-[#ede8df] bg-[#ede8df] text-[#0e0d0c]" : `${L.hair} ${L.ivory} hover:border-[#ede8df]/60`
    }`;

  const exit = still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97, transition: { duration: 0.25, ease: EASE_IO } };
  const divider = (
    <p className={`${L.label} ${L.dim} flex items-center gap-4`}>
      <span>[ Sold — the archive ]</span>
      <span aria-hidden className={`h-px flex-1 border-t ${L.hair}`} />
    </p>
  );

  return (
    <section id="inventory" aria-labelledby="vault-collection" className={`scroll-mt-28 ${L.section} ${L.ivory}`}>
      <div className={L.wrap}>
        <p className={`${L.label} ${L.dim}`}>[ 06 — The collection ]</p>
        <h2 id="vault-collection" className={`mt-5 ${L.serif} text-[clamp(2.6rem,1.6rem+4vw,5.6rem)] leading-[0.92]`}>
          {brand ?? "Everything"}
          <span className={`ml-3 inline-block align-top font-mono text-[12px] tracking-[0.14em] tabular-nums ${L.dim}`}>{two(shown.length)}</span>
        </h2>

        {/* The toolbar: one slim hairline band. */}
        <div className={`mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-y ${L.hair} py-4 md:mt-14`}>
          {sizes.length > 0 && (
            <div role="group" aria-label="Size" className="flex flex-wrap items-center gap-1.5">
              <span className={`mr-2 ${L.label} ${L.dim}`}>Size</span>
              {sizes.map((s) => (
                <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(size === s ? null : s)} className={pill(size === s)}>
                  {sizeName(s)}
                </button>
              ))}
            </div>
          )}
          <div role="group" aria-label="Show" className="flex items-center gap-1.5">
            <button type="button" aria-pressed={avail} onClick={() => setAvail(!avail)} className={pill(avail)}>
              Still available
            </button>
          </div>
          <div role="group" aria-label="Order" className="flex flex-wrap items-center gap-1.5">
            <span className={`mr-2 ${L.label} ${L.dim}`}>Order</span>
            {(Object.keys(SORTS) as Sort[]).map((k) => (
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={pill(sort === k)}>
                {SORTS[k]}
              </button>
            ))}
          </div>
          {on && (
            <button type="button" onClick={reset} className={`${L.label} ${L.ivory} underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df]`}>
              Reset
            </button>
          )}
          <div role="group" aria-label="View" className="ml-auto flex items-center gap-1.5">
            <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={pill(view === "grid")}>
              Grid
            </button>
            <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} className={pill(view === "list")}>
              List
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className={`mt-14 max-w-[56ch] text-[16px] leading-[1.5] ${L.dim}`}>
            {empty}
            {on && (
              <>
                {" "}
                <button type="button" onClick={reset} className={`${L.ivory} underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df]`}>
                  Reset
                </button>
              </>
            )}
          </p>
        ) : view === "grid" ? (
          <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:mt-14 md:grid-cols-3 md:gap-x-6 md:gap-y-14 xl:grid-cols-4">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.flatMap((t, i) => {
                const card = (
                  <motion.li
                    key={t.id}
                    layout={!still}
                    initial={still ? false : { opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    exit={exit}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.8, delay: still ? 0 : (i % 4) * 0.08, ease: EASE, layout: { duration: 0.6, ease: EASE_IO } }}
                  >
                    <PieceCard t={t} index={i} sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw" />
                  </motion.li>
                );
                if (i !== firstSold) return [card];
                return [
                  <motion.li key="sold-divider" layout={!still} exit={exit} transition={{ layout: { duration: 0.6, ease: EASE_IO } }} className="col-span-full pt-6 md:pt-10">
                    {divider}
                  </motion.li>,
                  card,
                ];
              })}
            </AnimatePresence>
          </ul>
        ) : (
          <div
            className="relative mt-10 md:mt-14"
            onPointerMove={(e) => {
              if (!follow) return;
              const r = e.currentTarget.getBoundingClientRect();
              px.set(Math.min(e.clientX - r.left + 32, r.width - PREVIEW_W));
              py.set(e.clientY - r.top - PREVIEW_H / 2);
            }}
            onPointerLeave={() => setHover(null)}
          >
            <ul className={`border-t ${L.hair}`}>
              <AnimatePresence initial={false} mode="popLayout">
                {shown.flatMap((t, i) => {
                  const row = (
                    <motion.li
                      key={t.id}
                      layout={!still}
                      initial={still ? false : { opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      exit={exit}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ duration: 0.7, delay: still ? 0 : (i % 6) * 0.06, ease: EASE, layout: { duration: 0.5, ease: EASE_IO } }}
                      onPointerEnter={() => setHover(t.id)}
                    >
                      <PieceRow t={t} index={i} />
                    </motion.li>
                  );
                  if (i !== firstSold) return [row];
                  return [
                    <motion.li key="sold-divider" layout={!still} exit={exit} transition={{ layout: { duration: 0.5, ease: EASE_IO } }} className="pb-4 pt-12" onPointerEnter={() => setHover(null)}>
                      {divider}
                    </motion.li>,
                    row,
                  ];
                })}
              </AnimatePresence>
            </ul>

            {/* The hovered piece's photo, trailing the pointer (desktop mouse only; just a picture, the row says it all). */}
            {follow && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 z-10 overflow-hidden rounded-[2px]"
                style={{ x: sx, y: sy, width: PREVIEW_W }}
                initial={false}
                animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.96 }}
                transition={{ duration: 0.35, ease: EASE_IO }}
              >
                <AnimatePresence initial={false}>
                  {hovered && (
                    <motion.div key={hovered.id} className="absolute inset-0 first:relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE_IO }}>
                      <ProductImage image={hovered.image} category={hovered.category} colourHex={hovered.hex} decorative ground="bg-[var(--lx-raised)]" sizes={`${PREVIEW_W}px`} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
