"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { CheckoutForm } from "@/app/checkout/checkout-form";
import { useAddToBag } from "@/components/bag-gate";
import { useFitProfile } from "@/components/fit-finder";
import { useBag } from "@/components/bag-provider";
import { PriceTag } from "@/components/hang-tag";
import { BagIcon } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { CoverflowCarousel } from "@/components/ui/coverflow-carousel";
import { ExpandingSearchDock } from "@/components/ui/expanding-search-dock";
import { FlowButton } from "@/components/ui/flow-button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { hasFit, matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import { MY_SIZES, setMySize, useMySize } from "@/lib/my-size";
import { searchProducts } from "@/lib/search";
import type {
  BagLine,
  Category,
  Measurements,
  Product,
  ProductImage as Img,
  Size,
} from "@/lib/types";

// The rail, built around what a customer asks, in the order they ask it:
//   "What do they sell, and how much?"  clothes first, the price under the piece
//   "Do they have my size?"             asked once, above the first piece, then remembered
//   "Is this one in my size?"           one line under the piece at the centre
//   "I want it now."                    Buy now under it, a bag button beside it
//   "What have I picked?"               a bar with the bag's total after the first add
// The pieces hang in sections, in the order an outfit goes on; each section is a cover-flow of its pieces.

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
  /** Garment measurements in cm, per size (the back of the tag). */
  measurements: Measurements;
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

/**
 * Everything about the piece at the centre of a rail: its name and price, whether it comes in
 * their size, and the two ways to take it. The photo itself is in the carousel above.
 */
