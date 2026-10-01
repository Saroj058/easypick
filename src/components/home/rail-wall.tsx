"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { addedMessage, showBagToast, useAddToBag } from "@/components/bag-gate";
import { HeartIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { toggleSaved, useList } from "@/components/saved";
import { FlowButton } from "@/components/ui/flow-button";
import { formatPrice } from "@/lib/format";
import { MY_SIZES, setMySize, useMySize } from "@/lib/my-size";
import type { Category, ProductImage as Img, Size } from "@/lib/types";

// The rail, laid out like the shop wall: a hanging sign with the controls, then sections in
// the order an outfit goes on (tops, layers, bottoms, finish), three or four pieces to a
// section, each hanging from its own rail. Every piece can be bought where it hangs: the
// size picked once on the sign is already chosen on each card, so adding it is one tap.

export interface RailColour {
  name: string;
  hex: string;
  /** Sizes in this colour, in order, with what can be bought online. */
  sizes: { size: Size; sku: string; left: number }[];
}

export interface RailPiece {
  id: string;
  slug: string;
  name: string;
  category: Category;
  price: number;
  /** The full price, when on sale. */
  was?: number;
  image: Img;
  /** Colours that can be bought online (all of them when none can). */
  colours: RailColour[];
}

export interface RailSection {
  key: string;
  /** "Tees + Hoodies" */
  label: string;
  /** "Start on top" */
  caption: string;
  /** The shop, opened on this section's kind. */
  href: string;
  /** Pieces in the section, including any not shown here. */
  total: number;
  pieces: RailPiece[];
}

type Sort = "new" | "price";
interface View {
  budget: number | null;
  sort: Sort;
}

const VIEW_KEY = "ep-rail-v2";
const VIEW_EVENT = "ep-rail-view";
let cachedRaw: string | null = null;
let cachedView: View | null = null;

/** This visit's budget and sort, so coming back from a product page finds the rail as it was. */
function readView(): View | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(VIEW_KEY);
  } catch {
    // storage blocked
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedView = raw ? (JSON.parse(raw) as View) : null;
    } catch {
      cachedView = null;
    }
  }
  return cachedView;
}

function writeView(view: View) {
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(view));
  } catch {
    cachedRaw = JSON.stringify(view); // storage blocked: holds until the page is left
    cachedView = view;
  }
  window.dispatchEvent(new Event(VIEW_EVENT));
}

function subscribeView(fn: () => void) {
  window.addEventListener(VIEW_EVENT, fn);
  return () => window.removeEventListener(VIEW_EVENT, fn);
}

const mono = "font-mono text-[10px] uppercase leading-none tracking-[0.16em]";
const box = "flex h-11 items-center justify-center border text-[13px] font-semibold";
const cell = `${box} -ml-px font-mono first:ml-0`;

