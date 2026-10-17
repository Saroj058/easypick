"use client";

import { LayoutGrid, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatPrice } from "@/lib/format";
import { useGiftBag } from "@/lib/gift-bag";
import { searchProducts } from "@/lib/search";
import { categoryLabels } from "@/lib/site";
import type { Category, Product } from "@/lib/types";
import { DropStrip } from "../drop-strip";
import { GiftForm } from "../gift-form";
import type { RailPiece } from "../home/rail-wall";
import { GiftIcon } from "../icons";
import { ExpandingSearchDock } from "../ui/expanding-search-dock";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../ui/sheet";

// The gift page's pieces, as the drops page shows a drop: one strip of cards, and under the centre
// piece its name, price and one button, "Send it as a gift", which opens the gift form in a pop-up.
// No Buy now or bag here (owner, 14 Oct 2026): this page sends, it doesn't sell.
// Above it: a budget, the kind of piece (each with a little picture of the garment), and the
// rail's search. All of it narrows the strip at once, without reloading the page.

/** Budgets offered, when they narrow what is on sale (at least one piece under, and not all). */
const BUDGETS = [1000, 2000, 3500, 5000];
type Kind = Category | "one" | "trending";
/** A little garment picture for each kind (the neutral stand-ins in public/stand-ins). */
const KIND_ICON: Record<Kind, string> = {
  tees: "tee",
  hoodies: "hoodie",
  jackets: "jacket",
  bottoms: "cargo",
  "co-ords": "set",
  accessories: "cap",
  one: "cap",
  trending: "hoodie",
};

const oneSize = (p: RailPiece) =>
  p.colours.every((c) => c.sizes.every((s) => s.size === "ONE"));

