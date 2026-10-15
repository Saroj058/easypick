"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useAddToBag } from "@/components/bag-gate";
import { openBuyNow } from "@/components/buy-sheets";
import { encodeFit, type Fit, type SlotKey } from "@/components/fit-builder";
import { useFitProfile } from "@/components/fit-finder";
import { BagIcon } from "@/components/icons";
import { ProductImage, standInSrc } from "@/components/product-image";
import { matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import { fitSlot, type Look, type LookPiece } from "@/lib/occasions";
import type { BagLine, Size } from "@/lib/types";

// Designer Fits, one full screen (owner, 16 Oct 2026; planned against the owner's references: a
// runway of people with labelled pieces, callout lines, a numbered lookbook sheet, and a minimal
// full-screen storefront).
//
//   Left: the occasions, and the fits inside the chosen one.
//   Centre: the fit laid out head to toe from the pieces' own cut-out photos (public/rack), its
//   name huge and faint behind it, and a line drawn from each garment to the piece's name on a
//   rail either side (tap to open it). Under it: a line of facts and a progress track.
//   Right: the fit's story, its pieces numbered 01, 02, 03 (size, swap: hover an alternative to
//   see it on the figure, tap to keep it), and the total with Add the fit and Quick buy.
// A change of fit is choreographed: pieces slide out the way you're going, the new ones come in
// head to toe, the dots pop, the lines draw, the names fade in. A fit the owner photographed (in
// /admin/looks) shows the photo instead of the lay.

const EASE = [0.22, 1, 0.36, 1] as const;
const two = (n: number) => String(n).padStart(2, "0");
const SLOT_NAME: Record<SlotKey, string> = { cap: "cap", layer: "jacket", top: "top", bottom: "bottom" };
/** Head to toe. */
const ORDER: SlotKey[] = ["cap", "layer", "top", "bottom"];

/** The size to start on: the customer's matched size, else M, else the first one in stock. */
function startSize(p: LookPiece, matched: Size | null): Size | null {
  const ok = (s: Size) => p.sizes.some((x) => x.size === s && x.stock > 0);
  if (matched && ok(matched)) return matched;
  if (ok("M")) return "M";
  return p.sizes.find((x) => x.stock > 0)?.size ?? null;
}

// The lay: a 10:17 box; each piece's box in percent of it [x0, y0, x1, y1], its layer and tilt,
// and where its line starts (percent of its own box).
type Box = { b: [number, number, number, number]; z: number; r: number; at: [number, number]; align: "top" | "bottom" | "center" };
function boxOf(slot: SlotKey, layered: boolean): Box {
  if (slot === "cap") return { b: [33, 0, 67, 14], z: 40, r: -6, at: [50, 45], align: "center" };
  if (slot === "layer") return { b: [4, 11, 78, 55], z: 30, r: -3, at: [28, 38], align: "bottom" };
  if (slot === "top") return layered ? { b: [26, 14, 96, 58], z: 20, r: 3, at: [80, 30], align: "bottom" } : { b: [12, 12, 88, 56], z: 20, r: 0, at: [28, 32], align: "bottom" };
  return { b: [24, 49, 76, 93], z: 10, r: 0, at: [40, 28], align: "top" };
}
/** On a photo (4:5, a person standing in the middle): where each garment is, in percent of the photo. */
const PHOTO_AT: Record<SlotKey, [number, number]> = { cap: [50, 7], layer: [37, 33], top: [55, 31], bottom: [46, 68] };
/** Which rail a piece's name goes on. */
const SIDE: Record<SlotKey, "left" | "right"> = { cap: "right", layer: "left", top: "right", bottom: "left" };

interface Worn {
  slot: SlotKey;
  piece: LookPiece;
  n: number;
}
function wornOf(look: Look): Worn[] {
  return ORDER.flatMap((slot) => {
    const piece = look.pieces.find((p) => fitSlot(p.category) === slot);
    return piece ? [{ slot, piece }] : [];
  }).map((w, i) => ({ ...w, n: i + 1 }));
}

/** The fit told as a sentence, from its pieces. */
function storyOf(look: Look): string {
  const by = (slot: SlotKey) => look.pieces.find((p) => fitSlot(p.category) === slot);
  const name = (p: LookPiece) => `the ${p.name} in ${p.colour.toLowerCase()}`;
  const [layer, top, bottom, cap] = [by("layer"), by("top"), by("bottom"), by("cap")];
  const parts: string[] = [];
  if (layer && top) parts.push(`${name(layer)} over ${name(top)}`);
  else if (layer || top) parts.push(name((layer ?? top)!));
  if (bottom) parts.push(`${parts.length ? "with " : ""}${name(bottom)}`);
  if (cap) parts.push(`${parts.length ? "and " : ""}${name(cap)} to finish`);
  const s = parts.join(", ");
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}.` : "";
}

/** A piece as photographed and cut out; in another colour, its stand-in dyed that colour. */
function PieceArt({ piece, align, eager }: { piece: LookPiece; align: Box["align"]; eager?: boolean }) {
  const pos = align === "top" ? "object-top" : align === "bottom" ? "object-bottom" : "object-center";
  if (piece.cutout)
    // eslint-disable-next-line @next/next/no-img-element -- a transparent cut-out, drawn at whatever size the lay gives it
    return <img src={piece.cutout} alt="" draggable={false} loading={eager ? "eager" : "lazy"} className={`absolute inset-0 h-full w-full object-contain ${pos}`} />;
  const src = standInSrc(piece.name, piece.category);
  if (!src) return null;
  const mask = { maskImage: `url(${src})`, WebkitMaskImage: `url(${src})`, maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: align === "top" ? "top" : align === "bottom" ? "bottom" : "center", WebkitMaskPosition: align === "top" ? "top" : align === "bottom" ? "bottom" : "center" } as const;
  return (
    <span className="absolute inset-0 isolate">
      <span className="absolute inset-0" style={{ backgroundColor: piece.hex, ...mask }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- the grey photograph, multiplied in for folds and seams */}
      <img src={src} alt="" draggable={false} className={`absolute inset-0 h-full w-full object-contain mix-blend-multiply ${pos}`} />
    </span>
  );
}

export function FitsShowcase({ looks, options }: { looks: Look[]; options: Record<SlotKey, LookPiece[]> }) {
  const still = useReducedMotion();
  const motionOn = !still;
  const addToBagOrLogin = useAddToBag();
  const profile = useFitProfile();
  const [index, setIndex] = useState(0);
  /** Which way the last move went, so pieces slide the way you're going. */
  const [dir, setDir] = useState(1);
  /** A new fit draws its lines after the pieces settle; a swap redraws at once. */
  const [change, setChange] = useState<"fit" | "swap">("fit");
  const [picked, setPicked] = useState<Record<string, Size | null>>({});
  const [added, setAdded] = useState(false);
  const [swaps, setSwaps] = useState<Record<string, Partial<Record<SlotKey, LookPiece>>>>({});
  /** An alternative being hovered: shown on the figure until the pointer leaves. */
  const [preview, setPreview] = useState<{ slot: SlotKey; piece: LookPiece } | null>(null);
  const [focus, setFocus] = useState<SlotKey | null>(null);
  const [swapping, setSwapping] = useState<SlotKey | null>(null);

  // Start on ?fit=<key>, or (from the home page) /fits#<occasion>.
  useEffect(() => {
    const fit = new URLSearchParams(location.search).get("fit");
    const want = decodeURIComponent(location.hash.slice(1));
    const at = fit ? looks.findIndex((l) => l.key === fit) : looks.findIndex((l) => l.group === want);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only readable once mounted
    if (at > 0) setIndex(at);
  }, [looks]);

  const go = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(looks.length - 1, i));
      setIndex((cur) => {
        if (next !== cur) setDir(next > cur ? 1 : -1);
        return next;
      });
      setChange("fit");
      setAdded(false);
      setSwapping(null);
      setPreview(null);
      setFocus(null);
      // A fit can be shared: its address says which.
      try {
        history.replaceState(null, "", `/fits?fit=${looks[next].key}`);
      } catch {
        // ignore
      }
    },
    [looks],
  );

  // ← and → anywhere on the page (not while typing or in a pop-up).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [role=dialog], [role=radiogroup]")) return;
      e.preventDefault();
      go(index + (e.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  // The next and previous fits' pictures are fetched ahead.
  useEffect(() => {
    for (const l of [looks[index + 1], looks[index - 1]]) for (const p of l?.pieces ?? []) if (p.cutout) new window.Image().src = p.cutout;
  }, [index, looks]);

  // The stage's size, for the figure and its rails.
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, []);

  const groups = looks.reduce<{ key: string; label: string; fits: { look: Look; at: number }[] }[]>((all, look, at) => {
    const g = all.find((x) => x.key === look.group);
    if (g) g.fits.push({ look, at });
    else all.push({ key: look.group, label: look.groupLabel, fits: [{ look, at }] });
    return all;
  }, []);

  const base = looks[Math.min(index, looks.length - 1)];
  if (!base) return null;
  const mine = swaps[base.key] ?? {};
  const swapped = Object.keys(mine).length > 0;
  /** The fit with its swaps (and a previewed piece) in it. A photo no longer shows it, so the lay does. */
  const look: Look = (() => {
    const repl = { ...mine, ...(preview ? { [preview.slot]: preview.piece } : {}) } as Partial<Record<SlotKey, LookPiece>>;
    if (!Object.keys(repl).length) return base;
    return { ...base, photo: undefined, pieces: base.pieces.map((x) => repl[fitSlot(x.category)] ?? x) };
  })();
  const kept: Look = swapped ? { ...base, photo: undefined, pieces: base.pieces.map((x) => mine[fitSlot(x.category)] ?? x) } : base;
  const group = groups.find((g) => g.key === base.group)!;
  const gi = groups.indexOf(group);
  const worn = wornOf(look);
  const layered = worn.some((w) => w.slot === "layer");
  const photo = Boolean(look.photo);

  // The figure, and the rails for the names either side of it.
  const ratio = photo ? 0.8 : 10 / 17;
  const room0 = box.w >= 340;
  let figH = box.h * 0.86;
  let figW = figH * ratio;
  // Phones: the figure takes about half the width, its names on the right.
  const narrow = box.w < 600;
  const maxW = narrow ? box.w * 0.48 : Math.max(box.w * 0.4, box.w - 400);
  if (figW > maxW) {
    figW = maxW;
    figH = figW / ratio;
  }
  const both = (box.w - figW) / 2 >= 180;
  const mode: "both" | "right" | "dots" = both ? "both" : room0 ? "right" : "dots";
  const figLeft = mode === "right" ? box.w * (narrow ? 0.3 : 0.4) - figW / 2 : (box.w - figW) / 2;
  const figTop = narrow ? (box.h - figH) / 2 + box.h * 0.03 : box.h - figH - box.h * 0.04;
  const railL = figLeft - (narrow ? 28 : 48);
  const railR = figLeft + figW + (narrow ? 28 : 48);
  // Each piece's dot, in stage pixels, and where its name sits (nudged so names never touch).
  const points = worn.map((w) => {
    const bx = boxOf(w.slot, layered);
    const [px, py] = photo ? PHOTO_AT[w.slot] : [bx.b[0] + ((bx.b[2] - bx.b[0]) * bx.at[0]) / 100, bx.b[1] + ((bx.b[3] - bx.b[1]) * bx.at[1]) / 100];
    const side = mode === "right" ? "right" : SIDE[w.slot];
    return { ...w, x: figLeft + (px / 100) * figW, y: figTop + (py / 100) * figH, side, ly: figTop + (py / 100) * figH };
  });
  for (const side of ["left", "right"] as const) {
    const on = points.filter((p) => p.side === side).sort((a, b) => a.y - b.y);
    for (let i = 1; i < on.length; i++) on[i].ly = Math.max(on[i].ly, on[i - 1].ly + 46);
  }
  const lineDelay = change === "swap" ? 0.15 : 0.72;

  const id = (p: LookPiece) => `${kept.key}:${p.slug}`;
  const sizeOf = (p: LookPiece) => (picked[id(p)] !== undefined ? picked[id(p)] : startSize(p, matchSize(p.category, p.measurements, profile)?.size ?? null));
  const total = kept.pieces.reduce((n, p) => n + p.price, 0);
  const keptWorn = wornOf(kept);
  const lines = (): BagLine[] =>
    kept.pieces.flatMap((p) => {
      const size = sizeOf(p);
      const v = p.sizes.find((x) => x.size === size && x.stock > 0);
      return v && size ? [{ slug: p.slug, sku: v.sku, name: p.name, size, colour: p.colour, price: p.price, qty: 1 }] : [];
    });
  const ready = kept.pieces.every((p) => sizeOf(p));
  const fit: Fit = {};
  for (const p of kept.pieces) fit[fitSlot(p.category)] = { slug: p.slug, colour: p.colour, size: sizeOf(p) };
  const pick = (p: LookPiece) => (s: Size) => {
    setPicked((m) => ({ ...m, [id(p)]: s }));
    setAdded(false);
  };
  function addAll() {
    const items = lines().map(({ slug, sku, name, size, colour, price }) => ({ slug, sku, name, size, colour, price }));
    if (items.length && addToBagOrLogin(items)) setAdded(true);
  }
  const swapIn = (slot: SlotKey, piece: LookPiece | null) => {
    setSwaps((m) => {
      const next = { ...m[base.key] };
      if (piece) next[slot] = piece;
      else delete next[slot];
      return { ...m, [base.key]: next };
    });
    setChange("swap");
    setPreview(null);
    setSwapping(null);
    setAdded(false);
  };
  const sized = kept.pieces.map(sizeOf).filter((s): s is Size => Boolean(s) && s !== "ONE");
  const usual = [...sized].sort((a, b) => sized.filter((x) => x === b).length - sized.filter((x) => x === a).length)[0];
  const tint = (kept.pieces.find((p) => fitSlot(p.category) === "layer") ?? kept.pieces[0]).hex;
  const kicker = swapped ? "Your version" : base.curated ? "Designer's pick" : "From the rack";
  const titleSize = `calc(min(15vw, 26svh) * ${Math.min(1, 9 / base.label.length)})`;

  return (
    <div className="relative overflow-hidden bg-[#ededeb]">
      {/* A soft light behind the figure, tinted by the fit */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={false}
        animate={{ background: `radial-gradient(42% 52% at 50% 58%, color-mix(in srgb, ${tint} 11%, #f8f8f6) 0%, rgba(237,237,235,0) 100%)` }}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <div className="relative mx-auto grid max-w-[1680px] gap-x-8 px-4 md:px-8 lg:h-[calc(100svh-88px)] lg:min-h-[620px] lg:grid-cols-[188px_minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_400px]">
        {/* Left: the occasions and their fits */}
        <nav aria-label="Occasions" className="relative z-10 flex min-w-0 flex-col pt-6 lg:py-10">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-steel-dark">Ready-made · {looks.length} fits</p>
          <h2 id="occasion-title" className="display mt-1.5 text-[28px] leading-[0.9] lg:text-[40px]">
            Designer Fits
          </h2>
          <div role="radiogroup" aria-labelledby="occasion-title" className="no-scrollbar -mx-4 mt-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:mt-8 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0">
            {groups.map((g, i) => {
              const on = g.key === group.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => go(g.fits[0].at)}
                  className={`relative flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-full px-4 text-left text-[14px] font-semibold transition-colors duration-300 lg:h-11 lg:rounded-none lg:px-0 lg:text-[17px] ${on ? "text-paper lg:text-ink" : "text-ink/45 hover:text-ink"}`}
                >
                  {on && (
                    <motion.span
                      layoutId="fits-occasion"
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-ink lg:inset-auto lg:-left-4 lg:top-1/2 lg:h-5 lg:w-[2px] lg:-translate-y-1/2 lg:rounded-none"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <span aria-hidden className={`relative font-mono text-[11px] font-normal ${on ? "text-paper/60 lg:text-steel-dark" : "text-steel-dark/70"}`}>
                    {two(i + 1)}
                  </span>
                  <span className="relative">{g.label}</span>
                </button>
              );
            })}
          </div>
          {group.fits.length > 1 && (
            <div role="radiogroup" aria-label={`${group.label} fits`} className="no-scrollbar -mx-4 mt-1 flex gap-4 overflow-x-auto px-4 lg:mx-0 lg:mt-5 lg:flex-col lg:gap-0 lg:border-l lg:border-ink/15 lg:px-0 lg:pl-4">
              {group.fits.map(({ look: l, at }) => {
                const on = at === index;
                return (
                  <button
                    key={l.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => go(at)}
                    className={`relative h-9 shrink-0 cursor-pointer text-left text-[14px] transition-colors ${on ? "font-semibold text-ink" : "text-steel-dark hover:text-ink"}`}
                  >
                    {l.label}
                    {on && <motion.span layoutId="fits-fit" aria-hidden className="absolute bottom-1 left-0 right-0 h-px bg-ink lg:right-auto lg:w-5" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                  </button>
                );
              })}
            </div>
          )}
          <Link href={`/fit?${encodeFit(fit)}`} className="group mt-auto hidden min-h-11 items-center gap-2 pt-6 text-[13px] font-semibold uppercase tracking-[0.06em] lg:inline-flex">
            <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover:bg-[length:100%_1px]">Build your own fit</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="transition-transform group-hover:translate-x-0.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </nav>

        {/* Centre: the fit, its lines, its facts and where you are */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div
            ref={stage}
            role="region"
            aria-roledescription="carousel"
            aria-label="Fits, one after another"
            tabIndex={0}
            className="relative h-[min(56svh,470px)] min-w-0 select-none outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-ink)] lg:h-auto lg:min-h-0 lg:flex-1"
          >
            {/* The fit's name, huge and faint, behind it */}
            <AnimatePresence initial={false} custom={dir}>
              <motion.p
                key={base.key}
                aria-hidden
                initial={{ x: motionOn ? dir * 80 : 0, opacity: 0 }}
                animate={{ x: 0, opacity: 1, transition: { delay: motionOn ? 0.12 : 0, duration: 0.7, ease: EASE } }}
                exit={{ x: motionOn ? dir * -80 : 0, opacity: 0, transition: { duration: 0.35 } }}
                className="display pointer-events-none absolute inset-x-[-30%] top-[8%] whitespace-nowrap text-center leading-none text-ink/[0.05]"
                style={{ fontSize: titleSize }}
              >
                {base.label}
              </motion.p>
            </AnimatePresence>

            {box.w > 0 && (
              <motion.div
                className="absolute inset-0 touch-pan-y"
                drag={motionOn ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60 || info.velocity.x < -400) go(index + 1);
                  else if (info.offset.x > 60 || info.velocity.x > 400) go(index - 1);
                }}
              >
                {/* The floor */}
                <div aria-hidden className="absolute h-5 rounded-[50%] bg-ink/[0.13] blur-[10px]" style={{ left: figLeft + figW * 0.18, width: figW * 0.64, top: figTop + figH - 10 }} />

                {photo ? (
                  <AnimatePresence initial={false} custom={dir} mode="popLayout">
                    <motion.div
                      key={`photo-${base.key}`}
                      initial={{ x: motionOn ? dir * 60 : 0, opacity: 0 }}
                      animate={{ x: 0, opacity: 1, transition: { delay: motionOn ? 0.18 : 0, duration: 0.65, ease: EASE } }}
                      exit={{ x: motionOn ? dir * -40 : 0, opacity: 0, transition: { duration: 0.28 } }}
                      className="absolute"
                      style={{ left: figLeft, top: figTop, width: figW, height: figH }}
                    >
                      <Image src={look.photo!} alt="" fill sizes="(min-width: 1024px) 460px, 70vw" priority className="object-cover object-top" />
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <AnimatePresence initial={false} custom={dir}>
                    {worn.map((w, k) => {
                      const bx = boxOf(w.slot, layered);
                      const isPreview = preview?.slot === w.slot;
                      const dim = focus !== null && focus !== w.slot;
                      return (
                        <motion.div
                          key={`${w.slot}-${w.piece.slug}-${w.piece.colour}`}
                          custom={dir}
                          initial={motionOn ? (change === "swap" ? { y: -16, scale: 0.96, opacity: 0, rotate: bx.r } : { x: dir * 60, opacity: 0, rotate: bx.r + dir * 2 }) : { opacity: 0 }}
                          animate={{
                            x: 0,
                            y: 0,
                            scale: focus === w.slot ? 1.03 : 1,
                            rotate: bx.r,
                            opacity: isPreview ? 0.72 : dim ? 0.5 : 1,
                            transition: { delay: motionOn && change === "fit" ? 0.18 + k * 0.06 : 0, duration: motionOn ? (change === "swap" ? 0.45 : 0.65) : 0.2, ease: EASE },
                          }}
                          exit={motionOn ? (change === "swap" ? { y: 12, opacity: 0, transition: { duration: 0.2 } } : { x: dir * -40, opacity: 0, transition: { duration: 0.28, delay: (worn.length - 1 - k) * 0.03 } }) : { opacity: 0, transition: { duration: 0.2 } }}
                          className="absolute [filter:drop-shadow(0_18px_22px_rgba(0,0,0,0.13))]"
                          style={{
                            left: figLeft + (bx.b[0] / 100) * figW,
                            top: figTop + (bx.b[1] / 100) * figH,
                            width: ((bx.b[2] - bx.b[0]) / 100) * figW,
                            height: ((bx.b[3] - bx.b[1]) / 100) * figH,
                            zIndex: bx.z,
                          }}
                        >
                          <span className="fit-breathe absolute inset-0" style={{ animationDelay: `${-k * 1.3}s` }}>
                            <PieceArt piece={w.piece} align={bx.align} eager />
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                {/* Sneakers at the foot, to finish the lay */}
                {!photo && (
                  // eslint-disable-next-line @next/next/no-img-element -- decorative cut-out
                  <img
                    src="/rack/acc/sneakers-clear.webp"
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="absolute object-contain [filter:drop-shadow(0_10px_12px_rgba(0,0,0,0.14))]"
                    style={{ left: figLeft + figW * 0.3, top: figTop + figH * 0.9, width: figW * 0.4, height: figH * 0.1, zIndex: 5 }}
                  />
                )}

                {/* The lines, from each garment to its name */}
                {mode !== "dots" && (
                  <svg aria-hidden className="pointer-events-none absolute inset-0 z-[45] h-full w-full overflow-visible">
                    {points.map((p) => {
                      const rail = p.side === "left" ? railL : railR;
                      const dy = p.ly - p.y;
                      const kink = rail + (p.side === "left" ? 1 : -1) * Math.min(14, Math.abs(dy));
                      const knee = rail + (p.side === "left" ? 1 : -1) * (Math.abs(dy) + 10);
                      const d = Math.abs(dy) < 1 ? `M ${p.x} ${p.y} H ${rail}` : `M ${p.x} ${p.y} H ${knee} L ${kink} ${p.ly} H ${rail}`;
                      return (
                        <motion.path
                          key={`${base.key}-${p.slot}-${p.piece.slug}`}
                          d={d}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1}
                          vectorEffect="non-scaling-stroke"
                          className={`transition-[color] duration-200 ${focus === p.slot ? "text-ink" : "text-ink/35"}`}
                          initial={motionOn ? { pathLength: 0 } : false}
                          animate={{ pathLength: 1 }}
                          transition={{ delay: lineDelay, duration: 0.45, ease: EASE }}
                        />
                      );
                    })}
                  </svg>
                )}
                {/* The dots, and the names on their rails */}
                {points.map((p, k) => (
                  <div key={`${base.key}-${p.slot}-${p.piece.slug}`}>
                    <motion.button
                      type="button"
                      tabIndex={-1}
                      aria-hidden
                      onMouseEnter={() => setFocus(p.slot)}
                      onMouseLeave={() => setFocus(null)}
                      onClick={() => setSwapping(p.slot)}
                      initial={motionOn ? { scale: 0 } : false}
                      animate={{ scale: focus === p.slot ? 1.2 : 1 }}
                      transition={{ delay: focus === p.slot ? 0 : lineDelay - 0.07 + k * 0.05, type: "spring", stiffness: 520, damping: 20 }}
                      className="absolute z-[46] grid h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-paper shadow-[0_0_0_1px_rgba(10,10,10,0.2),0_3px_8px_-2px_rgba(10,10,10,0.35)]"
                      style={{ left: p.x, top: p.y }}
                    >
                      {mode === "dots" ? <span className="font-mono text-[8px] font-semibold leading-none">{p.n}</span> : <span className={`h-1.5 w-1.5 rounded-full transition-colors ${focus === p.slot ? "bg-volt ring-1 ring-ink" : "bg-ink"}`} />}
                    </motion.button>
                    {mode !== "dots" && (
                      <motion.div
                        initial={motionOn ? { opacity: 0, x: p.side === "left" ? 8 : -8 } : false}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: lineDelay + 0.2, duration: 0.35, ease: EASE }}
                        className="absolute z-[46] -translate-y-1/2"
                        style={p.side === "left" ? { right: box.w - railL + 8, top: p.ly } : { left: railR + 8, top: p.ly }}
                      >
                        <Link
                          href={`/product/${p.piece.slug}`}
                          onMouseEnter={() => setFocus(p.slot)}
                          onMouseLeave={() => setFocus(null)}
                          className={`group flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold ${p.side === "left" ? "flex-row-reverse text-right" : ""}`}
                          style={{ maxWidth: p.side === "left" ? Math.max(90, railL - 16) : Math.max(90, box.w - railR - 16) }}
                        >
                          <span className="font-mono text-[10.5px] font-normal text-steel-dark">{two(p.n)}</span>
                          <span className={`truncate bg-[linear-gradient(currentColor,currentColor)] bg-no-repeat pb-0.5 transition-[background-size] duration-300 ${p.side === "left" ? "bg-right-bottom" : "bg-left-bottom"} ${focus === p.slot ? "bg-[length:100%_1px]" : "bg-[length:0%_1px]"}`}>
                            {p.piece.name}
                          </span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                            <path d="M7 17L17 7M9 7h8v8" />
                          </svg>
                        </Link>
                      </motion.div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Facts: occasion, size, palette */}
          <div className="flex h-11 shrink-0 items-center divide-x divide-ink/15 border-y border-ink/15 font-mono text-[10.5px] uppercase tracking-[0.14em] text-steel-dark">
            <span className="truncate pr-3">
              {base.groupLabel} · {kept.pieces.length} pieces
            </span>
            <span className="px-3">
              {profile ? "Your size" : "Size"} <span className="text-ink">{usual ?? "One"}</span>
            </span>
            <span className="flex items-center gap-1.5 px-3">
              {kept.pieces.map((p) => (
                <span key={p.slug} title={p.colour} className="h-2 w-2 rounded-full ring-1 ring-ink/20" style={{ background: p.hex }} />
              ))}
            </span>
            <span className="ml-auto hidden pl-3 sm:block">← → to browse</span>
          </div>
          {/* Where you are: 02 / 18, a hairline that fills, a tick at each occasion */}
          <div className="flex h-12 shrink-0 items-center gap-3">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous fit" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full transition-[background-color,opacity] hover:bg-ink/5 disabled:cursor-default disabled:opacity-25">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="font-mono text-[11px] tabular-nums text-steel-dark">
              <span className="font-semibold text-ink">{two(index + 1)}</span> / {two(looks.length)}
            </span>
            <span aria-hidden className="relative h-px flex-1 bg-ink/15">
              <motion.span className="absolute inset-y-0 left-0 bg-ink" initial={false} animate={{ width: `${((index + 1) / looks.length) * 100}%` }} transition={{ duration: 0.6, ease: EASE }} />
              {groups.slice(1).map((g) => (
                <span key={g.key} className="absolute -top-[3px] h-[7px] w-px bg-ink/30" style={{ left: `${(g.fits[0].at / looks.length) * 100}%` }} />
              ))}
              <motion.span className="absolute -top-[2.5px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-volt ring-1 ring-ink" initial={false} animate={{ left: `${((index + 1) / looks.length) * 100}%` }} transition={{ duration: 0.6, ease: EASE }} />
            </span>
            <button type="button" onClick={() => go(index + 1)} disabled={index === looks.length - 1} aria-label="Next fit" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full transition-[background-color,opacity] hover:bg-ink/5 disabled:cursor-default disabled:opacity-25">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>

        {/* Right: the story, the pieces, buying it */}
        <article aria-label={`${base.groupLabel} · ${base.label}`} className="relative z-10 flex min-h-0 min-w-0 flex-col pb-10 pt-6 lg:pb-8 lg:pt-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={base.key} exit={motionOn ? { opacity: 0, transition: { duration: 0.15 } } : undefined}>
              <motion.p
                initial={motionOn ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-steel-dark"
              >
                {two(gi + 1)} · {base.groupLabel} · {kicker}
              </motion.p>
              <h3 className="display mt-1.5 flex flex-wrap gap-x-[0.22em] text-[44px] leading-[0.9] lg:text-[56px]">
                {base.label.split(" ").map((word, i) => (
                  <span key={i} className="inline-block overflow-hidden pb-[0.04em]">
                    <motion.span className="inline-block" initial={motionOn ? { y: "100%" } : false} animate={{ y: 0 }} transition={{ delay: motionOn ? 0.1 + i * 0.06 : 0, duration: 0.5, ease: EASE }}>
                      {word}
                    </motion.span>
                  </span>
                ))}
              </h3>
              <motion.p initial={motionOn ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionOn ? 0.2 : 0, duration: 0.45, ease: EASE }} className="mt-4 text-[17px] font-semibold leading-snug">
                {base.note}
              </motion.p>
              <motion.p initial={motionOn ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionOn ? 0.28 : 0, duration: 0.45, ease: EASE }} className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink/65">
                {storyOf(kept)}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          {/* The pieces, numbered */}
          <ol className="no-scrollbar mt-5 divide-y divide-ink/10 border-y border-ink/10 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {keptWorn.map((w, k) => {
              const on = focus === w.slot || swapping === w.slot;
              const alts = options[w.slot].filter((o) => !kept.pieces.some((x) => x.slug === o.slug));
              return (
                <motion.li
                  key={`${kept.key}-${w.slot}-${w.piece.slug}`}
                  initial={motionOn ? { opacity: 0, x: 14 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: motionOn ? 0.3 + k * 0.06 : 0, duration: 0.4, ease: EASE }}
                  onMouseEnter={() => setFocus(w.slot)}
                  onMouseLeave={() => setFocus(null)}
                  className="relative py-3"
                >
                  <span aria-hidden className={`absolute -left-3 top-3 bottom-3 w-[2px] origin-top bg-ink transition-transform duration-300 ${on ? "scale-y-100" : "scale-y-0"}`} />
                  <div className="flex gap-3">
                    <Link href={`/product/${w.piece.slug}`} className="relative block h-[70px] w-14 shrink-0">
                      <span className="absolute left-0 top-0 z-10 font-mono text-[10px] font-semibold leading-none">{two(w.n)}</span>
                      {w.piece.cutout ? (
                        // eslint-disable-next-line @next/next/no-img-element -- transparent cut-out
                        <img src={w.piece.cutout} alt="" className="h-full w-full object-contain [filter:drop-shadow(0_6px_8px_rgba(0,0,0,0.12))]" />
                      ) : (
                        <span className="block overflow-hidden rounded-lg">
                          <ProductImage image={w.piece.image} category={w.piece.category} colourHex={w.piece.hex} decorative sizes="56px" />
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <Link href={`/product/${w.piece.slug}`} className="min-w-0 truncate text-[13px] font-semibold uppercase tracking-[0.03em] underline-offset-4 hover:underline">
                          {w.piece.name}
                        </Link>
                        <span className="ml-auto shrink-0 font-mono text-[12.5px] tabular-nums">{formatPrice(w.piece.price)}</span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-steel-dark">
                        <span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-ink/20" style={{ background: w.piece.hex }} />
                        {w.piece.colour}
                        <span className="ml-auto flex items-center gap-3">
                          {mine[w.slot] && (
                            <button type="button" onClick={() => swapIn(w.slot, null)} className="cursor-pointer underline underline-offset-2 hover:text-ink">
                              Undo
                            </button>
                          )}
                          {alts.length > 0 && (
                            <button
                              type="button"
                              aria-expanded={swapping === w.slot}
                              onClick={() => setSwapping(swapping === w.slot ? null : w.slot)}
                              className="inline-flex cursor-pointer items-center gap-1 font-semibold text-ink"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                                <path d="M7 4L3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" />
                              </svg>
                              Swap the {SLOT_NAME[w.slot]}
                            </button>
                          )}
                        </span>
                      </p>
                      <Sizes piece={w.piece} size={sizeOf(w.piece)} onPick={pick(w.piece)} />
                    </div>
                  </div>
                  {/* Others for this place on the body: hover to see it on the figure, tap to keep it */}
                  <AnimatePresence initial={false}>
                    {swapping === w.slot && (
                      <motion.div
                        initial={motionOn ? { opacity: 0, height: 0 } : false}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={motionOn ? { opacity: 0, height: 0 } : { opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <div role="group" aria-label={`Swap the ${SLOT_NAME[w.slot]}`} className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 py-1" onMouseLeave={() => setPreview(null)}>
                          {alts.map((o, j) => (
                            <motion.button
                              key={o.slug}
                              type="button"
                              onClick={() => swapIn(w.slot, o)}
                              onMouseEnter={() => setPreview({ slot: w.slot, piece: o })}
                              onFocus={() => setPreview({ slot: w.slot, piece: o })}
                              onBlur={() => setPreview(null)}
                              initial={motionOn ? { opacity: 0, x: 10 } : false}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: motionOn ? j * 0.04 : 0, duration: 0.3, ease: EASE }}
                              className="flex w-[150px] shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-paper/70 p-1.5 text-left ring-1 ring-ink/10 transition-[box-shadow,background-color] hover:bg-paper hover:ring-ink"
                            >
                              <span className="relative block h-12 w-10 shrink-0">
                                {o.cutout ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- transparent cut-out
                                  <img src={o.cutout} alt="" className="h-full w-full object-contain" />
                                ) : (
                                  <span className="block overflow-hidden rounded-md">
                                    <ProductImage image={o.image} category={o.category} colourHex={o.hex} decorative sizes="40px" />
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[12.5px] font-semibold">{o.name}</span>
                                <span className="block font-mono text-[11.5px] tabular-nums text-steel-dark">{formatPrice(o.price)}</span>
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ol>

          {/* The total, and buying it */}
          <div className="shrink-0 pt-4">
            <p className="flex items-baseline justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-steel-dark">Fit total</span>
              <span className="relative overflow-hidden font-mono text-[26px] font-semibold tabular-nums">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={total} className="inline-block" initial={motionOn ? { y: "-100%", opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} exit={motionOn ? { y: "100%", opacity: 0 } : undefined} transition={{ duration: 0.35, ease: EASE }}>
                    {formatPrice(total)}
                  </motion.span>
                </AnimatePresence>
              </span>
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={addAll}
                disabled={!ready}
                aria-label={added ? "Added to your bag" : `Add the fit · ${formatPrice(total)}`}
                className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-paper transition-[background-color,scale] hover:bg-[#2c2c2e] active:scale-[0.98] disabled:opacity-40"
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
              <button
                type="button"
                onClick={() => openBuyNow(lines(), "Buy the fit")}
                disabled={!ready}
                aria-label={`Quick buy the fit · ${formatPrice(total)}`}
                className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border-[1.5px] border-ink px-4 text-[13px] font-semibold uppercase tracking-[0.06em] transition-[background-color,color,scale] hover:bg-ink hover:text-paper active:scale-[0.98] disabled:opacity-40"
              >
                Quick buy
              </button>
            </div>
            <Link href={`/fit?${encodeFit(fit)}`} className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold underline underline-offset-4 lg:hidden">
              Build your own fit
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}

function Sizes({ piece, size, onPick }: { piece: LookPiece; size: Size | null; onPick: (s: Size) => void }) {
  if (piece.sizes.length === 1 && piece.sizes[0].size === "ONE") return <p className="mt-1.5 font-mono text-[11.5px] text-steel-dark">One size</p>;
  return (
    <div role="radiogroup" aria-label={`Size for ${piece.name}`} className="mt-1.5 flex flex-wrap gap-0.5">
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
            className={`relative h-8 min-w-8 cursor-pointer px-1.5 font-mono text-[12px] font-semibold transition-colors ${on ? "text-ink" : out ? "cursor-default text-ink/25 line-through" : "text-ink/45 hover:text-ink"}`}
          >
            {s.size}
            {on && <motion.span layoutId={`size-${piece.slug}`} aria-hidden className="absolute inset-x-1.5 bottom-1 h-px bg-ink" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          </button>
        );
      })}
    </div>
  );
}