const Arrow = ({ className = "" }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** The hook a piece hangs from, over the section's rail. */
const Hook = () => (
  <svg width="14" height="20" viewBox="0 0 14 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden className="absolute left-1/2 top-[-9px] z-10 -translate-x-1/2">
    <path d="M7 20V10a3.5 3.5 0 1 0-3.5-3.5" />
  </svg>
);

function Piece({ piece, mySize, priority }: { piece: RailPiece; mySize: string | null; priority: boolean }) {
  const addToBag = useAddToBag();
  const saved = useList("saved").includes(piece.slug);
  const [colourName, setColourName] = useState<string | null>(null);
  const [picked, setPicked] = useState<Size | null>(null);
  const [added, setAdded] = useState<string | null>(null); // the sku just added

  const colour = piece.colours.find((c) => c.name === colourName) ?? piece.colours[0];
  const can = (s: string | null) => Boolean(s && colour.sizes.some((x) => x.size === s && x.left > 0));
  const oneSize = colour.sizes.length === 1 && colour.sizes[0].size === "ONE";
  const anyLeft = colour.sizes.some((x) => x.left > 0);
  // A size tapped here wins; else the size from the sign; else nothing is chosen for them.
  const size = oneSize ? (can("ONE") ? "ONE" : null) : can(picked) ? picked : can(mySize) ? (mySize as Size) : null;
  const variant = colour.sizes.find((x) => x.size === size) ?? null;
  const missing = !oneSize && anyLeft && mySize && !can(mySize) && !can(picked); // their size is gone in this colour
  const few = colour.sizes.filter((x) => x.left > 0 && x.left <= 3).map((x) => x.size);
  const note = !anyLeft ? "In store only" : missing ? `No ${mySize} left` : few.length && !oneSize ? `Few left in ${few.join(", ")}` : oneSize ? "One size" : "";

  function add() {
    if (!variant || !size) return;
    const line = { slug: piece.slug, sku: variant.sku, name: piece.name, size, colour: colour.name, price: piece.price };
    if (addToBag([line])) {
      setAdded(variant.sku);
      showBagToast(addedMessage(line));
    }
  }

  return (
    <div className="relative">
      <Hook />
      <div className="relative">
        <Link href={`/product/${piece.slug}`} className="block" aria-label={piece.name}>
          <ProductImage image={piece.image} category={piece.category} colourHex={colour.hex} decorative priority={priority} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 62vw" />
        </Link>
        <button
          type="button"
          onClick={() => {
            toggleSaved(piece.slug);
            showBagToast(saved ? `Removed ${piece.name} from Saved.` : `Saved ${piece.name}. Find it under Saved.`);
          }}
          aria-pressed={saved}
          aria-label={`Save ${piece.name}`}
          className="absolute bottom-1 left-1 grid h-11 w-11 place-items-center"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-paper/85 ring-1 ring-ink/10">
            <HeartIcon filled={saved} className={`h-4 w-4 ${saved ? "text-[#d70015]" : ""}`} />
          </span>
        </button>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-[15px] font-semibold leading-5">
          <Link href={`/product/${piece.slug}`} className="line-clamp-1 decoration-1 underline-offset-4 hover:underline">
            {piece.name}
          </Link>
        </h3>
        <p className="shrink-0 font-mono text-[14px] tabular-nums">
          {piece.was && (
            <s className="mr-1.5 text-steel-dark">
              <span className="sr-only">was </span>
              {piece.was.toLocaleString("en-IN")}
            </s>
          )}
          {formatPrice(piece.price)}
        </p>
      </div>

      {/* Colour: the name, and dots to switch when there is more than one. */}
      <div className="mt-1 flex min-h-6 items-center gap-2 text-[13px] text-steel-dark">
        {piece.colours.length > 1 && (
          <span role="radiogroup" aria-label={`Colour of ${piece.name}`} className="-my-2.5 -ml-2.5 flex">
            {piece.colours.map((c) => (
              <button
                key={c.name}
                type="button"
                role="radio"
                aria-checked={c.name === colour.name}
                aria-label={c.name}
                onClick={() => {
                  setColourName(c.name);
                  setAdded(null);
                }}
                className="grid h-11 w-8 place-items-center first:w-9 first:pl-1"
              >
                <span className={`h-4 w-4 rounded-full border border-black/20 ${c.name === colour.name ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c.hex }} />
              </button>
            ))}
          </span>
        )}
        <span className="truncate">
          {colour.name}
          {note && <span className={missing ? "font-semibold text-ink" : ""}> · {note}</span>}
        </span>
      </div>

      {/* Size, then the one button. Sold-out sizes can't be picked. */}
      {!oneSize && (
        <div role="radiogroup" aria-label={`Size of ${piece.name}`} className="mt-2.5 flex">
          {colour.sizes.map((s) => {
            const out = s.left <= 0;
            const on = s.size === size;
            return (
              <button
                key={s.size}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${s.size}${out ? ", sold out" : ""}`}
                disabled={out}
                onClick={() => {
                  setPicked(s.size);
                  setAdded(null);
                }}
                className={`${cell} min-w-0 flex-1 ${on ? "z-10 border-ink bg-ink text-paper" : out ? "border-mist bg-photo text-[#8e8e93] line-through" : "border-mist bg-paper hover:z-10 hover:border-ink"}`}
              >
                {s.size}
              </button>
            );
          })}
        </div>
      )}
      {variant && added === variant.sku ? (
        <Link href="/bag" className="btn btn-outline mt-2 h-12 min-h-0 w-full px-3 text-[13px]">
          In your bag · View <Arrow />
        </Link>
      ) : (
        <button type="button" onClick={add} disabled={!variant} className="btn btn-ink mt-2 h-12 min-h-0 w-full px-3 text-[13px] disabled:border disabled:border-mist disabled:bg-paper disabled:text-steel-dark disabled:opacity-100">
          {variant ? (oneSize ? "Add to bag" : `Add ${size} to bag`) : !anyLeft ? "In store only" : "Pick a size"}
        </button>
      )}
    </div>
  );
}