export function GiftPieces({
  pieces,
  trending,
  above,
}: {
  pieces: RailPiece[];
  /** Shown between the filters and the "Every piece" title (Pick, on the gift page). */
  above?: React.ReactNode;
  /** Slugs selling fastest this week, fastest first. */
  trending: string[];
}) {
  const [max, setMax] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [query, setQuery] = useState("");
  const [own, setOwn] = useState("");
  /** The piece being sent, in the pop-up. */
  const [sending, setSending] = useState<RailPiece | null>(null);

  const hot = new Set(trending);
  const inKind = (p: RailPiece, k: Kind | null) =>
    k === "trending"
      ? hot.has(p.slug)
      : k === "one"
        ? oneSize(p)
        : k
          ? p.category === k
          : true;
  const inBudget = (p: RailPiece, m: number | null) =>
    m ? p.price <= m : true;
  const budgets = BUDGETS;
  /** Their own budget, typed in. */
  const custom = max !== null && !BUDGETS.includes(max);
  const kinds = (["trending", ...Object.keys(categoryLabels), "one"] as Kind[])
    .map((k) => ({
      k,
      count: pieces.filter((p) => inBudget(p, max) && inKind(p, k)).length,
    }))
    .filter((x) => x.count > 0);

  const q = query.trim();
  // With a budget, the best that money buys comes first; without one, the small everyday gifts do.
  const matched = searchProducts(
    pieces.filter((p) => inBudget(p, max) && inKind(p, kind)),
    q,
  );
  // Trending keeps its own order, the fastest sellers first; the rest go by price.
  const ordered = q
    ? matched
    : kind === "trending"
      ? [...matched].sort(
          (a, b) => trending.indexOf(a.slug) - trending.indexOf(b.slug),
        )
      : [...matched].sort((a, b) =>
          max ? b.price - a.price : a.price - b.price,
        );
  // Every piece, however many: the strip only paints the ones near the centre.
  const shown = ordered;
  const filtered = Boolean(max || kind || q);

  const pill = (on: boolean) =>
    `inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-[background-color,color,scale] duration-150 active:scale-[0.97] ${on ? "bg-ink text-paper shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)]" : "text-ink/70 hover:text-ink"}`;

  return (
    <div>
      {/* The finder: one thin outlined card */}
      <div className="rounded-2xl border border-ink">
        {/* Budget, and the rail's search at the end */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:flex-nowrap md:px-4">
          <div
            role="group"
            aria-label="Budget"
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-mist p-1 [scrollbar-width:none]"
          >
            <button
              type="button"
              aria-pressed={!max}
              onClick={() => {
                setMax(null);
                setOwn("");
              }}
              className={pill(!max)}
            >
              Any price
            </button>
            {budgets.map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={max === b}
                onClick={() => {
                  setMax(max === b ? null : b);
                  setOwn("");
                }}
                className={pill(max === b)}
              >
                Under {formatPrice(b)}
              </button>
            ))}
            {/* Their own budget: always open, filling the rest of the row */}
            <label className={`relative inline-flex h-10 min-w-[150px] flex-1 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors duration-150 ${custom ? "bg-ink text-paper" : "bg-paper text-ink ring-1 ring-ink"}`}>
              <span className="shrink-0">Under Rs</span>
              <span className="sr-only">Your budget, in rupees</span>
              <input
                type="text"
                inputMode="numeric"
                value={own}
                placeholder="4,000"
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                  setOwn(digits ? Number(digits).toLocaleString("en-IN") : "");
                  setMax(digits && Number(digits) > 0 ? Number(digits) : null);
                }}
                className="w-full min-w-0 flex-1 bg-transparent font-mono tabular-nums outline-none placeholder:opacity-40"
              />
            </label>
          </div>
          {/* Search every piece: always open, not a button */}
          <label className="relative flex h-11 w-full shrink-0 items-center gap-2 rounded-full border border-ink/30 bg-paper px-4 transition-[border-color] duration-200 focus-within:border-ink md:w-[min(300px,30vw)]">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-steel-dark" />
            <span className="sr-only">Search the gifts</span>
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search every piece"
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-steel-dark md:text-[14px]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear the search"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-mist"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            )}
          </label>
        </div>

        {/* Kind: each with a little picture of the garment and how many there are */}
        <div className="flex items-center gap-3 border-t border-ink/15 px-3 py-2.5 md:px-4">
          <div
            role="group"
            aria-label="Kind of piece"
            className="flex min-w-0 flex-1 gap-2 overflow-x-auto [mask-image:linear-gradient(90deg,#000_calc(100%-28px),transparent)] [scrollbar-width:none] md:flex-wrap md:overflow-visible md:[mask-image:none]"
          >
            <button
              type="button"
              aria-pressed={!kind}
              onClick={() => setKind(null)}
              className={`${kindChip(!kind)}`}
            >
              <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={1.8} />
              Anything
            </button>
            {kinds.map(({ k, count }) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(kind === k ? null : k)}
                className={kindChip(kind === k)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a tiny garment picture, already compressed */}
                <img
                  src={`/stand-ins/${KIND_ICON[k]}.webp`}
                  alt=""
                  className={`h-6 w-6 object-contain ${kind === k ? "brightness-[3]" : "opacity-80"}`}
                />
                {label(k)}
                <sup
                  className={`font-mono text-[10px] ${kind === k ? "text-paper/70" : "text-steel-dark"}`}
                >
                  {count}
                </sup>
              </button>
            ))}
          </div>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setMax(null);
                setOwn("");
                setKind(null);
                setQuery("");
              }}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center text-[13px] font-semibold underline underline-offset-4"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {above && <div className="mt-10 md:mt-14">{above}</div>}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 md:mt-10">
        <div className="min-w-0">
          <h2
            id="pieces-h"
            className="display text-[clamp(2.4rem,1.8rem+3vw,4rem)] leading-[0.88]"
          >
            {kind ? label(kind) : "Every piece"}
            <span
              className="ml-2 inline-block pt-1 align-top font-mono text-[13px] font-normal leading-none tracking-[0.08em] text-steel-dark"
              aria-label={`${ordered.length} pieces`}
            >
              {ordered.length}
            </span>
          </h2>
          <p className="index mt-2 text-steel-dark" aria-live="polite">
            {max ? `Under ${formatPrice(max)}` : "Any price"}
            {q ? ` · "${q}"` : max ? " · best first" : " · cheapest first"}
          </p>
        </div>
        {kind && (
          <ExpandingSearchDock
            value={query}
            onChange={setQuery}
            label={searchLabel(kind)}
            placeholder={searchLabel(kind)}
            className="min-w-0 max-w-[320px] flex-1 max-sm:basis-full sm:justify-end"
          />
        )}
      </div>

      <GiftBagLink />
      {shown.length > 0 ? (
        <>
          <DropStrip
            key={`${max}-${kind}-${q}`}
            pieces={shown}
            label="Gifts"
            tags
            big
            href={(p) => `/product/${p.slug}?from=gift`}
            addTo="gift"
            controls={(p) => (
              <SendControls piece={p} onSend={() => setSending(p)} />
            )}
          />
        </>
      ) : (
        <p className="mt-8 text-center">
          Nothing here right now.{" "}
          <button
            type="button"
            onClick={() => {
              setMax(null);
              setOwn("");
              setKind(null);
              setQuery("");
            }}
            className="inline-flex min-h-11 cursor-pointer items-center font-semibold underline underline-offset-2"
          >
            Show every piece
          </button>{" "}
          or{" "}
          <Link
            href="#buy"
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
          >
            send a gift card
          </Link>
        </p>
      )}

      <SendSheet piece={sending} onClose={() => setSending(null)} />
    </div>
  );
}

