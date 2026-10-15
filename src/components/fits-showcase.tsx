"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CheckoutForm } from "@/app/checkout/checkout-form";
import { useAddToBag } from "@/components/bag-gate";
import { encodeFit, type Fit, type SlotKey } from "@/components/fit-builder";
import { useFitProfile } from "@/components/fit-finder";
import { BagIcon } from "@/components/icons";
import { GarmentSvg, ProductImage } from "@/components/product-image";
import { FlowButton } from "@/components/ui/flow-button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import { fitSlot, type Look, type LookPiece } from "@/lib/occasions";
import type { BagLine, Size } from "@/lib/types";

// The Fits page as a lookbook (owner, 15 Oct 2026, after four references: a runway of people with
// labelled pieces, callout lines to the garments, and a numbered "fit sheet").
//
//   The runway: every fit, one after another; the one in front is large, with a line from each
//   garment to its name (tap to open the piece); the ones either side wait, faded. Swipe, drag,
//   the arrows or the keys move it; the occasions and fits above jump straight to one.
//   The fit sheet: the fit's name and line, its pieces numbered 01, 02, 03 with sizes, and a bar
//   with the size, colours and total, Add the fit and Quick buy.
//
// A fit the owner photographed (in /admin/looks) shows the photo; otherwise the pieces are drawn on
// a figure, as before.

/** The size to start on: the customer's matched size, else M, else the first one in stock. */
function startSize(p: LookPiece, matched: Size | null): Size | null {
  const ok = (s: Size) => p.sizes.some((x) => x.size === s && x.stock > 0);
  if (matched && ok(matched)) return matched;
  if (ok("M")) return "M";
  return p.sizes.find((x) => x.stock > 0)?.size ?? null;
}

// The drawn figure is a 3:5 box; every garment is placed in percent of it. Back to front.
const WEAR: Record<SlotKey, { box: string; z: number }> = {
  bottom: { box: "left-[11%] top-[46%] w-[78%]", z: 0 },
  top: { box: "left-0 top-[11%] w-full", z: 10 },
  layer: { box: "left-[-3%] top-[5%] w-[106%]", z: 20 },
  cap: { box: "left-[29%] top-[-11%] w-[42%]", z: 30 },
};
/** Head to toe, for numbering. */
const ORDER: SlotKey[] = ["cap", "layer", "top", "bottom"];

/** Where each garment is, in percent of the figure (drawn: 3:5; photo: 4:5, a person standing in the middle). */
function anchor(slot: SlotKey, layered: boolean, photo: boolean): { x: number; y: number } {
  if (photo) {
    if (slot === "cap") return { x: 50, y: 7 };
    if (slot === "layer") return { x: 37, y: 33 };
    if (slot === "top") return layered ? { x: 52, y: 30 } : { x: 44, y: 32 };
    return { x: 46, y: 68 };
  }
  if (slot === "cap") return { x: 50, y: 0 };
  if (slot === "layer") return { x: 16, y: 30 };
  if (slot === "top") return layered ? { x: 50, y: 50 } : { x: 22, y: 32 };
  return { x: 40, y: 76 };
}

interface Worn {
  slot: SlotKey;
  piece: LookPiece;
  n: number;
  side: "left" | "right";
}

function wornOf(look: Look): Worn[] {
  return ORDER.flatMap((slot) => {
    const piece = look.pieces.find((p) => fitSlot(p.category) === slot);
    return piece ? [{ slot, piece }] : [];
  }).map((w, i) => ({ ...w, n: i + 1, side: (i % 2 === 0 ? "left" : "right") as "left" | "right" }));
}

const two = (n: number) => String(n).padStart(2, "0");
const EASE = [0.22, 1, 0.36, 1] as const;

