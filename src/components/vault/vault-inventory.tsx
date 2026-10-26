"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";

import { priceStep, two, V } from "./look";
import { VaultTile, type TileData } from "./vault-tile";

const SORTS = { new: "Newest", low: "Price, low", high: "Price, high" } as const;
type Sort = keyof typeof SORTS;
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

/** What a link can open the inventory on: /vault?left=1, ?under=5000 or ?last=1 (the cards at the top). */
export interface InventoryStart {
  avail?: boolean;
  under?: number;
  last?: boolean;
}

/**
 * Everything in the Vault, or in one brand. Practical first (owner, 26 Oct 2026: "practical"): the
 * filters sit in plain view in one row (sizes, still available, under a price, last ones, and the
 * order), and a link can open it already filtered. The tiles slide into their new places; sold
 * pieces stay at the end as the archive.
 */
export function VaultInventory({ tiles, brand, start = {} }: { tiles: TileData[]; brand?: string; start?: InventoryStart }) {
  const still = useReducedMotion();
  const [size, setSize] = useState<string | null>(null);
  const [avail, setAvail] = useState(Boolean(start.avail));
  const [under, setUnder] = useState<number | null>(start.under ?? null);
  const [last, setLast] = useState(Boolean(start.last));
  const [sort, setSort] = useState<Sort>("new");

  const sizes = useMemo(() => SIZE_ORDER.filter((s) => tiles.some((t) => t.sizes.some((x) => x.size === s))), [tiles]);
  // A price step that means something here: the round thousand nearest the middle price.
  const cap = useMemo(() => priceStep(tiles.filter((t) => !t.sold).map((t) => t.price)), [tiles]);
  const anyLast = tiles.some((t) => t.last);
  const shown = useMemo(() => {
    const out = tiles.filter((t) => (!avail || !t.sold) && (!size || t.sizes.some((x) => x.size === size && x.left)) && (!under || (!t.sold && t.price <= under)) && (!last || Boolean(t.last)));
    const by: Record<Sort, (a: TileData, b: TileData) => number> = { new: (a, b) => a.order - b.order, low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price };
    return out.sort((a, b) => Number(a.sold) - Number(b.sold) || by[sort](a, b));
  }, [tiles, avail, size, under, last, sort]);
  const on = Boolean(size || avail || under || last || sort !== "new");
  const reset = () => {
    setSize(null);
    setAvail(false);
    setUnder(null);
    setLast(false);
    setSort("new");
  };
  // What emptied the list, said plainly.
  const why = [size && `in ${size === "ONE" ? "one size" : size}`, under && `under ${new Intl.NumberFormat("en-IN").format(under)}`, last && "down to the last one"].filter(Boolean).join(", ");

  const pill = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 ${V.mono} transition-colors ${active ? "border-white bg-white text-[var(--v-ink)]" : "border-white/30 text-white hover:border-white"}`;

  return (
    <section aria-labelledby="vault-inv" className="pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="vault-inv" className="display text-[clamp(2rem,1.4rem+2.4vw,3.4rem)] leading-[0.9] text-white">
          {brand ? `All of ${brand}` : "Every piece"}
          <span className={`ml-2 inline-block align-top ${V.mono} ${V.iceDim}`}>{two(shown.length)}</span>
        </h2>
        {on && (
          <button type="button" onClick={reset} className={`min-h-11 ${V.mono} text-white underline underline-offset-4`}>
            Clear all
          </button>
        )}
      </div>

      {/* The filters, in plain view: one row that swipes on a phone */}
      <div className="no-scrollbar -mx-4 mt-5 flex items-center gap-1.5 overflow-x-auto border-y border-white/15 px-4 py-3 md:mx-0 md:flex-wrap md:px-0">
        {sizes.length > 1 && (
          <div role="group" aria-label="Size" className="flex shrink-0 gap-1.5">
            {sizes.map((s) => (
              <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(size === s ? null : s)} className={pill(size === s)}>
                {s === "ONE" ? "One size" : s}
              </button>
            ))}
          </div>
        )}
        <span aria-hidden className="mx-1.5 h-6 w-px shrink-0 bg-white/20" />
        <div role="group" aria-label="Show" className="flex shrink-0 gap-1.5">
          <button type="button" aria-pressed={avail} onClick={() => setAvail(!avail)} className={pill(avail)}>
            Still available
          </button>
          {cap && (
            <button type="button" aria-pressed={under === cap} onClick={() => setUnder(under === cap ? null : cap)} className={pill(under === cap)}>
              Under Rs {new Intl.NumberFormat("en-IN").format(cap)}
            </button>
          )}
          {anyLast && (
            <button type="button" aria-pressed={last} onClick={() => setLast(!last)} className={pill(last)}>
              Last ones
            </button>
          )}
        </div>
        <span aria-hidden className="mx-1.5 h-6 w-px shrink-0 bg-white/20" />
        <div role="group" aria-label="Order" className="flex shrink-0 gap-1.5">
          {(Object.keys(SORTS) as Sort[]).map((k) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={pill(sort === k)}>
              {SORTS[k]}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className={`mt-12 text-[15px] ${V.iceDim}`}>
          Nothing {why || "here"} right now.{" "}
          <button type="button" onClick={reset} className="text-white underline underline-offset-4">
            Show everything
          </button>
        </p>
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