function PieceControls({
  piece,
  mySize,
  onAdded,
  onBuy,
}: {
  piece: RailPiece;
  mySize: string | null;
  onAdded: (line: { sku: string; name: string }) => void;
  onBuy: (line: BagLine) => void;
}) {
  const addToBag = useAddToBag();
  const bag = useBag();
  const profile = useFitProfile();
  const [colourName, setColourName] = useState<string | null>(null);
  const [picked, setPicked] = useState<Size | null>(null);
  const [open, setOpen] = useState(false); // the size row
  const [showCm, setShowCm] = useState(false); // the back of the tag: measurements

  const colour =
    piece.colours.find((c) => c.name === colourName) ?? piece.colours[0];
  const can = (s: string | null) =>
    Boolean(s && colour.sizes.some((x) => x.size === s && x.left > 0));
  const oneSize = colour.sizes.length === 1 && colour.sizes[0].size === "ONE";
  const inStock = colour.sizes.filter((x) => x.left > 0);
  const anyLeft = inStock.length > 0;
  // Their size for this piece: from their saved measurements when they have them (an L in a
  // tee isn't always an L in a jacket), else the letter they gave once.
  const fitSize = oneSize
    ? null
    : (matchSize(piece.category, piece.measurements, profile)?.size ?? null);
  const wanted = fitSize ?? mySize;
  // A size tapped here wins; else their size; else nothing is chosen for them.
  const size = oneSize
    ? can("ONE")
      ? "ONE"
      : null
    : can(picked)
      ? picked
      : can(wanted)
        ? (wanted as Size)
        : null;
  const variant = colour.sizes.find((x) => x.size === size) ?? null;
  const yours = !oneSize && size !== null && size === wanted;
  const stock = (n: number) => (n <= 3 ? `${n} left` : `${n} in stock`);

  // One line: can they have it, in their size?
  let note = "";
  let strong = false;
  if (!anyLeft) note = "In store only";
  else if (oneSize) note = `One size · ${stock(inStock[0].left)}`;
  else if (variant) {
    note = `${yours ? (fitSize ? `Your fit, ${size}` : "In your size") : `Size ${size}`} · ${stock(variant.left)}`;
    strong = yours;
  } else if (wanted) {
    note = `No ${wanted} · comes in ${inStock.map((x) => x.size).join(", ")}`;
    strong = true;
  } // No size chosen yet: the size buttons below already list them, so the line says nothing.

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
    )
      onAdded({ sku: variant.sku, name: piece.name });
  }

  const sizeRowOpen = !oneSize && anyLeft && (open || !variant);
  // True for anything already in the bag, from this visit or an earlier one.
  const inBag = Boolean(
    variant && bag.lines.some((l) => l.sku === variant.sku),
  );
  // The measurements shown are for the size chosen, or the first one in stock.
  const tagSize = size ?? inStock[0]?.size ?? colour.sizes[0]?.size;
  const cm = Object.entries(
    (tagSize && piece.measurements[tagSize]) || {},
  ).filter(([, v]) => typeof v === "number");

  return (
    <div className="mx-auto w-full max-w-[360px] text-center">
      <h4 className="text-[17px] font-semibold leading-snug">
        <Link
          href={`/product/${piece.slug}`}
          className="decoration-1 underline-offset-4 hover:underline"
        >
          {piece.name}
        </Link>
      </h4>
      <p className="mt-1 font-mono text-[15px] tabular-nums">
        {piece.was && (
          <s className="mr-2 text-steel-dark">
            <span className="sr-only">was </span>
            {piece.was.toLocaleString("en-IN")}
          </s>
        )}
        {formatPrice(piece.price)}
        <span className="ml-2 font-sans text-[13px] text-steel-dark">
          fixed price
        </span>
      </p>

      {/* Colour, and whether it comes in their size. */}
      <div className="mt-1 flex min-h-11 items-center justify-center gap-2 text-[13px] text-steel-dark">
        {piece.colours.length > 1 && (
          <span
            role="radiogroup"
            aria-label={`Colour of ${piece.name}`}
            className="flex shrink-0"
          >
            {piece.colours.map((c) => (
              <button
                key={c.name}
                type="button"
                role="radio"
                aria-checked={c.name === colour.name}
                aria-label={c.name}
                onClick={() => setColourName(c.name)}
                className="grid h-11 w-8 place-items-center"
              >
                <span
                  className={`h-4 w-4 rounded-full border border-black/20 ${c.name === colour.name ? "ring-2 ring-ink ring-offset-2" : ""}`}
                  style={{ background: c.hex }}
                />
              </button>
            ))}
          </span>
        )}
        {note && (
          <span className={strong ? "font-semibold text-ink" : ""}>{note}</span>
        )}
      </div>

      {/* The sizes: open when there's a choice to make, or when asked for. Sold-out sizes can't be picked. */}
      {sizeRowOpen && (
        <div
          role="radiogroup"
          aria-label={`Size of ${piece.name}`}
          className="mt-1 flex"
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
            className="flex h-12 shrink-0 items-center gap-1 border border-mist px-3 font-mono text-[13px] font-semibold hover:border-ink"
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
          <button
            type="button"
            onClick={() =>
              size &&
              onBuy({
                slug: piece.slug,
                sku: variant.sku,
                name: piece.name,
                size,
                colour: colour.name,
                price: piece.price,
                qty: 1,
              })
            }
            className="btn btn-ink h-12 min-h-0 min-w-0 flex-1 px-2 text-[13px]"
          >
            Buy now
          </button>
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

      {/* The back of the tag: the garment's measurements in cm. */}
      {cm.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowCm(!showCm)}
            aria-expanded={showCm}
            className="mt-1 h-11 text-[13px] text-steel-dark underline underline-offset-4"
          >
            Measurements in cm
          </button>
          {showCm && (
            <div className="border border-mist p-3 text-left font-mono text-[12px]">
              <p className={`${mono} text-steel-dark`}>
                {tagSize === "ONE" ? "One size" : `Size ${tagSize}`} · cm
              </p>
              <dl className="mt-2 border-t border-dashed border-steel pt-1.5">
                {cm.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between py-0.5 tabular-nums"
                  >
                    <dt className="capitalize">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <Link
                href="/size-guide"
                className="mt-1 flex h-11 items-center font-sans text-[13px] underline underline-offset-4"
              >
                Compare with one you own
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One section of the wall: its shelf label, then its pieces as a cover-flow: the piece at the
 * centre faces you, the rest turn away either side. Swipe, drag, use the arrows, or tap a
 * neighbour. What's under the carousel belongs to the piece at the centre.
 */
function Shelf({
  index,
  id,
  label,
  showAll,
  pieces,
  mySize,
  onAdded,
  onBuy,
}: {
  index: number;
  id: string;
  label: string;
  /** Where "Show all" goes; none while searching. */
  showAll: string | null;
  pieces: RailPiece[];
  mySize: string | null;
  onAdded: (line: { sku: string; name: string }) => void;
  onBuy: (line: BagLine) => void;
}) {
  const router = useRouter();
  // A long row goes round in a ring from its first piece; a short one starts on its middle piece, so both sides are filled.
  const loop = pieces.length >= 5;
  const start = loop ? 0 : Math.floor((pieces.length - 1) / 2);
  const [active, setActive] = useState(start);
  const piece = pieces[Math.min(active, pieces.length - 1)];

  return (
    <section
      id={`rail-${id}`}
      aria-labelledby={`rail-${id}-title`}
      className={`scroll-mt-24 ${index === 0 ? "pt-8" : "pt-10 md:pt-14"}`}
    >
      {/* The section's name, set large, with how many pieces hang here; Show all on the right. */}
      <div className="flex items-end justify-between gap-4">
        <h3
          id={`rail-${id}-title`}
          className="display flex min-w-0 items-start gap-2 text-[34px] leading-[0.86] md:text-[44px]"
        >
          {label}
          <span
            className="pt-0.5 font-mono text-[12px] font-normal leading-none tracking-[0.08em] text-steel-dark"
            aria-label={`${pieces.length} pieces`}
          >
            {pieces.length}
          </span>
        </h3>
        {showAll && (
          <Link
            href={showAll}
            aria-label={`Show all ${label.toLowerCase()}`}
            className="group flex h-11 shrink-0 items-end pb-1"
          >
            <span className="flex items-center gap-1.5 border-b-[1.5px] border-ink pb-1 text-[12px] font-semibold uppercase tracking-[0.07em] group-hover:border-transparent">
              Show all <Arrow />
            </span>
          </Link>
        )}
      </div>

      <CoverflowCarousel
        count={pieces.length}
        aspect={1.25}
        cardWidth="clamp(190px, 24vw, 300px)"
        loop={loop}
        initial={start}
        showNavigation
        overhang="clamp(56px, 7vw, 72px)"
        label={label}
        onSelect={setActive}
        onActivate={(i) => router.push(`/product/${pieces[i].slug}`)}
        cardClassName="group [&_img]:pointer-events-none"
        className="-mx-4 w-auto md:mx-0"
        renderSlide={(i) => (
          <>
            <ProductImage
              image={pieces[i].image}
              category={pieces[i].category}
              colourHex={pieces[i].colours[0].hex}
              decorative
              priority={index === 0 && i < 2}
              sizes="(min-width: 1280px) 300px, (min-width: 800px) 24vw, 190px"
              className="h-full overflow-hidden"
            />
            {/* The price, on a tag tied to the bottom of the card and hanging under it. */}
            <PriceTag
              price={formatPrice(pieces[i].price)}
              sku={pieces[i].colours[0].sizes[0]?.sku ?? pieces[i].id}
              className="absolute right-3 top-full -mt-3 md:right-4"
            />
          </>
        )}
      />

      {/* Which piece is at the centre, out of how many. */}
      <p className="mb-3 text-center font-mono text-[11px] tabular-nums tracking-[0.14em] text-steel-dark">
        <span className="font-semibold text-ink">
          {String(Math.min(active, pieces.length - 1) + 1).padStart(2, "0")}
        </span>{" "}
        / {String(pieces.length).padStart(2, "0")}
      </p>

      <div aria-live="polite">
        <PieceControls
          key={piece.id}
          piece={piece}
          mySize={mySize}
          onAdded={onAdded}
          onBuy={onBuy}
        />
      </div>
    </section>
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
  facts: { text: string; href?: string }[];
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
  /** The last piece added here, for the bar's Undo. */
  const [last, setLast] = useState<{ sku: string; name: string } | null>(null);
  const [addedHere, setAddedHere] = useState(false);
  /** The piece being bought in the pop-up. */
  const [buying, setBuying] = useState<BagLine | null>(null);
  const profile = useFitProfile();

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
  const clear = () => {
    setQuery("");
    writeView({ sort, budget: null });
  };
  const bagTotal = bag.lines.reduce((n, l) => n + l.price * l.qty, 0);
  const asking = !mySize || changing;
  const undoLine = last ? bag.lines.find((l) => l.sku === last.sku) : undefined;
  function undo() {
    if (!undoLine) return;
    if (undoLine.qty > 1) bag.setQty(undoLine.sku, undoLine.qty - 1);
    else bag.remove(undoLine.sku);
    setLast(null);
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-6">
        <h2
          id="rail-title"
          className="display text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[0.92]"
        >
          The rail
        </h2>
        <FlowButton
          href={withSize("/shop")}
          text="Shop all"
          className="shrink-0"
        />
      </div>
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
              {hasFit(profile)
                ? "Your measurements pick the size on each piece"
                : "Not sure? Check in cm"}
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
          {/* Search: a round button that opens into a field and filters the rail as they type. */}
          <ExpandingSearchDock
            value={query}
            onChange={setQuery}
            label="Search the rail"
            placeholder="Search the rail"
            className="min-w-0 flex-1 lg:w-80 lg:flex-none"
          />
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

      {wall.map((s, i) => (
        <Shelf
          // A new set of pieces (a search, a budget, the order) starts the row again at its first piece.
          key={`${s.key}:${s.show.map((p) => p.id).join(",")}`}
          index={i}
          id={s.key}
          label={s.label}
          showAll={q ? null : withSize(s.href)}
          pieces={s.show}
          mySize={mySize}
          onBuy={setBuying}
          onAdded={(line) => {
            setAddedHere(true);
            setLast(line);
          }}
        />
      ))}

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

      {/* Under the rail: what every customer wants to know before buying, in one line. */}
      <ul className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-2 border-y border-mist py-4 text-[15px] font-semibold md:mt-12 md:justify-between">
        {facts.map((f) => (
          <li key={f.text}>
            {f.href ? (
              <Link
                href={f.href}
                className="underline-offset-4 hover:underline"
              >
                {f.text}
              </Link>
            ) : (
              f.text
            )}
          </li>
        ))}
      </ul>

      {/* After the first add here: what's in the bag so far, the way to it, and a way back. Stays in reach while the rail is on screen. */}
      {addedHere && bag.ready && bag.count > 0 && (
        <div className="pointer-events-none sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 mt-4 flex justify-center lg:bottom-4">
          <div className="on-dark pointer-events-auto flex h-12 w-full max-w-md bg-ink text-paper shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]">
            {undoLine && last && (
              <button
                type="button"
                onClick={undo}
                aria-label={`Undo: take ${last.name} out of the bag`}
                className="shrink-0 border-r border-paper/25 px-4 text-[13px] font-semibold underline underline-offset-4"
              >
                Undo
              </button>
            )}
            <Link
              href="/bag"
              className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4"
            >
              <span
                role="status"
                className="font-mono text-[13px] tabular-nums"
              >
                {bag.count} {bag.count === 1 ? "piece" : "pieces"} ·{" "}
                {formatPrice(bagTotal)}
              </span>
              <span className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.04em]">
                View bag <Arrow />
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* Buy now: the piece and the payment form in a pop-up, without leaving the page. */}
      <Sheet open={buying !== null} onOpenChange={(o) => !o && setBuying(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-mist bg-paper p-5 pt-6 sm:max-w-md"
        >
          <SheetTitle className="display text-[34px] leading-none">
            Buy now
          </SheetTitle>
          {buying && (
            <>
              <SheetDescription className="mt-2 text-[14px] text-steel-dark">
                {buying.name} · {buying.colour}
                {buying.size === "ONE" ? "" : ` · ${buying.size}`} ·{" "}
                {formatPrice(buying.price)}
              </SheetDescription>
              <CheckoutForm buyNow={buying} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