export function RailWall({ sections, budgets, pieces: total }: { sections: RailSection[]; budgets: number[]; pieces: number }) {
  const mySize = useMySize();
  const stored = useSyncExternalStore(subscribeView, readView, () => null);
  const budget = stored?.budget && budgets.includes(stored.budget) ? stored.budget : null;
  const sort: Sort = stored?.sort === "price" ? "price" : "new";

  // What each section shows under the budget, in the chosen order.
  const wall = sections
    .map((s) => {
      const fit = s.pieces.filter((p) => !budget || p.price < budget);
      return { ...s, show: sort === "price" ? [...fit].sort((a, b) => a.price - b.price) : fit };
    })
    .filter((s) => s.show.length > 0);
  const showing = wall.reduce((n, s) => n + s.show.length, 0);
  const withSize = (href: string) => (mySize ? `${href}${href.includes("?") ? "&" : "?"}size=${mySize}` : href);
  const range = (list: RailPiece[]) => {
    const prices = list.map((p) => p.price);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    return lo === hi ? formatPrice(lo) : `${formatPrice(lo)} to ${hi.toLocaleString("en-IN")}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
          <h2 id="rail-title" className="display text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[0.92]">
            The rail
          </h2>
          <p className="pb-1 text-[14px] text-steel-dark">Laid out like the shop wall, top to bottom.</p>
        </div>
        <FlowButton href={withSize("/shop")} text="Shop all" className="hidden sm:inline-flex" />
      </div>

      {/* The sign: it hangs from a line, and holds every control. */}
      <div className="relative mt-4">
        <div aria-hidden className="h-px bg-ink" />
        <span aria-hidden className="absolute left-8 top-0 h-3 w-px bg-ink" />
        <span aria-hidden className="absolute right-8 top-0 h-3 w-px bg-ink" />
        <div className="on-dark mt-3 flex flex-col gap-3 bg-ink p-3 text-paper md:p-4 xl:flex-row xl:items-end xl:justify-between xl:gap-6">
          <nav aria-label="Sections of the rail" className="min-w-0">
            <p className={`${mono} mb-1.5 text-paper/70`}>Walk the wall</p>
            <ul className="no-scrollbar -mx-3 flex overflow-x-auto px-3 md:mx-0 md:px-0">
              {wall.map((s, i) => (
                <li key={s.key} className={`relative shrink-0 hover:z-10 ${i === 0 ? "" : "-ml-px"}`}>
                  <a href={`#rail-${s.key}`} className={`${box} gap-2 whitespace-nowrap border-paper/30 px-3 hover:border-paper`}>
                    <span className="font-mono text-[11px] font-normal text-paper/70">{String(i + 1).padStart(2, "0")}</span>
                    {s.label}
                    <span className="font-mono text-[11px] font-normal text-paper/70">{s.show.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div role="group" aria-label="My size">
              <p className={`${mono} mb-1.5 text-paper/70`}>My size{mySize ? " · saved" : ""}</p>
              <div className="flex">
                {MY_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={mySize === s}
                    onClick={() => setMySize(mySize === s ? null : s)}
                    className={`${cell} w-11 ${mySize === s ? "z-10 border-volt bg-volt text-ink" : "border-paper/30 hover:z-10 hover:border-paper"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {budgets.length > 0 && (
              <div role="group" aria-label="Budget">
                <p className={`${mono} mb-1.5 text-paper/70`}>Under Rs</p>
                <div className="flex">
                  {budgets.map((b) => (
                    <button
                      key={b}
                      type="button"
                      aria-pressed={budget === b}
                      aria-label={`Under Rs ${b.toLocaleString("en-IN")}`}
                      onClick={() => writeView({ sort, budget: budget === b ? null : b })}
                      className={`${cell} min-w-11 px-2.5 ${budget === b ? "z-10 border-paper bg-paper text-ink" : "border-paper/30 hover:z-10 hover:border-paper"}`}
                    >
                      {b.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              aria-label={sort === "price" ? "Sorted by price, low to high. Switch to newest first" : "Sorted newest first. Switch to price, low to high"}
              onClick={() => writeView({ budget, sort: sort === "price" ? "new" : "price" })}
              className={`${box} gap-1.5 border-paper/30 px-3 hover:border-paper`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M7 4v16M7 20l-4-4M17 20V4M17 4l4 4" />
              </svg>
              {sort === "price" ? "Price" : "Newest"}
            </button>
          </div>
        </div>
      </div>

      <p role="status" className="mt-2 flex min-h-11 items-center gap-3 font-mono text-[10px] uppercase leading-[1.6] tracking-[0.16em] text-steel-dark">
        {budget ? (
          <>
            <span>
              <span className="text-ink">{showing}</span> of {total} under Rs {budget.toLocaleString("en-IN")}
            </span>
            <button type="button" onClick={() => writeView({ sort, budget: null })} className="h-11 px-1 font-sans text-[13px] font-semibold normal-case tracking-normal text-ink underline underline-offset-4">
              Clear
            </button>
          </>
        ) : mySize ? (
          <span>
            {total} pieces · size {mySize} is already picked on each
          </span>
        ) : (
          <span>{total} pieces · pick your size once on the sign</span>
        )}
      </p>

      {wall.map((s, i) => {
        const shown = s.show.slice(0, 4);
        const allHref = withSize(s.href);
        return (
          <section key={s.key} id={`rail-${s.key}`} aria-labelledby={`rail-${s.key}-title`} className={`scroll-mt-24 ${i === 0 ? "pt-1" : "pt-8 md:pt-10"}`}>
            {/* The shelf label: section number, what hangs here, how many and for how much. */}
            <div className="flex min-h-11 items-center gap-3 border-t-2 border-ink bg-photo px-3 py-1.5">
              <span className="grid h-5 min-w-6 place-items-center bg-ink px-1 font-mono text-[11px] font-semibold text-paper">{String(i + 1).padStart(2, "0")}</span>
              <h3 id={`rail-${s.key}-title`} className="font-display text-[20px] uppercase leading-none tracking-[0.02em] md:text-[22px]">
                {s.label}
              </h3>
              <span className={`${mono} hidden text-steel-dark sm:block`}>{s.caption}</span>
              <span className="ml-auto shrink-0 text-right font-mono text-[11px] uppercase tracking-[0.12em] text-steel-dark">
                {s.show.length} {s.show.length === 1 ? "piece" : "pieces"}
                <span className="hidden sm:inline"> · </span>
                <br className="sm:hidden" />
                <span className="text-ink">{range(s.show)}</span>
              </span>
            </div>

            {/* The section's rail, with the pieces hanging from it. Phones swipe along it. */}
            <div className="mt-5 border-t-2 border-ink">
              <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4">
                {shown.map((p, n) => (
                  <li key={p.id} className="w-[62%] max-w-[260px] shrink-0 snap-start md:w-auto md:max-w-none">
                    <Piece piece={p} mySize={mySize} priority={i === 0 && n < 2} />
                  </li>
                ))}
                {/* The end of the rail: on to the rest of this kind in the shop. */}
                <li className={`w-[44%] max-w-[200px] shrink-0 snap-start md:w-auto md:max-w-none ${shown.length >= 4 ? "lg:hidden" : ""} ${shown.length === 3 ? "md:hidden lg:block" : ""}`}>
                  <Link href={allHref} className="group flex aspect-[4/5] flex-col justify-between border border-mist p-4 hover:border-ink">
                    <span className={`${mono} text-steel-dark`}>End of rail {String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block font-display text-[26px] uppercase leading-[0.95] tracking-[0.02em] md:text-[32px]">
                        {s.total > shown.length ? `All ${s.total}` : "See"} {s.label.toLowerCase()}
                      </span>
                      <span className="mt-3 flex items-center gap-2 text-[14px] font-semibold">
                        In the shop <Arrow className="transition-transform duration-200 group-hover:translate-x-1" />
                      </span>
                    </span>
                  </Link>
                </li>
              </ul>
            </div>
          </section>
        );
      })}

      {wall.length === 0 && budget && (
        <div className="py-14 text-center">
          <p className="text-steel-dark">Nothing under Rs {budget.toLocaleString("en-IN")} right now.</p>
          <button type="button" onClick={() => writeView({ sort, budget: null })} className="btn btn-outline mt-5">
            Clear the budget
          </button>
        </div>
      )}

      {/* The floor: the end of the wall. */}
      <div className="mt-10 md:mt-12">
        <div aria-hidden className="h-2 bg-[repeating-linear-gradient(135deg,var(--color-ink)_0_1px,transparent_1px_6px)]" />
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className={`${mono} text-steel-dark`}>End of the wall · fixed prices, as on the tag</p>
          <FlowButton href={withSize("/shop")} text="Shop all" className="w-full sm:w-auto" />
        </div>
      </div>
    </div>
  );
}
