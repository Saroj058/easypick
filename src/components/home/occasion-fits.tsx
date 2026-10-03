"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { CheckoutForm } from "@/app/checkout/checkout-form";
import { useAddToBag } from "@/components/bag-gate";
import { encodeFit, type Fit, type SlotKey } from "@/components/fit-builder";
import { useFitProfile } from "@/components/fit-finder";
import { GarmentSvg } from "@/components/product-image";
import { FlowButton } from "@/components/ui/flow-button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import { fitSlot, type Look, type LookPiece } from "@/lib/occasions";
import type { BagLine, Size } from "@/lib/types";

// "Designer Fits" as a fit check: the occasions down the side with the fits of the chosen one
// listed under it (Party: night out, house party, birthday; tabs on smaller screens), and the outfit drawn
// the way it's worn (jacket over tee over joggers) on a grey stage, each piece tied to a hang
// tag with its name, price and sizes. Numbers on the garments match the numbers on the tags.

/** The size to start on: the customer's matched size, else M, else the first one in stock. */
function startSize(p: LookPiece, matched: Size | null): Size | null {
  const ok = (s: Size) => p.sizes.some((x) => x.size === s && x.stock > 0);
  if (matched && ok(matched)) return matched;
  if (ok("M")) return "M";
  return p.sizes.find((x) => x.stock > 0)?.size ?? null;
}

// The figure is a 300×500 box; every garment is placed in percent of it so it scales on phones.
// Drawn back to front: joggers, tee (its hem shows under a jacket), jacket, cap.
const WEAR: Record<SlotKey, { box: string; z: number }> = {
  bottom: { box: "left-[11%] top-[46%] w-[78%]", z: 0 },
  top: { box: "left-0 top-[11%] w-full", z: 10 },
  layer: { box: "left-[-3%] top-[5%] w-[106%]", z: 20 },
  cap: { box: "left-[29%] top-[-11%] w-[42%]", z: 30 },
};
/** Head to toe, for numbering and for which side a tag hangs on. */
const ORDER: SlotKey[] = ["cap", "layer", "top", "bottom"];

/** Where a piece's number sits on the figure, in percent of the figure box. */
function anchor(slot: SlotKey, side: "left" | "right", layered: boolean): { x: number; y: number } {
  const x = (l: number) => (side === "left" ? l : 100 - l);
  if (slot === "cap") return { x: x(40), y: 5 };
  if (slot === "layer") return { x: x(18), y: 30 };
  if (slot === "top") return layered ? { x: x(32), y: 58.5 } : { x: x(20), y: 34 };
  return { x: x(36), y: 78 };
}

/** The wide-screen stage (with the 44px tabs above it, it matches the list's xl:h-[480px]): its height, the figure's top and width, and how far from the centre line the tags start. */
const STAGE = { h: 436, top: 46, w: 208, tagAt: 152 };

const badge = "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-volt font-mono text-[11px] font-semibold leading-none text-ink";