/** Under the centre piece: its name, price, how sizing works for a gift, and the one thing to do. */
function SendControls({
  piece,
  onSend,
}: {
  piece: RailPiece;
  onSend: () => void;
}) {
  const oneSize = piece.colours.every((c) =>
    c.sizes.every((s) => s.size === "ONE"),
  );
  return (
    <div className="flex flex-col items-center text-center">
      {/* The price is on the tag hanging from the card: not said twice. */}
      <h4 className="text-lg font-semibold">{piece.name}</h4>
      <p className="mt-1 text-[13px] text-steel-dark">
        {oneSize
          ? "One size. Nothing to guess."
          : "They pick their own size, or swap it in the store."}
      </p>
      <button
        type="button"
        onClick={onSend}
        className="group mt-4 flex h-14 w-full max-w-[360px] cursor-pointer items-center justify-center gap-2.5 rounded-[4px] bg-volt px-6 text-[14px] font-semibold uppercase tracking-[0.08em] text-ink transition-[background-color,scale] duration-200 hover:bg-[#b5f020] active:scale-[0.98]"
      >
        <GiftIcon className="h-5 w-5" />
        Send it as a gift
      </button>
    </div>
  );
}

/** The send-as-gift form, over the page: the piece is fetched in full when the pop-up opens.
 *  Also opened by Pick (pick-chat.tsx), with the size when the customer knows it. */
export function SendSheet({
  piece,
  initial,
  onClose,
}: {
  piece: Pick<RailPiece, "slug" | "name" | "price"> | null;
  initial?: { colour?: string; size?: string };
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<{
    slug: string;
    product: Product | null;
  } | null>(null);
  const slug = piece?.slug ?? null;
  useEffect(() => {
    if (!slug) return;
    let live = true;
    fetch(`/api/products/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((product: Product | null) => live && setLoaded({ slug, product }))
      .catch(() => live && setLoaded({ slug, product: null }));
    return () => {
      live = false;
    };
  }, [slug]);
  const product = loaded && loaded.slug === slug ? loaded.product : undefined;

  return (
    <Sheet open={piece !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto overscroll-contain border-mist bg-paper p-0 sm:max-w-lg"
      >
        <SheetTitle className="sr-only">Send as a gift</SheetTitle>
        {piece && (
          <SheetDescription className="sr-only">
            {piece.name} · {formatPrice(piece.price)}
          </SheetDescription>
        )}
        {product === undefined ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center" role="status">
            <span aria-hidden className="h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-ink" />
            <p className="text-[14px] text-steel-dark">Getting the piece ready…</p>
          </div>
        ) : product ? (
          <GiftForm product={product} initial={initial} sheet />
        ) : (
          <p className="p-6 pt-16 text-[14px]">
            This piece can&apos;t be sent right now.{" "}
            <Link
              href="#buy"
              onClick={onClose}
              className="font-semibold underline underline-offset-2"
            >
              Send a gift card instead
            </Link>
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function label(k: Kind) {
  return k === "trending"
    ? "Trending"
    : k === "one"
      ? "One size"
      : categoryLabels[k];
}

function searchLabel(k: Kind) {
  return `Search ${k === "one" ? "one-size pieces" : label(k).toLowerCase()}`;
}

/** "Gift bag · 2 pieces →", once something is in it. */
function GiftBagLink() {
  const items = useGiftBag();
  if (!items.length) return null;
  return (
    <p className="mt-4 text-center">
      <Link href="/bag?tab=gift" className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-paper">
        <GiftIcon className="h-4 w-4" />
        Gift bag · {items.length === 1 ? "1 piece" : `${items.length} pieces`}
        <span aria-hidden>→</span>
      </Link>
    </p>
  );
}

function kindChip(on: boolean) {
  return `inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[13px] font-semibold transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.97] ${
    on
      ? "border-ink bg-ink text-paper"
      : "border-ink/15 bg-paper hover:border-ink"
  }`;
}
