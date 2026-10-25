"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";

import { two, V } from "./look";
import { VaultTile, type TileData } from "./vault-tile";

const SORTS = { new: "Newest", low: "Price, low", high: "Price, high" } as const;
type Sort = keyof typeof SORTS;
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

/**
 * Everything in the Vault, or in one brand (after the reference's "inventory"; the brands are picked
 * at the top of the page): a size, "still available" and an order, all at once, with the
 * tiles sliding into their new places. Sold pieces stay at the end as the archive.
 */
export function VaultInventory({ tiles, brand }: { tiles: TileData[]; brand?: string }) {
  const still = useReducedMotion();
  const [size, setSize] = useState<string | null>(null);
  const [avail, setAvail] = useState(false);
  const [sort, setSort] = useState<Sort>("new");
  const [open, setOpen] = useState(false);

  const sizes = useMemo(() => SIZE_ORDER.filter((s) => tiles.some((t) => t.sizes.some((x) => x.size === s))), [tiles]);
  const shown = useMemo(() => {
    const out = tiles.filter((t) => (!avail || !t.sold) && (!size || t.sizes.some((x) => x.size === size && x.left)));
    const by: Record<Sort, (a: TileData, b: TileData) => number> = { new: (a, b) => a.order - b.order, low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price };
    return out.sort((a, b) => Number(a.sold) - Number(b.sold) || by[sort](a, b));
  }, [tiles, avail, size, sort]);
  const on = Boolean(size || avail || sort !== "new");

  const pill = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 ${V.mono} transition-colors ${active ? "border-white bg-white text-[var(--v-ink)]" : "border-white/30 text-white hover:border-white"}`;

  return (
    <section aria-labelledby="vault-inv" className="pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="vault-inv" className="display text-[clamp(2rem,1.4rem+2.4vw,3.4rem)] leading-[0.9] text-white">
          {brand ? `All of ${brand}` : "Every piece"}
          <span className={`ml-2 inline-block align-top ${V.mono} ${V.iceDim}`}>{two(shown.length)}</span>
        </h2>
        <button type="button" aria-expanded={open} aria-controls="vault-filters" onClick={() => setOpen(!open)} className={pill(open || on)}>
          Filters{on ? " · on" : ""}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="vault-filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4 border-t border-white/15 pt-4">
              {sizes.length > 0 && (
                <div role="group" aria-label="Size">
                  <p className={`mb-2 ${V.mono} ${V.iceDim}`}>[Size]</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sizes.map((s) => (
                      <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(size === s ? null : s)} className={pill(size === s)}>
                        {s === "ONE" ? "One size" : s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div role="group" aria-label="Show">
                <p className={`mb-2 ${V.mono} ${V.iceDim}`}>[Show]</p>
                <button type="button" aria-pressed={avail} onClick={() => setAvail(!avail)} className={pill(avail)}>
                  Still available
                </button>
              </div>
              <div role="group" aria-label="Order">
                <p className={`mb-2 ${V.mono} ${V.iceDim}`}>[Order]</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(SORTS) as Sort[]).map((k) => (
                    <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={pill(sort === k)}>
                      {SORTS[k]}
                    </button>
                  ))}
                </div>
              </div>
              {on && (
                <button
                  type="button"
                  onClick={() => {
                    setSize(null);
                    setAvail(false);
                    setSort("new");
                  }}
                  className={`h-10 ${V.mono} text-white underline underline-offset-4`}
                >
                  Reset
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {shown.length === 0 ? (
        <p className={`mt-12 text-[15px] ${V.iceDim}`}>Nothing in that size right now. Join the list below to hear when the next piece lands.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-5 lg:grid-cols-5">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((t, i) => (
              <motion.li
                key={t.id}
                layout={!still}
                initial={still ? false : { opacity: 0, y: 24 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                animate={still ? { opacity: 1 } : undefined}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.9, delay: (i % 5) * 0.07, ease: [0.16, 1, 0.3, 1] }}
              >
                <VaultTile t={t} sizes="(min-width: 1024px) 18vw, (min-width: 768px) 30vw, 45vw" priority={i < 2} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