function Sizes({ piece, size, onPick }: { piece: LookPiece; size: Size | null; onPick: (s: Size) => void }) {
  if (piece.sizes.length === 1 && piece.sizes[0].size === "ONE") return <p className="mt-2 font-mono text-[12px] text-steel-dark">One size</p>;
  return (
    <div role="radiogroup" aria-label={`Size for ${piece.name}`} className="mt-2 flex flex-wrap gap-1 sm:gap-1.5">
      {piece.sizes.map((s) => {
        const out = s.stock <= 0;
        const on = size === s.size;
        return (
          <button
            key={s.size}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${s.size}${out ? ", sold out" : ""}`}
            disabled={out}
            onClick={() => onPick(s.size)}
            className={`h-11 min-w-11 border px-1 font-mono text-[13px] font-semibold ${
              on ? "border-ink bg-ink text-paper" : out ? "border-mist bg-photo text-[#aeaeb2] line-through" : "border-mist hover:border-ink"
            }`}
          >
            {s.size}
          </button>
        );
      })}
    </div>
  );
}

const Chevron = ({ up = false }: { up?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={up ? "rotate-180" : ""}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export function OccasionFits({ looks, curated }: { looks: Look[]; curated: boolean }) {
  const addToBagOrLogin = useAddToBag();
  const profile = useFitProfile();
  const [group, setGroup] = useState(looks[0]?.group);
  /** The fit last opened in each occasion, so coming back to one shows what was there. */
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, Size | null>>({});
  const [added, setAdded] = useState(false);
  /** The fit being bought with Quick buy, in the checkout pop-up. */
  const [buying, setBuying] = useState<BagLine[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Occasions in the order they come, each with its fits.
  const groups = looks.reduce<{ key: string; label: string; fits: Look[] }[]>((all, l) => {
    const g = all.find((x) => x.key === l.group);
    if (g) g.fits.push(l);
    else all.push({ key: l.group, label: l.groupLabel, fits: [l] });
    return all;
  }, []);
  const current = groups.find((g) => g.key === group) ?? groups[0];
  if (!current) return null;
  const look = current.fits.find((l) => l.key === chosen[current.key]) ?? current.fits[0];

  const id = (p: LookPiece) => `${look.key}:${p.slug}`;
  const sizeOf = (p: LookPiece) => (picked[id(p)] !== undefined ? picked[id(p)] : startSize(p, matchSize(p.category, p.measurements, profile)?.size ?? null));
  const total = look.pieces.reduce((n, p) => n + p.price, 0);

  // Head to toe, one piece per place on the body; tags hang left, right, left, right.
  const worn = ORDER.flatMap((slot) => {
    const piece = look.pieces.find((p) => fitSlot(p.category) === slot);
    return piece ? [{ slot, piece }] : [];
  }).map((w, i) => ({ ...w, n: i + 1, side: (i % 2 === 0 ? "left" : "right") as "left" | "right" }));
  const layered = worn.some((w) => w.slot === "layer");

  /** One of each piece, in the size picked on its tag. */
  const lines = (): BagLine[] =>
    look.pieces.flatMap((p) => {
      const size = sizeOf(p);
      const v = p.sizes.find((x) => x.size === size && x.stock > 0);
      return v && size ? [{ slug: p.slug, sku: v.sku, name: p.name, size, colour: p.colour, price: p.price, qty: 1 }] : [];
    });

  function addAll() {
    const items = lines().map(({ qty: _qty, ...line }) => line);
    if (items.length && addToBagOrLogin(items)) setAdded(true);
  }

  const fit: Fit = {};
  for (const p of look.pieces) fit[fitSlot(p.category)] = { slug: p.slug, colour: p.colour, size: sizeOf(p) };
  const ready = look.pieces.every((p) => sizeOf(p));
  const pick = (p: LookPiece) => (s: Size) => {
    setPicked((m) => ({ ...m, [id(p)]: s }));
    setAdded(false);
  };
  // The side list fits about nine occasions on a wide screen; longer lists get scroll buttons.
  const long = groups.length > 9;
  const named = `${current.label} · ${look.label}`;
  const fitTabs = current.fits.length > 1 && (
    <div role="radiogroup" aria-label={`${current.label} fits`} className="no-scrollbar flex overflow-x-auto">
      {current.fits.map((l) => {
        const on = l.key === look.key;
        return (
          <button
            key={l.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              setChosen((m) => ({ ...m, [current.key]: l.key }));
              setAdded(false);
            }}
            className={`relative h-11 shrink-0 whitespace-nowrap px-4 text-[14px] font-semibold ${on ? "text-ink" : "text-steel-dark hover:text-ink"}`}
          >
            {l.label}
            {on && <span aria-hidden className="absolute inset-x-3 bottom-0 h-[3px] bg-ink" />}
          </button>
        );
      })}
    </div>
  );
  /** The up and down buttons beside the list (it also scrolls by touch, wheel and keys). */
  const scrollList = (dir: 1 | -1) => listRef.current?.scrollBy({ top: dir * 176, left: dir * 240, behavior: "smooth" });

  const figure = (
    <div key={look.key} aria-hidden className="relative aspect-[3/5] w-full animate-fade-up">
      {worn.map(({ slot, piece }) => (
        <div key={slot} className={`absolute ${WEAR[slot].box}`} style={{ zIndex: WEAR[slot].z }}>
          <GarmentSvg category={piece.category} colourHex={piece.hex} className="block w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.12)]" />
        </div>
      ))}
      {worn.map(({ slot, n, side }) => {
        const a = anchor(slot, side, layered);
        return (
          <span key={slot} className={`${badge} absolute z-40 -translate-x-1/2 -translate-y-1/2`} style={{ left: `${a.x}%`, top: `${a.y}%` }}>
            {n}
          </span>
        );
      })}
    </div>
  );

  const tag = (w: (typeof worn)[number]) => (
    <div className="relative border border-mist bg-paper p-3 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.5)] sm:p-4 xl:p-3">
      <div className="flex items-center gap-2">
        <span className={badge} aria-hidden>
          {w.n}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-steel-dark">{w.piece.colour}</span>
        <span className="ml-auto font-mono text-[14px] tabular-nums">{formatPrice(w.piece.price)}</span>
      </div>
      <Link href={`/product/${w.piece.slug}`} className="mt-1.5 block text-[15px] font-semibold leading-tight decoration-1 sm:text-[17px] xl:text-[15px] underline-offset-4 hover:underline">
        {w.piece.name}
      </Link>
      <Sizes piece={w.piece} size={sizeOf(w.piece)} onPick={pick(w.piece)} />
    </div>
  );

  return (
    <div>
      {/* Two ways in: pick a ready-made fit below, or build your own (top right). */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <h2 id="occasion-title" className="display text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[0.92]">
            Designer Fits
          </h2>
          <p className="mt-1.5 text-[15px] text-steel-dark">{curated ? "Curated combinations for every occasion." : "Ready-made combinations for every occasion."}</p>
        </div>
        {/* Opens the builder with the fit on show, ready to swap pieces. */}
        <FlowButton href={`/fit?${encodeFit(fit)}`} text="Build your own fit" className="w-full md:w-auto md:shrink-0" />
      </div>

      <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">Ready-made · pick an occasion, then a fit</p>

      <div className="mt-2 xl:grid xl:grid-cols-[208px_minmax(0,1fr)] xl:gap-3">
        {/* The occasions: a list down the side on wide screens, a row to swipe on small ones. */}
        <div className="relative xl:h-[480px]">
          <div
            ref={listRef}
            role="radiogroup"
            aria-labelledby="occasion-title"
            className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 xl:h-full xl:flex-col xl:gap-1 xl:overflow-y-auto xl:overflow-x-hidden ${long ? "xl:py-12" : ""}`}
          >
            {groups.map((l, i) => {
              const on = l.key === current.key;
              return [
                <button
                  key={l.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={(e) => {
                    setGroup(l.key);
                    setAdded(false);
                    e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
                  }}
                  className={`flex h-11 shrink-0 items-center gap-3 whitespace-nowrap border px-4 text-left text-[15px] font-semibold xl:w-full xl:text-[14px] ${
                    on ? "border-ink bg-ink text-paper" : "border-mist bg-paper hover:border-ink"
                  }`}
                >
                  <span aria-hidden className={`font-mono text-[11px] font-normal ${on ? "text-paper/60" : "text-steel-dark"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {l.label}
                  <span aria-hidden className={`ml-auto hidden font-mono text-[11px] font-normal xl:block ${on ? "text-paper/60" : "text-steel-dark"}`}>
                    {l.fits.length} {l.fits.length === 1 ? "fit" : "fits"}
                  </span>
                </button>,
                // Wide screens: the chosen occasion's fits open under it (smaller screens have them as tabs over the stage).
                on && l.fits.length > 1 && (
                  <div key={`${l.key}-fits`} role="radiogroup" aria-label={`${l.label} fits`} className="hidden animate-fade-up flex-col border-l-2 border-ink pl-1 xl:flex">
                    {l.fits.map((f) => {
                      const sel = f.key === look.key;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          onClick={() => {
                            setChosen((m) => ({ ...m, [l.key]: f.key }));
                            setAdded(false);
                          }}
                          className={`flex h-10 w-full items-center gap-2 px-3 text-left text-[14px] ${sel ? "font-semibold text-ink" : "text-steel-dark hover:text-ink"}`}
                        >
                          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${sel ? "bg-ink" : "bg-mist"}`} />
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                ),
              ];
            })}
          </div>
          {/* Scroll buttons, only when the list is longer than the stage is tall. */}
          {long && (
            <>
              <button
                type="button"
                onClick={() => scrollList(-1)}
                aria-label="Earlier occasions"
                className="absolute inset-x-0 top-0 hidden h-11 items-center justify-center border border-mist bg-paper hover:border-ink xl:flex"
              >
                <Chevron up />
              </button>
              <button
                type="button"
                onClick={() => scrollList(1)}
                aria-label="More occasions"
                className="absolute inset-x-0 bottom-0 hidden h-11 items-center justify-center gap-2 border border-mist bg-paper text-[13px] font-semibold hover:border-ink xl:flex"
              >
                {groups.length} occasions <Chevron />
              </button>
            </>
          )}
        </div>

        <div>
          {/* The fits inside this occasion, and whose pick this one is. */}
          <div className="mt-2 flex h-11 items-center justify-between gap-3 border border-mist xl:mt-0 xl:border-b-0">
            {fitTabs ? (
              <>
                <div className="min-w-0 xl:hidden">{fitTabs}</div>
                <p className="hidden px-4 text-[14px] font-semibold xl:block">{look.label}</p>
              </>
            ) : (
              <p className="px-4 text-[14px] font-semibold">{look.label}</p>
            )}
            <p className="hidden shrink-0 pr-4 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark sm:block">
              {look.curated ? "Designer's pick · " : ""}
              {look.pieces.length} pieces
            </p>
          </div>

          {/* Phones, tablets and small laptops: the figure on the left, its tags stacked on the right. */}
          <div className="grid grid-cols-[32%_minmax(0,1fr)] items-center gap-2 bg-photo p-3 sm:grid-cols-[38%_minmax(0,1fr)] sm:gap-6 sm:p-6 xl:hidden">
            <div className="pt-[12%]">{figure}</div>
            <ul className="grid gap-2">
              {worn.map((w) => (
                <li key={w.slot}>{tag(w)}</li>
              ))}
            </ul>
          </div>

          {/* Wide screens: the figure in the middle, each tag tied to its garment by a line. */}
          <div className="relative hidden bg-photo xl:block" style={{ height: STAGE.h }}>
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: STAGE.top, width: STAGE.w }}>
              {figure}
            </div>
            {worn.map((w) => {
              const a = anchor(w.slot, w.side, layered);
              const y = STAGE.top + (a.y / 100) * STAGE.w * (5 / 3); // the figure box is 3:5
              const fromCentre = Math.abs(a.x - 50) * (STAGE.w / 100) + 12; // px from the centre line to just past the number
              const line = { top: y, width: STAGE.tagAt - fromCentre };
              return (
                <div key={w.slot}>
                  <span
                    aria-hidden
                    className="absolute h-px bg-ink/50"
                    style={w.side === "left" ? { ...line, right: `calc(50% + ${fromCentre}px)` } : { ...line, left: `calc(50% + ${fromCentre}px)` }}
                  />
                  <div className="absolute w-[224px]" style={w.side === "left" ? { top: y - 26, right: `calc(50% + ${STAGE.tagAt}px)` } : { top: y - 26, left: `calc(50% + ${STAGE.tagAt}px)` }}>
                    {tag(w)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* One bar: which fit this is on the left; on the right, buy it now, what it costs, or add it to the bag. */}
      <div className="flex flex-col gap-3 border border-mist p-3 md:flex-row md:items-center md:justify-between md:px-5 xl:mt-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">
          {named} · {look.pieces.length} pieces
        </p>
        <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
          <button
            type="button"
            onClick={() => setBuying(lines())}
            disabled={!ready}
            aria-label={`Quick buy the fit · ${formatPrice(total)}`}
            className="btn btn-outline h-12 min-h-0 px-5"
          >
            Quick buy
          </button>
          <span className="ml-auto font-mono text-[24px] font-semibold leading-none tabular-nums md:ml-0">{formatPrice(total)}</span>
          <button
            type="button"
            onClick={addAll}
            disabled={!ready}
            aria-label={added ? "Added to your bag" : `Add the fit · ${formatPrice(total)}`}
            className="btn btn-ink h-12 min-h-0 w-full md:w-[240px]"
          >
            {added ? "Added to your bag" : "Add the fit"}
          </button>
        </div>
      </div>

      {/* Quick buy: the whole fit in one order, paid here, no account needed. */}
      <Sheet open={buying !== null} onOpenChange={(o) => !o && setBuying(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto border-mist bg-paper p-5 pt-6 sm:max-w-md">
          <SheetTitle className="display text-[34px] leading-none">Buy the fit</SheetTitle>
          {buying && (
            <>
              <SheetDescription className="mt-2 text-[14px] text-steel-dark">
                {named} · {buying.map((l) => (l.size === "ONE" ? l.name : `${l.name} ${l.size}`)).join(", ")}
              </SheetDescription>
              <CheckoutForm buyNow={buying} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
