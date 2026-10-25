"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Ruler } from "lucide-react";

import { CheckoutForm } from "@/app/checkout/checkout-form";
import { useFitProfile } from "@/components/fit-finder";
import { openSizeFinder } from "@/components/size-finder";
import { useBag } from "@/components/bag-provider";
import { AddToBag } from "@/components/add-to-bag";
import { addableFromRail } from "@/lib/addable";
import { ProductImage } from "@/components/product-image";
import { CoverflowCarousel } from "@/components/ui/coverflow-carousel";
import { ExpandingSearchDock } from "@/components/ui/expanding-search-dock";
import { FlowButton } from "@/components/ui/flow-button";
import { ShinyLink } from "@/components/ui/shiny-button";
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

type Sort = "new" | "price" | "price-desc" | "saving";
const SORTS: { key: Sort; label: string }[] = [
  { key: "new", label: "Newest" },
  { key: "price", label: "Cheapest" },
  { key: "price-desc", label: "Priciest" },
  { key: "saving", label: "Biggest saving" },
];
const FITS = [
  { key: "oversized", label: "Oversized" },
  { key: "relaxed", label: "Relaxed" },
  { key: "regular", label: "Regular" },
] as const;
/** The rail's filters for this visit. Everything but the budget and order is optional, so an older saved view still reads. */
interface View {
  budget: number | null;
  sort: Sort;
  kinds?: Category[];
  fit?: string | null;
  colour?: string | null;
  sale?: boolean;
  inSize?: boolean;
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
/** The shadow under a card that floats over the page. */
const floating = "shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)]";
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
export function PieceControls({
  piece,
  mySize,
  onBuy,
}: {
  piece: RailPiece;
  mySize: string | null;
  /** Unused here now: adding is the card's own bag button. */
  onAdded?: (line: { sku: string; name: string }) => void;
  onBuy: (line: BagLine) => void;
}) {
  // Their saved size (Find my size) picks each piece's size, signed in or not.
  const profile = useFitProfile();
  const [colourName, setColourName] = useState<string | null>(null);
  const [picked, setPicked] = useState<Size | null>(null);
  const [open, setOpen] = useState(false); // the size row
  const [showCm, setShowCm] = useState(false); // the back of the tag: measurements
  const [peekCm, setPeekCm] = useState(false); // the same, while the mouse is over the link

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
    : (matchSize(piece.category, piece.measurements, profile, piece.fit)?.size ?? null);
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

  const sizeRowOpen = !oneSize && anyLeft && (open || !variant);
  // The measurements shown are for the size chosen, or the first one in stock.
  const tagSize = size ?? inStock[0]?.size ?? colour.sizes[0]?.size;
  const cm = Object.entries(
    (tagSize && piece.measurements[tagSize]) || {},
  ).filter(([, v]) => typeof v === "number");
  // With no size chosen there is no one size to show: every size is laid out side by side instead.
  const chart = colour.sizes
    .map((x) => ({
      size: x.size,
      left: x.left,
      cm: Object.entries(piece.measurements[x.size] ?? {}).filter(
        ([, v]) => typeof v === "number",
      ),
    }))
    .filter((x) => x.cm.length > 0);
  const allSizes = !oneSize && size === null && chart.length > 1;

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
      {/* Colour, the price, and whether it comes in their size (owner, 25 Oct 2026: the price here, not on a hanging tag). */}
      <div className="mt-1 flex min-h-11 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-steel-dark">
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
        <span className="font-mono text-[15px] font-semibold tabular-nums text-ink">
          {piece.was && (
            <s className="mr-1.5 text-[12px] font-normal text-steel-dark">
              <span className="sr-only">was </span>
              {formatPrice(piece.was)}
            </s>
          )}
          {piece.was && <span className="sr-only">now </span>}
          {formatPrice(piece.price)}
        </span>
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
        {/* Add to bag lives on the card itself (one bag button per card, bottom left). */}
      </div>

      {/* The back of the tag: the garment's measurements in cm. */}
      {/* A click opens it in the page and keeps it open; a mouse over the link shows it floating until the mouse leaves. */}
      {cm.length > 0 && (
        <div
          className="relative"
          onPointerEnter={(e) => e.pointerType === "mouse" && setPeekCm(true)}
          onPointerLeave={() => setPeekCm(false)}
        >
          <button
            type="button"
            onClick={() => setShowCm(!showCm)}
            aria-expanded={showCm}
            className="mt-1 h-11 text-[13px] text-steel-dark underline underline-offset-4"
          >
            Measurements in cm
          </button>
          {(showCm || peekCm) && allSizes && (
            // No size chosen: the same small card, one for each size, side by side. Tapping one picks it.
            <div
              role="group"
              aria-label="All sizes in cm"
              className={`left-1/2 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 animate-fade-up ${showCm ? "relative" : `absolute top-full z-40 bg-paper p-2 ${floating}`}`}
            >
              <div
                className="grid gap-1.5 sm:gap-2"
                style={{
                  gridTemplateColumns: `repeat(${chart.length}, minmax(0, 124px))`,
                }}
              >
                {chart.map((c) => {
                  const body = (
                    <>
                      <span className={`${mono} block text-steel-dark`}>
                        <span className="hidden sm:inline">Size </span>
                        {c.size} · cm
                      </span>
                      <span className="mt-2 block border-t border-dashed border-steel pt-1.5 font-mono text-[11px] tabular-nums sm:text-[12px]">
                        {c.cm.map(([k, v]) => (
                          <span key={k} className="flex justify-between py-0.5">
                            <span className="capitalize">{k}</span>
                            <span className="font-semibold">{v}</span>
                          </span>
                        ))}
                      </span>
                      {c.left === 0 && (
                        <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.08em]">
                          Sold out
                        </span>
                      )}
                    </>
                  );
                  return c.left > 0 ? (
                    <button
                      key={c.size}
                      type="button"
                      onClick={() => setPicked(c.size)}
                      aria-label={`Size ${c.size}: ${c.cm.map(([k, v]) => `${k} ${v}`).join(", ")} cm. Pick it`}
                      className="border border-mist p-2 text-left hover:border-ink sm:p-3"
                    >
                      {body}
                    </button>
                  ) : (
                    <div
                      key={c.size}
                      className="border border-mist p-2 text-left text-[#8e8e93] sm:p-3"
                    >
                      {body}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => openSizeFinder({ name: piece.name, category: piece.category, fit: piece.fit, measurements: piece.measurements })}
                className="mx-auto flex h-11 w-max cursor-pointer items-center text-[13px] underline underline-offset-4"
              >
                Find my size in this
              </button>
            </div>
          )}
          {(showCm || peekCm) && !allSizes && (
            <div
              className={`border border-mist p-3 text-left font-mono text-[12px] ${showCm ? "" : `absolute inset-x-0 top-full z-40 animate-fade-up bg-paper ${floating}`}`}
            >
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
              <button
                type="button"
                onClick={() => openSizeFinder({ name: piece.name, category: piece.category, fit: piece.fit, measurements: piece.measurements })}
                className="mt-1 flex h-11 cursor-pointer items-center font-sans text-[13px] underline underline-offset-4"
              >
                Find my size in this
              </button>
            </div>
          )}
        </div>
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
  pieces: every,
  mySize,
  onAdded,
  onBuy,
}: {
  index: number;
  id: string;
  label: string;
  /** Where "Show all" goes; none while searching the whole rail (the shelf's own search is off then too). */
  showAll: string | null;
  pieces: RailPiece[];
  mySize: string | null;
  onAdded: (line: { sku: string; name: string }) => void;
  onBuy: (line: BagLine) => void;
}) {
  // The shelf's own search: it only looks through this shelf's pieces.
  const [query, setQuery] = useState("");
  const q = query.trim();
  const pieces = q ? searchProducts(every, q) : every;

  return (
    <section
      id={`rail-${id}`}
      aria-labelledby={`rail-${id}-title`}
      className={`scroll-mt-24 ${index === 0 ? "pt-8" : "pt-10 md:pt-14"}`}
    >
      {/* The section's name, set large, with how many pieces hang here; its own search and Show all on the right. */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <h3
          id={`rail-${id}-title`}
          className="display min-w-0 text-[34px] leading-[0.86] md:text-[44px]"
        >
          {label}
          <span
            className="ml-2 inline-block pt-0.5 align-top font-mono text-[12px] font-normal leading-none tracking-[0.08em] text-steel-dark"
            aria-label={`${pieces.length} pieces`}
          >
            {pieces.length}
          </span>
        </h3>
        {showAll && (
          <div className={`flex min-w-0 items-center justify-end gap-3 ${q ? "max-sm:basis-full" : ""} sm:flex-1`}>
            <ExpandingSearchDock
              value={query}
              onChange={setQuery}
              label={`Search ${label.toLowerCase()}`}
              placeholder={`Search ${label.toLowerCase()}`}
              className="min-w-0 flex-1"
            />
            <ShinyLink
              href={showAll}
              aria-label={`Show all ${label.toLowerCase()}`}
            >
              Show all <Arrow />
            </ShinyLink>
          </div>
        )}
      </div>

      {pieces.length > 0 ? (
        <ShelfRow
          // A new set of matches starts the row again at its first piece.
          key={pieces.map((x) => x.id).join(",")}
          index={index}
          label={label}
          pieces={pieces}
          mySize={mySize}
          onAdded={onAdded}
          onBuy={onBuy}
        />
      ) : (
        <p role="status" className="py-10 text-center text-steel-dark">
          Nothing in {label.toLowerCase()} matches &ldquo;{q}&rdquo;.
        </p>
      )}
    </section>
  );
}

/** A shelf's row: the pieces in a cover-flow, the count, and the centre piece's controls. */
function ShelfRow({
  index,
  label,
  pieces,
  mySize,
  onAdded,
  onBuy,
}: {
  index: number;
  label: string;
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
    <>
      <CoverflowCarousel
        count={pieces.length}
        aspect={1.25}
        cardWidth="clamp(190px, 24vw, 300px)"
        loop={loop}
        initial={start}
        showNavigation
        hint
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
            {/* Add to bag: only on the card in front, bottom left */}
            {i === Math.min(active, pieces.length - 1) && <AddToBag piece={addableFromRail(pieces[i])} className="absolute bottom-1 left-1 z-10" />}
          </>
        )}
      />

      {/* Which piece is at the centre, out of how many, is in the carousel's hint (owner, 20 Oct 2026). */}
      <div aria-live="polite" className="mt-3">
        <PieceControls
          key={piece.id}
          piece={piece}
          mySize={mySize}
          onAdded={onAdded}
          onBuy={onBuy}
        />
      </div>
    </>
  );
}

export function RailWall({
  sections,
  budgets,
  pieces: total,
  title = "The rail",
  kindNames = {},
  kindOrder = [],
}: {
  sections: RailSection[];
  budgets: number[];
  pieces: number;
  /** Its name, set in Admin → Home page. */
  title?: string;
  /** Names and order of the kinds (Admin → Categories). */
  kindNames?: Partial<Record<Category, string>>;
  kindOrder?: Category[];
}) {
  const mySize = useMySize();
  const bag = useBag();
  const stored = useSyncExternalStore(subscribeView, readView, () => null);
  const budget =
    stored?.budget && budgets.includes(stored.budget) ? stored.budget : null;
  const sort: Sort = SORTS.some((x) => x.key === stored?.sort) ? (stored!.sort as Sort) : "new";
  const kinds = stored?.kinds ?? [];
  const fitF = stored?.fit ?? null;
  const colourF = stored?.colour ?? null;
  const saleF = Boolean(stored?.sale);
  const inSizeF = Boolean(stored?.inSize);
  const view: View = { budget, sort, kinds, fit: fitF, colour: colourF, sale: saleF, inSize: inSizeF };
  const setView = (patch: Partial<View>) => writeView({ ...view, ...patch });
  /** How many filters are on (the order doesn't count), for the badge on Filter. */
  const filtersOn = [budget, kinds.length, fitF, colourF, saleF, inSizeF].filter(Boolean).length;
  const [changing, setChanging] = useState(false); // the size question, reopened
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** The last piece added here, for the bar's Undo. */
  const [last, setLast] = useState<{ sku: string; name: string } | null>(null);
  const [addedHere, setAddedHere] = useState(false);
  /** The piece being bought in the pop-up. */
  const [buying, setBuying] = useState<BagLine | null>(null);
  const profile = useFitProfile();
  /** Their size is saved (Find my size): sizes are picked from it, and the bar shows which. */
  const fitOn = hasFit(profile);

  const q = query.trim();
  const fits = (p: RailPiece) =>
    (!budget || p.price < budget) &&
    (!kinds.length || kinds.includes(p.category)) &&
    (!fitF || p.fit === fitF) &&
    (!colourF || p.colours.some((c) => c.name === colourF)) &&
    (!saleF || Boolean(p.was)) &&
    (!inSizeF || !mySize || p.colours.some((c) => c.sizes.some((x) => (x.size === mySize || x.size === "ONE") && x.left > 0)));
  const ordered = (list: RailPiece[]) =>
    sort === "price"
      ? [...list].sort((a, b) => a.price - b.price)
      : sort === "price-desc"
        ? [...list].sort((a, b) => b.price - a.price)
        : sort === "saving"
          ? [...list].sort((a, b) => (b.was ?? b.price) - b.price - ((a.was ?? a.price) - a.price))
          : list;
  const all = sections.flatMap((s) => s.pieces);
  // What the filter offers: only kinds and colours that are on the rail, colours most common first.
  const railKinds = kindOrder.filter((k) => all.some((p) => p.category === k));
  const railColours = [
    ...all
      .flatMap((p) => p.colours.map((c) => ({ name: c.name, hex: c.hex })))
      .reduce((m, c) => m.set(c.name, { ...c, n: (m.get(c.name)?.n ?? 0) + 1 }), new Map<string, { name: string; hex: string; n: number }>())
      .values(),
  ]
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);
  const onSale = all.filter((p) => p.was).length;
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
  // The letter their measurements land on most often across the rail: the one to highlight.
  const fitLetter = fitOn
    ? (Object.entries(
        all.reduce<Record<string, number>>((count, piece) => {
          const size = matchSize(piece.category, piece.measurements, profile, piece.fit)?.size;
          if (size && MY_SIZES.includes(size)) count[size] = (count[size] ?? 0) + 1;
          return count;
        }, {}),
      ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)
    : null;
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
  /** The search field is open (or holds a search): on a phone it needs the size's place in the row. */
  const [searching, setSearching] = useState(false);
  const searchOpen = searching || query !== "";
  const undoLine = last ? bag.lines.find((l) => l.sku === last.sku) : undefined;
  function undo() {
    if (!undoLine) return;
    if (undoLine.qty > 1) bag.setQty(undoLine.sku, undoLine.qty - 1);
    else bag.remove(undoLine.sku);
    setLast(null);
  }

  return (
    <div>
      {/* One bar with a thin black line round it, rounded at the top and square at the bottom. Only the name is solid black, as a tab at its left end. Then their size (asked once), search, Filter and Shop all. On a phone it is two rows. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-t-2xl border border-ink py-2 pr-3 lg:flex-nowrap">
        <h2
          id="rail-title"
          className="display on-dark order-1 -my-2 -ml-px flex items-center self-stretch rounded-tl-[15px] bg-ink px-5 py-3 text-[38px] leading-[0.9] text-paper md:text-[44px]"
        >
          {title}
        </h2>
        <div className="order-2 ml-auto shrink-0 lg:order-last lg:ml-0">
          <FlowButton href={withSize("/shop")} text="Shop all" solid />
        </div>
        <span aria-hidden className="order-3 h-0 basis-full lg:hidden" />
        <span
          aria-hidden
          className="order-4 hidden h-8 w-px shrink-0 bg-transparent lg:block"
        />

        {/* On a phone the open search field takes this row, so the size steps aside until it folds away. */}
        {asking ? (
          <div
            role="group"
            aria-label="Your size"
            className={`order-5 shrink-0 items-center max-lg:pl-3 gap-x-3 ${searchOpen ? "hidden lg:flex" : "flex"}`}
          >
            <p className={`${mono} hidden text-steel-dark lg:block`}>Size</p>
            <div className="flex gap-1.5">
              {MY_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={mySize === s || (!mySize && fitLetter === s)}
                  aria-label={fitLetter === s ? `${s}, picked from your measurements` : undefined}
                  data-fit={fitLetter === s ? "" : undefined}
                  onClick={() => {
                    setMySize(s);
                    setChanging(false);
                  }}
                  className={`grid h-11 w-11 place-items-center rounded-full border font-mono text-[12px] font-semibold ${mySize === s || (!mySize && fitLetter === s) ? "border-ink bg-ink text-paper" : "border-ink/60 hover:border-ink hover:bg-ink hover:text-paper"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => openSizeFinder()}
              className="flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-ink/20 px-3.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink"
            >
              <Ruler className="h-3.5 w-3.5" aria-hidden />
              {fitOn ? "Change my size" : "Find my size"}
            </button>
            {mySize && (
              <button
                type="button"
                onClick={() => {
                  setMySize(null);
                  setChanging(false);
                }}
                aria-label="Forget my size"
                className="h-11 whitespace-nowrap px-1 text-[13px] font-semibold underline underline-offset-4"
              >
                Forget
              </button>
            )}
          </div>
        ) : (
          <div
            className={`order-5 shrink-0 items-center max-lg:pl-3 gap-3 ${searchOpen ? "hidden lg:flex" : "flex"}`}
          >
            <button
              type="button"
              onClick={() => setChanging(true)}
              aria-label={`My size is ${mySize}. Change it`}
              className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-ink pl-1.5 pr-4 text-[13px] font-semibold"
            >
              <span className="grid h-8 min-w-8 place-items-center rounded-full bg-ink px-1 font-mono text-[12px] text-paper">
                {mySize}
              </span>
              Change
            </button>
            <p className="hidden whitespace-nowrap text-[13px] text-steel-dark xl:block">
              <span className="font-semibold text-ink">
                {inMySize} of {total}
              </span>{" "}
              come in {mySize}
            </p>
          </div>
        )}

        {/* Search: a round button that opens into a field and filters the rail as they type. */}
        <ExpandingSearchDock
          value={query}
          onChange={setQuery}
          onOpenChange={setSearching}
          label="Search the rail"
          placeholder="Search the rail"
          className="order-6 min-w-0 flex-1"
        />
        {(budgets.length > 0 || all.length > 0) && (
          <button
            type="button"
            onClick={() => setFilterOpen(!filterOpen)}
            aria-label="Filter"
            aria-expanded={filterOpen}
            aria-controls="rail-filter"
            className={`${box} relative order-7 w-11 shrink-0 gap-2 rounded-full sm:w-auto sm:px-4 ${filterOpen || filtersOn || sort !== "new" ? "border-ink" : "border-mist hover:border-ink"}`}
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
            <span className="hidden sm:inline">Filter</span>
            {filtersOn > 0 ? (
              <span aria-label={`${filtersOn} on`} className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 font-mono text-[10px] text-paper sm:static">
                {filtersOn}
              </span>
            ) : (
              sort !== "new" && <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-ink sm:static" />
            )}
          </button>
        )}
      </div>

      {filterOpen && (
        <div id="rail-filter" className="flex flex-wrap items-start gap-x-8 gap-y-5 border border-t-0 border-ink p-4">
          {railKinds.length > 1 && (
            <div role="group" aria-label="Kind" className="basis-full">
              <p className={`${mono} mb-2 text-steel-dark`}>Kind</p>
              <div className="flex flex-wrap gap-1.5">
                {railKinds.map((k) => {
                  const on = kinds.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setView({ kinds: on ? kinds.filter((x) => x !== k) : [...kinds, k] })}
                      className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${on ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
                    >
                      {kindNames[k] ?? k}
                      <span className={`ml-1.5 font-mono text-[10px] ${on ? "text-paper/70" : "text-steel-dark"}`}>{all.filter((p) => p.category === k).length}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {budgets.length > 0 && (
            <div role="group" aria-label="Budget">
              <p className={`${mono} mb-2 text-steel-dark`}>Under Rs</p>
              <div className="flex">
                {budgets.map((b) => (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={budget === b}
                    aria-label={`Under Rs ${b.toLocaleString("en-IN")}`}
                    onClick={() => setView({ budget: budget === b ? null : b })}
                    className={`${cell} min-w-11 px-2.5 ${budget === b ? cellOn : cellOff}`}
                  >
                    {b.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div role="group" aria-label="Fit">
            <p className={`${mono} mb-2 text-steel-dark`}>Fit</p>
            <div className="flex">
              {FITS.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  aria-pressed={fitF === x.key}
                  onClick={() => setView({ fit: fitF === x.key ? null : x.key })}
                  className={`${box} -ml-px px-3 first:ml-0 ${fitF === x.key ? cellOn : cellOff}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <div role="group" aria-label="Colour">
            <p className={`${mono} mb-2 text-steel-dark`}>Colour{colourF ? `: ${colourF}` : ""}</p>
            <div className="flex flex-wrap gap-1.5">
              {railColours.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={colourF === c.name}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => setView({ colour: colourF === c.name ? null : c.name })}
                  className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${colourF === c.name ? "border-ink" : "border-transparent hover:border-mist"}`}
                >
                  <span className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
                </button>
              ))}
            </div>
          </div>
          <div role="group" aria-label="Only">
            <div>
              <p className={`${mono} mb-2 text-steel-dark`}>Only</p>
              <div className="flex flex-wrap gap-1.5">
                {onSale > 0 && (
                  <button
                    type="button"
                    aria-pressed={saleF}
                    onClick={() => setView({ sale: !saleF })}
                    className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold ${saleF ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
                  >
                    On sale <span className={`ml-1 font-mono text-[10px] ${saleF ? "text-paper/70" : "text-steel-dark"}`}>{onSale}</span>
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={inSizeF && Boolean(mySize)}
                  disabled={!mySize}
                  title={mySize ? undefined : "Pick your size in the bar first"}
                  onClick={() => setView({ inSize: !inSizeF })}
                  className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${inSizeF && mySize ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
                >
                  {mySize ? `In my size (${mySize})` : "In my size"}
                </button>
              </div>
            </div>
          </div>
          <div role="group" aria-label="Order">
            <p className={`${mono} mb-2 text-steel-dark`}>Order</p>
            <div className="flex flex-wrap">
              {SORTS.filter((o) => o.key !== "saving" || onSale > 0).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={sort === o.key}
                  onClick={() => setView({ sort: o.key })}
                  className={`${box} -ml-px px-3 first:ml-0 ${sort === o.key ? cellOn : cellOff}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex basis-full items-center justify-end gap-3 border-t border-mist pt-3">
            {(filtersOn > 0 || sort !== "new") && (
              <button type="button" onClick={() => writeView({ budget: null, sort: "new" })} className="h-11 px-1 text-[13px] font-semibold underline underline-offset-4">
                Reset all
              </button>
            )}
            <button type="button" onClick={() => setFilterOpen(false)} className="h-11 rounded-full bg-ink px-5 text-[13px] font-semibold text-paper">
              Show {showing}
            </button>
          </div>
        </div>
      )}

      {(filtersOn > 0 || q) && (
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
            {kinds.length ? ` · ${kinds.map((k) => kindNames[k] ?? k).join(", ")}` : ""}
            {fitF ? ` · ${fitF}` : ""}
            {colourF ? ` · ${colourF}` : ""}
            {saleF ? " · on sale" : ""}
            {inSizeF && mySize ? ` · in ${mySize}` : ""}
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