/** One fit, as worn: the photo, or the pieces drawn on a figure. Fills its box. */
function Figure({ look, priority }: { look: Look; priority?: boolean }) {
  if (look.photo)
    return (
      <div className="relative aspect-[4/5] w-full">
        <Image src={look.photo} alt="" fill sizes="(min-width: 768px) 340px, 60vw" priority={priority} className="object-contain object-bottom" />
      </div>
    );
  const worn = wornOf(look);
  return (
    <div className="relative aspect-[3/5] w-full">
      {worn.map(({ slot, piece }) => (
        <div key={slot} className={`absolute ${WEAR[slot].box}`} style={{ zIndex: WEAR[slot].z }}>
          <GarmentSvg category={piece.category} colourHex={piece.hex} className="block w-full drop-shadow-[0_10px_14px_rgba(0,0,0,0.14)]" />
        </div>
      ))}
    </div>
  );
}

export function FitsShowcase({ looks }: { looks: Look[] }) {
  const still = useReducedMotion();
  const addToBagOrLogin = useAddToBag();
  const profile = useFitProfile();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Record<string, Size | null>>({});
  const [added, setAdded] = useState(false);
  const [buying, setBuying] = useState<BagLine[] | null>(null);

  // Opened from an occasion on the home page (/fits#party): start on that occasion's first fit.
  useEffect(() => {
    const want = decodeURIComponent(location.hash.slice(1));
    const at = looks.findIndex((l) => l.group === want);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the hash is only readable once mounted
    if (at > 0) setIndex(at);
  }, [looks]);

  const go = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(looks.length - 1, i));
      setIndex(next);
      setAdded(false);
    },
    [looks.length],
  );

  // Occasions in order, each with its fits (and where they start in the runway).
  const groups = looks.reduce<{ key: string; label: string; fits: { look: Look; at: number }[] }[]>((all, look, at) => {
    const g = all.find((x) => x.key === look.group);
    if (g) g.fits.push({ look, at });
    else all.push({ key: look.group, label: look.groupLabel, fits: [{ look, at }] });
    return all;
  }, []);

  // The runway's size, from its width: the fit in front, and how far apart they stand.
  const runway = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  useLayoutEffect(() => {
    const el = runway.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const look = looks[Math.min(index, looks.length - 1)];
  if (!look) return null;
  const group = groups.find((g) => g.key === look.group)!;

  const wide = width >= 768;
  const figW = wide ? Math.min(300, width * 0.24) : Math.min(190, width * 0.46);
  // Wide: room for the names either side of the one in front. Phones: the next ones peek in.
  const step = wide ? figW * 0.62 + Math.min(260, width * 0.2) : figW * 0.86;

  const id = (p: LookPiece) => `${look.key}:${p.slug}`;
  const sizeOf = (p: LookPiece) => (picked[id(p)] !== undefined ? picked[id(p)] : startSize(p, matchSize(p.category, p.measurements, profile)?.size ?? null));
  const total = look.pieces.reduce((n, p) => n + p.price, 0);
  const worn = wornOf(look);
  const lines = (): BagLine[] =>
    look.pieces.flatMap((p) => {
      const size = sizeOf(p);
      const v = p.sizes.find((x) => x.size === size && x.stock > 0);
      return v && size ? [{ slug: p.slug, sku: v.sku, name: p.name, size, colour: p.colour, price: p.price, qty: 1 }] : [];
    });
  const ready = look.pieces.every((p) => sizeOf(p));
  const fit: Fit = {};
  for (const p of look.pieces) fit[fitSlot(p.category)] = { slug: p.slug, colour: p.colour, size: sizeOf(p) };
  const pick = (p: LookPiece) => (s: Size) => {
    setPicked((m) => ({ ...m, [id(p)]: s }));
    setAdded(false);
  };
  function addAll() {
    const items = lines().map(({ slug, sku, name, size, colour, price }) => ({ slug, sku, name, size, colour, price }));
    if (items.length && addToBagOrLogin(items)) setAdded(true);
  }
  // The size on the bar: the one most of the pieces are in (one-size pieces aside).
  const sized = look.pieces.map(sizeOf).filter((s): s is Size => Boolean(s) && s !== "ONE");
  const usual = sized.sort((a, b) => sized.filter((x) => x === b).length - sized.filter((x) => x === a).length)[0] ?? "One size";
  const colours = Array.from(new Map(look.pieces.map((p) => [p.colour, p.hex])).entries());
  const motionOn = !still;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">Ready-made outfits · {looks.length} fits</p>
          <h2 id="occasion-title" className="display mt-2 text-[clamp(2.4rem,1.6rem+3vw,4.25rem)] leading-[0.9]">
            Designer Fits
          </h2>
        </div>
        <FlowButton href={`/fit?${encodeFit(fit)}`} text="Build your own fit" className="w-full md:w-auto md:shrink-0" />
      </div>

      {/* The occasions, then the fits inside the chosen one */}
      <div role="radiogroup" aria-labelledby="occasion-title" className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {groups.map((g, i) => {
          const on = g.key === group.key;
          return (
            <button
              key={g.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => go(g.fits[0].at)}
              className={`relative flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors duration-200 ${on ? "text-paper" : "text-ink hover:bg-mist"}`}
            >
              {on && <motion.span layoutId="fits-occasion" aria-hidden className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              <span aria-hidden className={`relative font-mono text-[11px] font-normal ${on ? "text-paper/60" : "text-steel-dark"}`}>
                {two(i + 1)}
              </span>
              <span className="relative">{g.label}</span>
            </button>
          );
        })}
      </div>
      {group.fits.length > 1 && (
        <div role="radiogroup" aria-label={`${group.label} fits`} className="no-scrollbar -mx-4 mt-1 flex gap-5 overflow-x-auto px-4 md:mx-0 md:px-1">
          {group.fits.map(({ look: l, at }) => {
            const on = at === index;
            return (
              <button
                key={l.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => go(at)}
                className={`relative h-10 shrink-0 cursor-pointer text-[14px] transition-colors ${on ? "font-semibold text-ink" : "text-steel-dark hover:text-ink"}`}
              >
                {l.label}
                {on && <motion.span layoutId="fits-fit" aria-hidden className="absolute inset-x-0 bottom-1 h-[2px] bg-ink" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              </button>
            );
          })}
        </div>
      )}

      {/* The runway */}
      <div
        ref={runway}
        role="region"
        aria-roledescription="carousel"
        aria-label="Fits, one after another"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          else if (e.key === "ArrowLeft") go(index - 1);
        }}
        className="relative mx-[calc(50%-50vw)] mt-1 select-none overflow-hidden outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-ink)]"
        style={{ height: (look.photo ? figW * 1.25 : figW * (5 / 3)) + (wide ? 60 : 50) }}
      >
        {/* The floor they stand on */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[18%] bg-[radial-gradient(60%_55%_at_50%_100%,rgba(10,10,10,0.07),rgba(10,10,10,0)_70%)]" />
        <motion.div
          className="absolute inset-0 touch-pan-y"
          onPanEnd={(_, info) => {
            if (info.offset.x < -40 || info.velocity.x < -400) go(index + 1);
            else if (info.offset.x > 40 || info.velocity.x > 400) go(index - 1);
          }}
        >
          {looks.map((l, i) => {
            const d = i - index;
            if (Math.abs(d) > 3) return null;
            const front = d === 0;
            const sw = front ? figW : figW * 0.7;
            return (
              <motion.button
                key={l.key}
                type="button"
                tabIndex={-1}
                aria-hidden={!front}
                aria-label={front ? undefined : `${l.groupLabel} · ${l.label}`}
                onClick={() => !front && go(i)}
                initial={false}
                animate={{ x: d * step - sw / 2, width: sw, opacity: front ? 1 : Math.abs(d) === 1 ? 0.5 : 0.2, filter: front ? "blur(0px)" : "blur(1.5px)" }}
                transition={motionOn ? { type: "spring", stiffness: 170, damping: 26, mass: 0.9 } : { duration: 0 }}
                className={`absolute bottom-6 left-1/2 ${front ? "z-10 cursor-default" : "cursor-pointer"}`}
              >
                <motion.div initial={false} animate={{ scale: 1 }} className="origin-bottom">
                  <Figure look={l} priority={Math.abs(d) <= 1} />
                </motion.div>
                <span aria-hidden className="absolute -bottom-3 left-1/2 h-3 w-[70%] -translate-x-1/2 rounded-[50%] bg-ink/10 blur-[6px]" />
              </motion.button>
            );
          })}

          {/* The one in front: a line from each garment to its name */}
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-20" style={{ width: figW, marginLeft: -figW / 2 }}>
            <div className={`relative w-full ${look.photo ? "aspect-[4/5]" : "aspect-[3/5]"}`}>
              <AnimatePresence mode="wait">
                <motion.div key={look.key} className="absolute inset-0" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                  {worn.map((w, k) => {
                    const a = anchor(w.slot, worn.some((x) => x.slot === "layer"), Boolean(look.photo));
                    const delay = motionOn ? 0.28 + k * 0.09 : 0;
                    const left = w.side === "left";
                    const reach = wide ? Math.min(150, width * 0.12) : 0;
                    // From the garment out past the figure's edge.
                    const edge = left ? (a.x / 100) * figW + 18 : ((100 - a.x) / 100) * figW + 18;
                    return (
                      <div key={w.slot} className="absolute" style={{ left: `${a.x}%`, top: `${a.y}%` }}>
                        {/* The dot on the garment */}
                        <motion.span
                          aria-hidden
                          initial={motionOn ? { scale: 0 } : false}
                          animate={{ scale: 1 }}
                          transition={{ delay, type: "spring", stiffness: 500, damping: 22 }}
                          className="absolute -left-[9px] -top-[9px] grid h-[18px] w-[18px] place-items-center rounded-full bg-paper shadow-[0_0_0_1px_rgba(10,10,10,0.18),0_4px_10px_-2px_rgba(10,10,10,0.35)]"
                        >
                          {wide ? <span className="h-1.5 w-1.5 rounded-full bg-ink" /> : <span className="font-mono text-[9px] font-semibold leading-none">{w.n}</span>}
                          {motionOn && <span className="absolute inset-0 animate-ping rounded-full bg-paper/70 [animation-duration:2.4s]" />}
                        </motion.span>
                        {wide && (
                          <>
                            <motion.span
                              aria-hidden
                              initial={motionOn ? { scaleX: 0 } : false}
                              animate={{ scaleX: 1 }}
                              transition={{ delay: delay + 0.08, duration: 0.45, ease: EASE }}
                              className={`absolute top-0 h-px bg-ink/45 ${left ? "right-[9px] origin-right" : "left-[9px] origin-left"}`}
                              style={{ width: edge + reach - 9 }}
                            />
                            <motion.div
                              initial={motionOn ? { opacity: 0, x: left ? 10 : -10 } : false}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: delay + 0.3, duration: 0.35, ease: EASE }}
                              className="pointer-events-auto absolute -top-[17px]"
                              style={left ? { right: edge + reach } : { left: edge + reach }}
                            >
                              <Link
                                href={`/product/${w.piece.slug}`}
                                className="group flex w-max max-w-[200px] items-center gap-2 rounded-full bg-paper/90 py-1.5 pl-3 pr-2 text-[13px] font-semibold shadow-[0_8px_22px_-14px_rgba(10,10,10,0.55),0_0_0_1px_rgba(10,10,10,0.08)] backdrop-blur transition-[background-color] hover:bg-paper"
                              >
                                <span className="font-mono text-[10.5px] font-normal text-steel-dark">{two(w.n)}</span>
                                <span className="truncate">{w.piece.name}</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                                  <path d="M7 17L17 7M9 7h8v8" />
                                </svg>
                              </Link>
                            </motion.div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Arrows (wide screens; phones swipe) */}
        {wide && (
          <>
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous fit" className="absolute left-[max(16px,calc(50vw-620px))] top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-paper shadow-[0_10px_26px_-14px_rgba(10,10,10,0.5),0_0_0_1px_rgba(10,10,10,0.08)] transition-[opacity,scale] hover:scale-105 disabled:pointer-events-none disabled:opacity-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={() => go(index + 1)} disabled={index === looks.length - 1} aria-label="Next fit" className="absolute right-[max(16px,calc(50vw-620px))] top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-paper shadow-[0_10px_26px_-14px_rgba(10,10,10,0.5),0_0_0_1px_rgba(10,10,10,0.08)] transition-[opacity,scale] hover:scale-105 disabled:pointer-events-none disabled:opacity-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </>
        )}
      </div>

      {/* Where you are: a dot per fit, grouped by occasion */}
      <div aria-hidden className="mt-1 flex justify-center gap-3">
        {groups.map((g) => (
          <span key={g.key} className="flex gap-1">
            {g.fits.map(({ at }) => (
              <span key={at} className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${at === index ? "w-5 bg-ink" : "w-1.5 bg-ink/20"}`} />
            ))}
          </span>
        ))}
      </div>

      {/* The fit sheet */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.article
          key={look.key}
          aria-label={`${look.groupLabel} · ${look.label}`}
          initial={motionOn ? { opacity: 0, y: 14 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={motionOn ? { opacity: 0, y: -8, transition: { duration: 0.15 } } : undefined}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-8 overflow-hidden rounded-[22px] border border-ink/12 bg-paper shadow-[0_30px_60px_-44px_rgba(10,10,10,0.5)]"
        >
          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-8 lg:p-8">
            {/* The name and the line */}
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">
                {two(groups.indexOf(group) + 1)} · {look.groupLabel}
              </p>
              <h3 className="display mt-2 text-[clamp(2.6rem,2rem+2.6vw,4rem)] leading-[0.88]">{look.label}</h3>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">
                {look.curated ? "Designer's pick · " : "From the rack · "}
                {look.pieces.length} pieces
              </p>
              <span aria-hidden className="mt-4 block h-[3px] w-14 bg-ink" />
              <p className="mt-4 max-w-[28ch] text-[15px] leading-snug text-ink/80">{look.note}</p>
              <ul className="mt-5 hidden gap-2 text-[12.5px] text-steel-dark lg:grid">
                <li className="flex items-center gap-2"><Tick /> Sizes matched to you when you&apos;ve told us</li>
                <li className="flex items-center gap-2"><Tick /> Swap a size within 14 days</li>
                <li className="flex items-center gap-2"><Tick /> Every piece in stock now</li>
              </ul>
            </div>

            {/* The pieces, numbered */}
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
              {worn.map((w, k) => (
                <motion.li
                  key={w.slot}
                  initial={motionOn ? { opacity: 0, y: 12 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: motionOn ? 0.08 + k * 0.07 : 0, duration: 0.4, ease: EASE }}
                  className="flex gap-3 rounded-2xl border border-dashed border-ink/25 p-2.5 sm:flex-col sm:p-3"
                >
                  <Link href={`/product/${w.piece.slug}`} className="group relative block w-[34%] shrink-0 overflow-hidden rounded-xl bg-[#efefef] sm:w-full">
                    <span className="absolute left-0 top-0 z-10 grid h-7 min-w-8 place-items-center rounded-br-lg bg-ink px-1.5 font-mono text-[12px] font-semibold text-paper">{two(w.n)}</span>
                    <span className="block aspect-[4/5] transition-transform duration-500 group-hover:scale-[1.03]">
                      <ProductImage image={w.piece.image} category={w.piece.category} colourHex={w.piece.hex} decorative sizes="(min-width: 1280px) 220px, (min-width: 640px) 40vw, 34vw" />
                    </span>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${w.piece.slug}`} className="block text-[13px] font-semibold uppercase leading-tight tracking-[0.04em] underline-offset-4 hover:underline">
                      {w.piece.name}
                    </Link>
                    <p className="mt-1 flex items-center gap-2 text-[12.5px] text-steel-dark">
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-ink/15" style={{ background: w.piece.hex }} />
                      {w.piece.colour}
                      <span className="ml-auto font-mono text-[13px] tabular-nums text-ink">{formatPrice(w.piece.price)}</span>
                    </p>
                    <Sizes piece={w.piece} size={sizeOf(w.piece)} onPick={pick(w.piece)} />
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>

          {/* The bar: size, colours, total; Add the fit and Quick buy */}
          <div className="grid grid-cols-3 border-t border-ink/12 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <Cell label="Size">
              <span className="display text-[34px] leading-none">{usual}</span>
            </Cell>
            <Cell label="Colours" divided>
              <span className="flex flex-wrap gap-1.5 pt-1">
                {colours.map(([name, hex]) => (
                  <span key={name} title={name} className="h-4 w-4 rounded-full ring-1 ring-ink/15" style={{ background: hex }} />
                ))}
              </span>
            </Cell>
            <Cell label={`Fit total · ${look.pieces.length} pieces`} divided>
              <span className="font-mono text-[22px] font-semibold leading-none tabular-nums sm:text-[26px]">{formatPrice(total)}</span>
            </Cell>
            <div className="col-span-3 flex gap-2 border-t border-ink/12 p-3 sm:p-4 lg:col-span-1 lg:border-l lg:border-t-0">
              <button
                type="button"
                onClick={addAll}
                disabled={!ready}
                aria-label={added ? "Added to your bag" : `Add the fit · ${formatPrice(total)}`}
                className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ink px-5 text-[13px] font-semibold uppercase tracking-[0.06em] text-paper transition-[background-color,scale] hover:bg-[#2c2c2e] active:scale-[0.98] disabled:opacity-40 lg:flex-none"
              >
                {added ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                ) : (
                  <BagIcon className="h-4 w-4" />
                )}
                {added ? "In your bag" : "Add the fit"}
              </button>
              <FlowButton onClick={() => setBuying(lines())} disabled={!ready} text="Quick buy" aria-label={`Quick buy the fit · ${formatPrice(total)}`} className="flex-1 px-4 lg:flex-none lg:px-8" />
            </div>
          </div>
        </motion.article>
      </AnimatePresence>

      {/* Quick buy: the whole fit in one order, paid here, no account needed. */}
      <Sheet open={buying !== null} onOpenChange={(o) => !o && setBuying(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto border-mist bg-paper p-5 pt-6 sm:max-w-md">
          <SheetTitle className="display text-[34px] leading-none">Buy the fit</SheetTitle>
          {buying && (
            <>
              <SheetDescription className="mt-2 text-[14px] text-steel-dark">
                {look.groupLabel} · {look.label} · {buying.map((l) => (l.size === "ONE" ? l.name : `${l.name} ${l.size}`)).join(", ")}
              </SheetDescription>
              <CheckoutForm buyNow={buying} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Cell({ label, divided, children }: { label: string; divided?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 p-3 sm:p-4 ${divided ? "border-l border-ink/12" : ""}`}>
      <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-steel-dark">{label}</span>
      {children}
    </div>
  );
}

const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden className="shrink-0 text-ink">
    <path d="M5 12l5 5 9-10" />
  </svg>
);

function Sizes({ piece, size, onPick }: { piece: LookPiece; size: Size | null; onPick: (s: Size) => void }) {
  if (piece.sizes.length === 1 && piece.sizes[0].size === "ONE") return <p className="mt-2 font-mono text-[12px] text-steel-dark">One size</p>;
  return (
    <div role="radiogroup" aria-label={`Size for ${piece.name}`} className="mt-2 flex flex-wrap gap-1">
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
            className={`h-9 min-w-9 cursor-pointer rounded-lg border px-1.5 font-mono text-[12.5px] font-semibold transition-colors ${
              on ? "border-ink bg-ink text-paper" : out ? "cursor-default border-mist bg-photo text-[#aeaeb2] line-through" : "border-ink/15 hover:border-ink"
            }`}
          >
            {s.size}
          </button>
        );
      })}
    </div>
  );
}
