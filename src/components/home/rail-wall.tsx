"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { showBagToast, useAddToBag } from "@/components/bag-gate";
import { useBag } from "@/components/bag-provider";
import { Barcode } from "@/components/hang-tag";
import { BagIcon, HeartIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { toggleSaved, useList } from "@/components/saved";
import { FlowButton } from "@/components/ui/flow-button";
import { formatPrice } from "@/lib/format";
import { MY_SIZES, setMySize, useMySize } from "@/lib/my-size";
import { searchProducts } from "@/lib/search";
import type { Category, Product, ProductImage as Img, Size } from "@/lib/types";

// The rail, built around what a customer asks, in the order they ask it:
//   "What do they sell, and how much?"  clothes first, the price on a hang tag
//   "Do they have my size?"             asked once, above the first piece, then remembered
//   "Is this one in my size?"           one line on each card
//   "I want it now."                    Buy now on every card, a bag button beside it
//   "What have I picked?"               a bar with the bag's total after the first add
// The pieces hang in sections, in the order an outfit goes on, three or four to a section.

export interface RailColour {
  name: string;
  hex: string;
  /** Sizes in this colour, in order, with what can be bought online. */
  sizes: { size: Size; sku: string; left: number }[];
}

export interface RailPiece extends Pick<
  Product,
  "fit" | "gender" | "tags" | "status"
> {
  id: string;
  slug: string;
  name: string;
  category: Category;
  price: number;
  /** The full price, when on sale. */
  was?: number;
  image: Img;
  back?: Img;
  /** Colours that can be bought online (all of them when none can). */
  colours: RailColour[];
}

export interface RailSection {
  key: string;
  /** "Tops", "Jackets, bottoms and extras" */
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
const box =
  "flex h-11 items-center justify-center border text-[13px] font-semibold";
const cell = `${box} -ml-px font-mono first:ml-0`;
const cellOn = "z-10 border-ink bg-ink text-paper";
const cellOff = "border-mist bg-paper hover:z-10 hover:border-ink";
const cellOut = "border-mist bg-photo text-[#8e8e93] line-through";

const Arrow = ({ className = "" }: { className?: string }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
    className={className}
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** The hook a piece hangs from, over the section's rail. */
const Hook = () => (
  <svg
    width="14"
    height="20"
    viewBox="0 0 14 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
    className="absolute left-1/2 top-[-9px] z-10 -translate-x-1/2"
  >
    <path d="M7 20V10a3.5 3.5 0 1 0-3.5-3.5" />
  </svg>
);

/** The price, on the tag tied to the hem of the photo (the same tag as on the shop's cards). */
function PriceTag({
  price,
  sku,
  className = "",
}: {
  price: number;
  sku: string;
  className?: string;
}) {
  return (
    <div
      className={`tag-hang pointer-events-none flex flex-col items-center [filter:drop-shadow(0_0_0.6px_rgba(0,0,0,0.45))_drop-shadow(0_5px_8px_rgba(0,0,0,0.13))] ${className}`}
    >
      <span className="h-2 w-2 rounded-full border border-ink/60 bg-paper" />
      <span className="h-4 w-px bg-ink/60 md:h-5" />
      <div className="hang-tag w-[64px] px-1 pb-1.5 pt-4 font-mono [--hole:var(--color-mist)] before:top-[6px] before:-ml-1 before:h-2 before:w-2 md:w-[78px] md:px-2 md:pb-2 md:pt-5 md:before:top-[10px] md:before:-ml-[5px] md:before:h-2.5 md:before:w-2.5">
        <p className="whitespace-nowrap text-center text-[11px] font-semibold leading-none tabular-nums md:text-[12.5px]">
          {formatPrice(price)}
        </p>
        <p className="mt-1 hidden whitespace-nowrap text-center text-[7px] uppercase tracking-[0.12em] text-steel-dark md:block">
          Fixed price
        </p>
        <Barcode
          value={sku}
          className="mt-1 h-2.5 w-full text-ink md:mt-1.5 md:h-3"
        />
      </div>
    </div>
  );
}

function Piece({
  piece,
  mySize,
  priority,
  onAdded,
}: {
  piece: RailPiece;
  mySize: string | null;
  priority: boolean;
  onAdded: () => void;
}) {
  const addToBag = useAddToBag();
  const saved = useList("saved").includes(piece.slug);
  const [colourName, setColourName] = useState<string | null>(null);
  const [picked, setPicked] = useState<Size | null>(null);
  const [open, setOpen] = useState(false); // the size row
  const [showBack, setShowBack] = useState(false);
  const [added, setAdded] = useState<string | null>(null); // the sku just added

  const colour =
    piece.colours.find((c) => c.name === colourName) ?? piece.colours[0];
  const can = (s: string | null) =>
    Boolean(s && colour.sizes.some((x) => x.size === s && x.left > 0));
  const oneSize = colour.sizes.length === 1 && colour.sizes[0].size === "ONE";
  const inStock = colour.sizes.filter((x) => x.left > 0);
  const anyLeft = inStock.length > 0;
  // A size tapped here wins; else the size they gave once; else nothing is chosen for them.
  const size = oneSize
    ? can("ONE")
      ? "ONE"
      : null
    : can(picked)
      ? picked
      : can(mySize)
        ? (mySize as Size)
        : null;
  const variant = colour.sizes.find((x) => x.size === size) ?? null;
  const yours = !oneSize && size !== null && size === mySize;

  // One line: can they have it, in their size?
  let note = "";
  let strong = false;
  if (!anyLeft) note = "In store only";
  else if (oneSize) note = "One size";
  else if (variant) {
    note = `${yours ? "In your size" : `Size ${size}`}${variant.left <= 3 ? ` · ${variant.left} left` : ""}`;
    strong = yours;
  } else if (mySize) {
    note = `No ${mySize} · comes in ${inStock.map((x) => x.size).join(", ")}`;
    strong = true;
  } else note = inStock.map((x) => x.size).join(" · ");

  function add() {
    if (!variant || !size) return;
    if (
      addToBag([
        {
          slug: piece.slug,
          sku: variant.sku,
          name: piece.name,
          size,
          colour: colour.name,
          price: piece.price,
        },
      ])
    ) {
      setAdded(variant.sku);
      onAdded();
    }
  }

  const sizeRowOpen = !oneSize && anyLeft && (open || !variant);
  const inBag = Boolean(variant && added === variant.sku);

  return (
    <div className="relative flex h-full flex-col">
      <div>
        <div className="relative">
          <Hook />
          <Link
            href={`/product/${piece.slug}`}
            className="block"
            aria-label={piece.name}
          >
            <ProductImage
              image={showBack && piece.back ? piece.back : piece.image}
              category={piece.category}
              colourHex={colour.hex}
              decorative
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 62vw"
            />
          </Link>
          {piece.back && (
            <button
              type="button"
              onClick={() => setShowBack(!showBack)}
              aria-pressed={showBack}
              aria-label={`Show the back of ${piece.name}`}
              className="absolute right-1 top-1 grid h-11 min-w-11 place-items-center"
            >
              <span className="flex h-8 items-center rounded-full bg-paper/85 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ring-ink/10">
                {showBack ? "Front" : "Back"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              toggleSaved(piece.slug);
              showBagToast(
                saved
                  ? `Removed ${piece.name} from Saved.`
                  : `Saved ${piece.name}. Find it under Saved.`,
              );
            }}
            aria-pressed={saved}
            aria-label={`Save ${piece.name}`}
            className="absolute bottom-1 left-1 grid h-11 w-11 place-items-center"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-paper/85 ring-1 ring-ink/10">
              <HeartIcon
                filled={saved}
                className={`h-4 w-4 ${saved ? "text-[#d70015]" : ""}`}
              />
            </span>
          </button>
          <div
            aria-hidden
            className={`absolute right-2 top-full z-10 -mt-3 md:right-3`}
          >
            <PriceTag
              price={piece.price}
              sku={variant?.sku ?? colour.sizes[0]?.sku ?? piece.id}
            />
          </div>
        </div>

        <div
          className={`mt-3 min-h-[60px] pr-[74px] md:min-h-[76px] md:pr-[92px]`}
        >
          <h3 className={`text-[15px] font-semibold leading-5`}>
            <Link
              href={`/product/${piece.slug}`}
              className={`decoration-1 underline-offset-4 hover:underline line-clamp-1`}
            >
              {piece.name}
            </Link>
          </h3>
          <p className="sr-only">
            {piece.was ? `was ${formatPrice(piece.was)}, now ` : ""}
            {formatPrice(piece.price)}
          </p>
          {/* Colour, and whether it comes in their size. */}
          <div
            className={`mt-1 flex min-h-6 items-center gap-2 text-[13px] text-steel-dark`}
          >
            {piece.colours.length > 1 && (
              <span
                role="radiogroup"
                aria-label={`Colour of ${piece.name}`}
                className="-my-2.5 -ml-2.5 flex shrink-0"
              >
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
                    <span
                      className={`h-4 w-4 rounded-full border border-black/20 ${c.name === colour.name ? "ring-2 ring-ink ring-offset-2" : ""}`}
                      style={{ background: c.hex }}
                    />
                  </button>
                ))}
              </span>
            )}
            <span
              className={`min-w-0 ${strong ? "font-semibold text-ink" : ""}`}
            >
              {note}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-auto">
        {/* The sizes: open when there's a choice to make, or when asked for. Sold-out sizes can't be picked. */}
        {sizeRowOpen && (
          <div
            role="radiogroup"
            aria-label={`Size of ${piece.name}`}
            className="mt-2 flex"
          >
            {colour.sizes.map((s) => {
              const out = s.left <= 0;
              return (
                <button
                  key={s.size}
                  type="button"
                  role="radio"
                  aria-checked={s.size === size}
                  aria-label={`${s.size}${out ? ", sold out" : ""}`}
                  disabled={out}
                  onClick={() => {
                    setPicked(s.size);
                    setOpen(false);
                    setAdded(null);
                  }}
                  className={`${cell} min-w-0 flex-1 ${s.size === size ? cellOn : out ? cellOut : cellOff}`}
                >
                  {s.size}
                </button>
              );
            })}
          </div>
        )}

        {/* Buy now is the way through; the bag is for taking more than one. */}
        <div className="mt-2 flex gap-1.5">
          {!oneSize && variant && (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label={`Size ${size}. Change size`}
              className="flex h-12 shrink-0 items-center gap-1 border border-mist px-2.5 font-mono text-[13px] font-semibold hover:border-ink"
            >
              {size}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
                className={open ? "rotate-180" : ""}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          {variant ? (
            <Link
              href={`/buy/${piece.slug}?sku=${encodeURIComponent(variant.sku)}`}
              className={`btn btn-ink h-12 min-h-0 min-w-0 flex-1 px-2 text-[13px]`}
            >
              Buy now
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="btn h-12 min-h-0 min-w-0 flex-1 border border-mist bg-paper px-2 text-[13px] text-steel-dark disabled:opacity-100"
            >
              {anyLeft ? "Pick a size" : "In store only"}
            </button>
          )}
          <button
            type="button"
            onClick={add}
            disabled={!variant || inBag}
            aria-label={
              inBag
                ? `${piece.name} is in your bag`
                : `Add ${piece.name}${variant && !oneSize ? ` in ${size}` : ""} to bag`
            }
            className={`grid h-12 w-12 shrink-0 place-items-center border ${inBag ? "border-ink bg-ink text-paper" : "border-ink hover:bg-photo disabled:border-mist disabled:text-[#8e8e93]"}`}
          >
            {inBag ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            ) : (
              <BagIcon className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RailWall({
  sections,
  budgets,
  pieces: total,
  facts,
}: {
  sections: RailSection[];
  budgets: number[];
  pieces: number;
  facts: string[];
}) {
  const mySize = useMySize();
  const bag = useBag();
  const stored = useSyncExternalStore(subscribeView, readView, () => null);
  const budget =
    stored?.budget && budgets.includes(stored.budget) ? stored.budget : null;
  const sort: Sort = stored?.sort === "price" ? "price" : "new";
  const [changing, setChanging] = useState(false); // the size question, reopened
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addedHere, setAddedHere] = useState(false);

  const q = query.trim();
  const fits = (p: RailPiece) => !budget || p.price < budget;
  const ordered = (list: RailPiece[]) =>
    sort === "price" ? [...list].sort((a, b) => a.price - b.price) : list;
  const all = sections.flatMap((s) => s.pieces);
  // Searching puts every match on one rail; otherwise the wall keeps its sections.
  const found = q ? searchProducts(all.filter(fits), q) : [];
  const wall = q
    ? found.length
      ? [
          {
            key: "results",
            label: "Results",
            caption: `for "${q}"`,
            href: "/shop",
            total: found.length,
            pieces: found,
            show: found,
          },
        ]
      : []
    : sections
        .map((s) => ({ ...s, show: ordered(s.pieces.filter(fits)) }))
        .filter((s) => s.show.length > 0);
  const showing = wall.reduce((n, s) => n + s.show.length, 0);
  const inMySize = mySize
    ? all.filter((p) =>
        p.colours.some((c) =>
          c.sizes.some(
            (x) => (x.size === mySize || x.size === "ONE") && x.left > 0,
          ),
        ),
      ).length
    : 0;
  const withSize = (href: string) =>
    mySize ? `${href}${href.includes("?") ? "&" : "?"}size=${mySize}` : href;
  const range = (list: RailPiece[]) => {
    const prices = list.map((p) => p.price);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    return lo === hi
      ? formatPrice(lo)
      : `${formatPrice(lo)} to ${hi.toLocaleString("en-IN")}`;
  };
  const clear = () => {
    setQuery("");
    writeView({ sort, budget: null });
  };
  const bagTotal = bag.lines.reduce((n, l) => n + l.price * l.qty, 0);
  const asking = !mySize || changing;

  return (
    <div>
      <div className="flex items-end justify-between gap-6">
        <h2
          id="rail-title"
          className="display text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[0.92]"
        >
          The rail
        </h2>
        <div className="hidden sm:block">
          <FlowButton href={withSize("/shop")} text="Shop all" />
        </div>
      </div>
      {/* What every customer wants to know before buying. */}
      <p className={`${mono} mt-3 leading-[1.7] text-steel-dark`}>
        {facts.join(" · ")}
      </p>

      {/* Asked once: their size. Then search and filter, kept small. */}
      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        {asking ? (
          <div
            role="group"
            aria-label="Your size"
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <p className="text-[15px] font-semibold">Your size?</p>
            <div className="flex">
              {MY_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={mySize === s}
                  onClick={() => {
                    setMySize(s);
                    setChanging(false);
                  }}
                  className={`${cell} w-11 ${mySize === s ? cellOn : cellOff}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Link
              href="/size-guide"
              className="flex h-11 items-center text-[13px] text-steel-dark underline underline-offset-4"
            >
              Not sure? Check in cm
            </Link>
            {mySize && (
              <button
                type="button"
                onClick={() => {
                  setMySize(null);
                  setChanging(false);
                }}
                className="h-11 px-1 text-[13px] font-semibold underline underline-offset-4"
              >
                Forget my size
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setChanging(true)}
              aria-label={`My size is ${mySize}. Change it`}
              className={`${box} shrink-0 gap-2 border-ink px-3`}
            >
              <span className="grid h-6 min-w-6 place-items-center bg-volt px-1 font-mono text-[12px] text-ink">
                {mySize}
              </span>
              Change
            </button>
            <p className="text-[13px] text-steel-dark">
              <span className="font-semibold text-ink">
                {inMySize} of {total}
              </span>{" "}
              come in {mySize}. It&apos;s picked for you.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
            <label htmlFor="rail-search" className="sr-only">
              Search the rail
            </label>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-dark"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              id="rail-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the rail"
              autoComplete="off"
              enterKeyHint="search"
              className="h-11 w-full rounded-none border border-mist bg-paper pl-9 pr-3 text-base outline-none placeholder:text-steel-dark focus:border-ink"
            />
          </div>
          {budgets.length > 0 && (
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              aria-expanded={filterOpen}
              aria-controls="rail-filter"
              className={`${box} shrink-0 gap-2 px-3 ${filterOpen || budget || sort === "price" ? "border-ink" : "border-mist hover:border-ink"}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="8" cy="17" r="2" />
              </svg>
              Filter
              {(budget || sort === "price") && (
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink" />
              )}
            </button>
          )}
        </div>
      </div>

      {filterOpen && (
        <div
          id="rail-filter"
          className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-3 border border-mist p-3"
        >
          <div role="group" aria-label="Budget">
            <p className={`${mono} mb-1.5 text-steel-dark`}>Under Rs</p>
            <div className="flex">
              {budgets.map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={budget === b}
                  aria-label={`Under Rs ${b.toLocaleString("en-IN")}`}
                  onClick={() =>
                    writeView({ sort, budget: budget === b ? null : b })
                  }
                  className={`${cell} min-w-11 px-2.5 ${budget === b ? cellOn : cellOff}`}
                >
                  {b.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          </div>
          <div role="group" aria-label="Order">
            <p className={`${mono} mb-1.5 text-steel-dark`}>Order</p>
            <div className="flex">
              {(["new", "price"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={sort === o}
                  onClick={() => writeView({ budget, sort: o })}
                  className={`${box} -ml-px px-3 first:ml-0 ${sort === o ? cellOn : cellOff}`}
                >
                  {o === "new" ? "Newest" : "Cheapest"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(budget || q) && (
        <p
          role="status"
          className="mt-2 flex min-h-11 flex-wrap items-center gap-x-3 text-[13px] text-steel-dark"
        >
          <span>
            <span className="font-semibold text-ink">
              {showing} of {total}
            </span>
            {q ? ` match "${q}"` : ""}
            {budget ? ` under Rs ${budget.toLocaleString("en-IN")}` : ""}
          </span>
          <button
            type="button"
            onClick={clear}
            className="h-11 px-1 font-semibold text-ink underline underline-offset-4"
          >
            Clear
          </button>
        </p>
      )}

      {wall.map((s, i) => {
        const shown = s.show.slice(0, 4);
        return (
          <section
            key={s.key}
            id={`rail-${s.key}`}
            aria-labelledby={`rail-${s.key}-title`}
            className={`scroll-mt-24 ${i === 0 ? "pt-4" : "pt-8 md:pt-10"}`}
          >
            {/* The shelf label: section number, what hangs here, how many and for how much. */}
            <div className="flex min-h-11 items-center gap-3 border-t-2 border-ink bg-photo px-3 py-1.5">
              <span className="grid h-5 min-w-6 place-items-center bg-ink px-1 font-mono text-[11px] font-semibold text-paper">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3
                id={`rail-${s.key}-title`}
                className="font-display text-[20px] uppercase leading-none tracking-[0.02em] md:text-[22px]"
              >
                {s.label}
              </h3>
              <span className={`${mono} hidden text-steel-dark sm:block`}>
                {s.caption}
              </span>
              <span className="ml-auto shrink-0 text-right font-mono text-[11px] uppercase tracking-[0.12em] text-steel-dark">
                {s.show.length} {s.show.length === 1 ? "piece" : "pieces"}
                <span className="hidden sm:inline"> · </span>
                <br className="sm:hidden" />
                <span className="text-ink">{range(s.show)}</span>
              </span>
            </div>

            {/* The section's rail, with the pieces hanging from it. Phones swipe along it. */}
            <div className="mt-5 border-t-2 border-ink">
              <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-x-4 md:gap-y-10 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4">
                {shown.map((p, n) => (
                  <li
                    key={p.id}
                    className="w-[62%] max-w-[260px] shrink-0 snap-start md:w-auto md:max-w-none"
                  >
                    <Piece
                      piece={p}
                      mySize={mySize}
                      priority={i === 0 && n < 2}
                      onAdded={() => setAddedHere(true)}
                    />
                  </li>
                ))}
                {/* The end of the rail: on to the rest of this kind in the shop. */}
                {!q && (
                  <li
                    className={`w-[44%] max-w-[200px] shrink-0 snap-start md:w-auto md:max-w-none ${shown.length >= 4 ? "lg:hidden" : shown.length === 3 ? "md:hidden lg:block" : ""}`}
                  >
                    <Link
                      href={withSize(s.href)}
                      className="group flex aspect-[4/5] flex-col justify-between border border-mist p-4 hover:border-ink"
                    >
                      <span className={`${mono} text-steel-dark`}>
                        End of rail {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <span className="block font-display text-[26px] uppercase leading-[0.95] tracking-[0.02em] md:text-[32px]">
                          {s.total > shown.length ? `All ${s.total}` : "See"}{" "}
                          {s.label.toLowerCase()}
                        </span>
                        <span className="mt-3 flex items-center gap-2 text-[14px] font-semibold">
                          In the shop{" "}
                          <Arrow className="transition-transform duration-200 group-hover:translate-x-1" />
                        </span>
                      </span>
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </section>
        );
      })}

      {wall.length === 0 && (
        <div className="py-14 text-center">
          <p className="text-steel-dark">
            Nothing on the rail{q ? ` matches "${q}"` : ""}
            {budget ? ` under Rs ${budget.toLocaleString("en-IN")}` : ""}.
          </p>
          <button
            type="button"
            onClick={clear}
            className="btn btn-outline mt-5"
          >
            Clear
          </button>
        </div>
      )}

      {/* The floor: the end of the wall. */}
      <div className="mt-10 md:mt-12">
        <div
          aria-hidden
          className="h-2 bg-[repeating-linear-gradient(135deg,var(--color-ink)_0_1px,transparent_1px_6px)]"
        />
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className={`${mono} text-steel-dark`}>
            End of the wall · fixed prices, as on the tag
          </p>
          <FlowButton
            href={withSize("/shop")}
            text="Shop all"
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      {/* After the first add here: what's in the bag so far, and the way to it. Stays in reach while the rail is on screen. */}
      {addedHere && bag.ready && bag.count > 0 && (
        <div className="pointer-events-none sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 mt-4 flex justify-center lg:bottom-4">
          <Link
            href="/bag"
            className="pointer-events-auto flex h-12 w-full max-w-md items-center justify-between gap-4 bg-ink px-4 text-paper shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]"
          >
            <span role="status" className="font-mono text-[13px] tabular-nums">
              {bag.count} {bag.count === 1 ? "piece" : "pieces"} ·{" "}
              {formatPrice(bagTotal)}
            </span>
            <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em]">
              View bag <Arrow />
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
