"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { useAddToBag } from "@/components/bag-gate";
import { encodeFit, type Fit, type SlotKey } from "@/components/fit-builder";
import { useFitProfile } from "@/components/fit-finder";
import { GarmentSvg } from "@/components/product-image";
import { matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import { fitSlot, type Look, type LookPiece } from "@/lib/occasions";
import type { Size } from "@/lib/types";

// "Designer Fits" as a fit check: a scrolling list of occasions at the side, and the outfit drawn
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

/** The wide-screen stage (its height matches the list's xl:h-[480px]): its height, the figure's top and width, and how far from the centre line the tags start. */
const STAGE = { h: 480, top: 62, w: 216, tagAt: 156 };

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
  const [key, setKey] = useState(looks[0]?.key);
  const [picked, setPicked] = useState<Record<string, Size | null>>({});
  const [added, setAdded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const look = looks.find((l) => l.key === key) ?? looks[0];
  if (!look) return null;

  const id = (p: LookPiece) => `${look.key}:${p.slug}`;
  const sizeOf = (p: LookPiece) => (picked[id(p)] !== undefined ? picked[id(p)] : startSize(p, matchSize(p.category, p.measurements, profile)?.size ?? null));
  const total = look.pieces.reduce((n, p) => n + p.price, 0);

  // Head to toe, one piece per place on the body; tags hang left, right, left, right.
  const worn = ORDER.flatMap((slot) => {
    const piece = look.pieces.find((p) => fitSlot(p.category) === slot);
    return piece ? [{ slot, piece }] : [];
  }).map((w, i) => ({ ...w, n: i + 1, side: (i % 2 === 0 ? "left" : "right") as "left" | "right" }));
  const layered = worn.some((w) => w.slot === "layer");

  function addAll() {
    const items = look.pieces.flatMap((p) => {
      const size = sizeOf(p);
      const v = p.sizes.find((x) => x.size === size && x.stock > 0);
      return v && size ? [{ slug: p.slug, sku: v.sku, name: p.name, size, colour: p.colour, price: p.price }] : [];
    });
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
  const long = looks.length > 9;
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
        <div className="md:w-[320px] md:shrink-0">
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">Or make it yours</p>
          <Link
            href={`/fit?${encodeFit(fit)}`}
            className="group flex h-12 w-full items-center justify-between gap-3 whitespace-nowrap rounded-[2px] border border-ink bg-volt px-4 text-[14px] font-semibold uppercase tracking-[0.04em] text-ink transition-shadow duration-200 hover:shadow-[4px_4px_0_0_#0a0a0a]"
          >
            <span className="flex items-center gap-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M12 8a2 2 0 1 0-2-2M12 8v2l9 6.5a1 1 0 0 1-.6 1.8H3.6a1 1 0 0 1-.6-1.8L12 10" />
              </svg>
              Build your own fit
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>

      <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">Ready-made · pick an occasion</p>

      <div className="mt-2 xl:grid xl:grid-cols-[208px_minmax(0,1fr)] xl:gap-3">
        {/* The occasions: a list down the side on wide screens, a row to swipe on small ones. */}
        <div className="relative xl:h-[480px]">
          <div
            ref={listRef}
            role="radiogroup"
            aria-labelledby="occasion-title"
            className={`no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 xl:h-full xl:flex-col xl:gap-1 xl:overflow-y-auto xl:overflow-x-hidden ${long ? "xl:py-12" : ""}`}
          >
            {looks.map((l, i) => {
              const on = l.key === look.key;
              return (
                <button
                  key={l.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={(e) => {
                    setKey(l.key);
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
                  {on && <span aria-hidden className="ml-auto hidden h-2 w-2 bg-volt xl:block" />}
                </button>
              );
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
                {looks.length} fits <Chevron />
              </button>
            </>
          )}
        </div>

        <div>
          {/* Phones, tablets and small laptops: the figure on the left, its tags stacked on the right. */}
          <div className="mt-3 grid grid-cols-[32%_minmax(0,1fr)] items-center gap-2 bg-photo p-3 sm:grid-cols-[38%_minmax(0,1fr)] sm:gap-6 sm:p-6 xl:hidden">
            <div className="pt-[12%]">{figure}</div>
            <ul className="grid gap-2">
              {worn.map((w) => (
                <li key={w.slot}>{tag(w)}</li>
              ))}
            </ul>
          </div>

          {/* Wide screens: the figure in the middle, each tag tied to its garment by a line. */}
          <div className="relative hidden bg-photo xl:block" style={{ height: STAGE.h }}>
            <p className="absolute left-4 top-3 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">
              The {look.label.toLowerCase()} fit · {look.pieces.length} pieces
            </p>
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

      {/* One bar: what the ready-made fit costs, and the button to take it. */}
      <div className="flex flex-col gap-3 border border-mist p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 xl:mt-2">
        <p className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">
            The {look.label.toLowerCase()} fit · {look.pieces.length} pieces
          </span>
          <span className="font-mono text-[24px] font-semibold leading-none tabular-nums">{formatPrice(total)}</span>
        </p>
        <button
          type="button"
          onClick={addAll}
          disabled={!ready}
          aria-label={added ? "Added to your bag" : `Add the fit · ${formatPrice(total)}`}
          className="btn btn-ink h-12 min-h-0 w-full sm:w-[280px]"
        >
          {added ? "Added to your bag" : "Add the fit"}
        </button>
      </div>
    </div>
  );
}
