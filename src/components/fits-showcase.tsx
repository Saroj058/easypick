"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
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
import { site, walletList } from "@/lib/site";
import type { BagLine, Size } from "@/lib/types";

// Designer Fits, one full screen (owner, 16 Oct 2026; designed against the owner's references,
// then reviewed by ten specialists: art direction, motion, UX, mobile, conversion, accessibility,
// performance, copy, styling and QA).
//
//   Left: the occasions, and the fits inside the chosen one.
//   Centre: the fit laid out head to toe from the pieces' own cut-out photos (public/rack), as a
//   stylist would: the tee under the jacket, trousers longer than tops, the cap just above. Its
//   name huge and faint behind; a line from each garment to the piece's name on a rail (hover a
//   name for a close look). One row under it: what the fit is, and where you are.
//   Right: the story, the pieces numbered 01, 02, 03 (size, swap: hover an alternative to try it
//   on, tap to keep it), what goes in the bag, delivery and payment, Add the fit and Quick buy.
// A change of fit is choreographed: the old fit leaves together, the new one is laid down from
// the trousers up, the dots and lines follow, then the names. A fit the owner photographed (in
// /admin/looks) shows the photo instead.

const EASE = [0.22, 1, 0.36, 1] as const;
const two = (n: number) => String(n).padStart(2, "0");
const SLOT_NAME: Record<SlotKey, string> = { cap: "cap", layer: "jacket", top: "top", bottom: "bottom" };
/** Head to toe. */
const ORDER: SlotKey[] = ["cap", "layer", "top", "bottom"];
/** "Oversized Heavy Tee" → "Heavy Tee": short enough for a rail. */
const short = (name: string) => {
  const w = name.split(" ");
  return w.length >= 3 ? w.slice(-2).join(" ") : name;
};

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
function boxOf(slot: SlotKey, layered: boolean, set: boolean): Box {
  if (slot === "cap") return { b: [38, 0, 62, 10], z: 40, r: -8, at: [50, 50], align: "center" };
  if (slot === "layer") return { b: [6, 10, 80, 52], z: 30, r: -2.5, at: [30, 40], align: "bottom" };
  if (slot === "top") {
    // A co-ord set (shirt and shorts in one photo) stands in for top and bottom.
    if (set) return { b: [14, 10, 86, 94], z: 20, r: 0, at: [70, 22], align: "top" };
    // Under a jacket: centred behind it, its hem and a sleeve showing.
    if (layered) return { b: [16, 15, 88, 57], z: 20, r: 1.5, at: [82, 86], align: "bottom" };
    return { b: [12, 11, 88, 50], z: 20, r: 0, at: [70, 32], align: "bottom" };
  }
  return { b: [23, 45, 77, 94], z: 10, r: 0, at: [62, 28], align: "top" };
}
/** On a photo (4:5, a person standing in the middle): where each garment is, in percent of the photo. */
const PHOTO_AT: Record<SlotKey, [number, number]> = { cap: [50, 7], layer: [37, 33], top: [55, 31], bottom: [46, 68] };
/** Which rail a piece's name goes on, when there's room either side. */
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

/**
 * The fit as one sentence, from its pieces. One colour throughout leads with it ("All black.
 * Coach Jacket over the Oversized Heavy Tee, Tapered Jogger below."); otherwise a colour is named
 * only when it changes ("Navy Brushed Crewneck, indigo Relaxed Straight Jean, black Six-Panel Cap on top.").
 */
function storyOf(look: Look): string {
  const by = (slot: SlotKey) => look.pieces.find((p) => fitSlot(p.category) === slot);
  const [layer, top, bottom, cap] = [by("layer"), by("top"), by("bottom"), by("cap")];
  const all = look.pieces.map((p) => p.colour.toLowerCase());
  const same = all.every((c) => c === all[0]);
  let last = "";
  const named = (p: LookPiece) => {
    const c = p.colour.toLowerCase();
    const out = same || c === last ? p.name : `${c} ${p.name}`;
    last = c;
    return out;
  };
  const parts: string[] = [];
  if (layer && top) parts.push(`${named(layer)} over the ${named(top)}`);
  else if (layer || top) parts.push(named((layer ?? top)!));
  if (bottom) parts.push(same ? `${named(bottom)} below` : named(bottom));
  if (cap) parts.push(`${named(cap)} on top`);
  const body = parts.join(", ");
  const upper = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  return body ? (same ? `All ${all[0]}. ${upper(body)}.` : `${upper(body)}.`) : "";
}

/** Mixes a colour into the backdrop: the soft light behind the fit. */
function mix(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const base = [248, 248, 246];
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(base[i] + (v - base[i]) * t));
  return `rgb(${c.join(",")})`;
}

/** A piece as photographed and cut out; in another colour, its stand-in dyed that colour; else its product picture. */
function PieceArt({ piece, align, eager }: { piece: LookPiece; align: Box["align"]; eager?: boolean }) {
  const pos = align === "top" ? "object-top" : align === "bottom" ? "object-bottom" : "object-center";
  if (piece.cutout)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a transparent cut-out, drawn at whatever size the lay gives it
      <img
        src={piece.cutout}
        alt=""
        draggable={false}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        className={`absolute inset-0 h-full w-full object-contain [filter:drop-shadow(0_8px_10px_rgba(0,0,0,0.10))] ${pos}`}
      />
    );
  const src = standInSrc(piece.name, piece.category);
  if (!src)
    return (
      <span className="absolute inset-0 overflow-hidden rounded-xl">
        <ProductImage image={piece.image} category={piece.category} colourHex={piece.hex} decorative sizes="200px" className="h-full" />
      </span>
    );
  const at = align === "top" ? "top" : align === "bottom" ? "bottom" : "center";
  const mask = { maskImage: `url(${src})`, WebkitMaskImage: `url(${src})`, maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: at, WebkitMaskPosition: at } as const;
  return (
    <span className="absolute inset-0 isolate [filter:drop-shadow(0_8px_10px_rgba(0,0,0,0.10))]">
      <span className="absolute inset-0" style={{ backgroundColor: piece.hex, ...mask }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- the grey photograph, multiplied in for folds and seams */}
      <img src={src} alt="" draggable={false} decoding="async" className={`absolute inset-0 h-full w-full object-contain mix-blend-multiply ${pos}`} />
    </span>
  );
}

/** Arrow keys inside a radio group: move and choose (roving focus: only the checked one is a tab stop). */
function arrows(e: React.KeyboardEvent<HTMLElement>, count: number, current: number, choose: (i: number) => void) {
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  const to = e.key === "Home" ? 0 : e.key === "End" ? count - 1 : step ? Math.max(0, Math.min(count - 1, current + step)) : -1;
  if (to < 0) return;
  e.preventDefault();
  e.stopPropagation();
  choose(to);
  const group = e.currentTarget;
  requestAnimationFrame(() => group.querySelector<HTMLElement>("[role=radio][tabindex='0']")?.focus());
}

type Change = "fit" | "swap" | "preview" | "instant";

export function FitsShowcase({ looks, options }: { looks: Look[]; options: Record<SlotKey, LookPiece[]> }) {
  return (
    <MotionConfig reducedMotion="user">
      <Showcase looks={looks} options={options} />
    </MotionConfig>
  );
}

function Showcase({ looks, options }: { looks: Look[]; options: Record<SlotKey, LookPiece[]> }) {
  const still = useReducedMotion();
  const motionOn = !still;
  const addToBagOrLogin = useAddToBag();
  const profile = useFitProfile();
  const [index, setIndex] = useState(0);
  /** Which way the last move went. */
  const [dir, setDir] = useState(1);
  const [change, setChange] = useState<Change>("instant");
  const [picked, setPicked] = useState<Record<string, Size | null>>({});
  const [added, setAdded] = useState(false);
  /** Bumped when the fit goes in the bag: the pieces lift, one after another. */
  const [cheer, setCheer] = useState(0);
  const [swaps, setSwaps] = useState<Record<string, Partial<Record<SlotKey, LookPiece>>>>({});
  /** An alternative being hovered: tried on the figure until the pointer leaves. */
  const [preview, setPreview] = useState<{ slot: SlotKey; piece: LookPiece } | null>(null);
  const [focus, setFocus] = useState<SlotKey | null>(null);
  /** The close look (lens) at a piece, after a short hover on its name. */
  const [lens, setLens] = useState<SlotKey | null>(null);
  const lensTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [swapping, setSwapping] = useState<SlotKey | null>(null);
  const swapButtons = useRef<Partial<Record<SlotKey, HTMLButtonElement | null>>>({});
  const backTo = useRef<SlotKey | null>(null);
  const dragged = useRef(false);

  // Start on ?fit=<key>, or (from the home page) /fits#<occasion>, without animating there.
  useEffect(() => {
    const fit = new URLSearchParams(location.search).get("fit");
    let at = fit ? looks.findIndex((l) => l.key === fit) : -1;
    if (at < 0) {
      const want = decodeURIComponent(location.hash.slice(1));
      at = want ? looks.findIndex((l) => l.group === want) : -1;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only readable once mounted
    if (at > 0) setIndex(at);
  }, [looks]);

  const go = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(looks.length - 1, i));
      if (next === index) return;
      setDir(next > index ? 1 : -1);
      setIndex(next);
      setChange("fit");
      setAdded(false);
      setSwapping(null);
      setPreview(null);
      setFocus(null);
      setLens(null);
      // A fit can be shared: its address says which (the rest of the address kept).
      try {
        const url = new URL(location.href);
        url.searchParams.set("fit", looks[next].key);
        url.hash = "";
        history.replaceState(history.state, "", url);
      } catch {
        // ignore
      }
    },
    [looks, index],
  );

  // ← and → browse, when nothing else wants the keys (focus on the page or the stage, no modifier).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
      const t = document.activeElement as HTMLElement | null;
      if (t && t !== document.body && !t.closest("[data-fits-stage]")) return;
      e.preventDefault();
      go(index + (e.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  // The next and previous fits' pictures, and (once a swap opens) its alternatives, are fetched ahead.
  useEffect(() => {
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    for (const l of [looks[index + 1], looks[index - 1]]) for (const p of l?.pieces ?? []) if (p.cutout) new window.Image().src = p.cutout;
  }, [index, looks]);
  useEffect(() => {
    if (!swapping) return;
    for (const o of options[swapping]) if (o.cutout) new window.Image().src = o.cutout;
  }, [swapping, options]);

  // After a swap, focus goes back to that piece's Swap button.
  useEffect(() => {
    const slot = backTo.current;
    if (!slot) return;
    backTo.current = null;
    swapButtons.current[slot]?.focus();
  });

  // The stage's size, for the figure and its rails (a guess before it's measured, so the server draws it too).
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 720, h: 560 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, []);

  // On phones, a buy bar appears once the buttons are scrolled out of view below.
  const buyBlock = useRef<HTMLDivElement>(null);
  const [buyOut, setBuyOut] = useState(false);
  useEffect(() => {
    const el = buyBlock.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBuyOut(!e.isIntersecting && e.boundingClientRect.top > 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The chosen occasion chip in view on phones.
  const chips = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chips.current;
    const on = row?.querySelector<HTMLElement>("[aria-checked=true]");
    if (!row || !on || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: on.offsetLeft - row.clientWidth / 2 + on.clientWidth / 2, behavior: still ? "auto" : "smooth" });
  }, [index, still]);

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
  const kept: Look = swapped ? { ...base, photo: undefined, pieces: base.pieces.map((x) => mine[fitSlot(x.category)] ?? x) } : base;
  /** What the figure shows: the kept fit, with a hovered alternative tried on. */
  const look: Look = preview ? { ...kept, photo: undefined, pieces: kept.pieces.map((x) => (fitSlot(x.category) === preview.slot ? preview.piece : x)) } : kept;
  const group = groups.find((g) => g.key === base.group)!;
  const gi = groups.indexOf(group);
  const worn = wornOf(look);
  const keptWorn = wornOf(kept);
  const layered = worn.some((w) => w.slot === "layer");
  const set = worn.some((w) => w.piece.category === "co-ords") && !worn.some((w) => w.slot === "bottom");
  const photo = Boolean(look.photo);

  // The figure, and the rails for the names either side of it.
  const narrow = box.w < 600;
  const ratio = photo ? 0.8 : 10 / 17;
  let figH = box.h * (narrow ? 0.9 : 0.86);
  let figW = figH * ratio;
  const maxW = narrow ? box.w * 0.48 : Math.max(box.w * 0.4, box.w - 440);
  if (figW > maxW) {
    figW = maxW;
    figH = figW / ratio;
  }
  const mode: "both" | "right" | "dots" = (box.w - figW) / 2 >= 200 ? "both" : box.w >= 340 ? "right" : "dots";
  const figLeft = mode === "right" ? box.w * (narrow ? 0.3 : 0.4) - figW / 2 : (box.w - figW) / 2;
  const figTop = narrow ? (box.h - figH) / 2 + box.h * 0.02 : box.h - figH - box.h * 0.035;
  const gap = narrow ? 22 : 36;
  const railL = figLeft - gap;
  const railR = figLeft + figW + gap;
  const labelMax = (side: "left" | "right") => Math.min(narrow ? 128 : 170, Math.max(80, side === "left" ? railL - 12 : box.w - railR - 12));
  const boxPx = (bx: Box) => ({ left: figLeft + (bx.b[0] / 100) * figW, top: figTop + (bx.b[1] / 100) * figH, width: ((bx.b[2] - bx.b[0]) / 100) * figW, height: ((bx.b[3] - bx.b[1]) / 100) * figH });
  // Each piece's dot, in stage pixels, and where its name sits (in order, never touching).
  const points = worn.map((w) => {
    const bx = boxOf(w.slot, layered, set);
    const atX = mode === "right" && !photo ? Math.max(bx.at[0], 62) : bx.at[0];
    const [px, py] = photo ? PHOTO_AT[w.slot] : [bx.b[0] + ((bx.b[2] - bx.b[0]) * atX) / 100, bx.b[1] + ((bx.b[3] - bx.b[1]) * bx.at[1]) / 100];
    const side = mode === "right" ? ("right" as const) : SIDE[w.slot];
    const y = figTop + (py / 100) * figH;
    return { ...w, bx, x: figLeft + (px / 100) * figW, y, side, ly: y };
  });
  for (const side of ["left", "right"] as const) {
    const on = points.filter((p) => p.side === side).sort((a, b) => a.y - b.y);
    for (let i = 1; i < on.length; i++) on[i].ly = Math.max(on[i].ly, on[i - 1].ly + (narrow ? 40 : 44));
  }
  // The fit is laid down from the trousers up; then the dots, the lines, the names.
  const layDelay = (k: number) => 0.12 + (worn.length - 1 - k) * 0.08;
  const lineDelay = change === "fit" ? layDelay(0) + 0.42 : change === "swap" ? 0.12 : 0;
  const drawn = motionOn && change !== "instant";
  const titleSize = Math.min(box.h * 0.22, (box.w * 0.95) / Math.max(4, base.label.length * 0.5));
  const committed = (slot: SlotKey) => keptWorn.find((w) => w.slot === slot)?.piece.slug ?? "";

  const id = (p: LookPiece) => `${kept.key}:${p.slug}`;
  const sizeOf = (p: LookPiece) => (picked[id(p)] !== undefined ? picked[id(p)] : startSize(p, matchSize(p.category, p.measurements, profile)?.size ?? null));
  const total = kept.pieces.reduce((n, p) => n + p.price, 0);
  const lines = (): BagLine[] =>
    kept.pieces.flatMap((p) => {
      const size = sizeOf(p);
      const v = p.sizes.find((x) => x.size === size && x.stock > 0);
      return v && size ? [{ slug: p.slug, sku: v.sku, name: p.name, size, colour: p.colour, price: p.price, qty: 1 }] : [];
    });
  const missing = kept.pieces.find((p) => !sizeOf(p));
  const ready = !missing;
  const fit: Fit = {};
  for (const p of kept.pieces) fit[fitSlot(p.category)] = { slug: p.slug, colour: p.colour, size: sizeOf(p) };
  const pick = (p: LookPiece) => (s: Size) => {
    setPicked((m) => ({ ...m, [id(p)]: s }));
    setAdded(false);
  };
  function addAll() {
    const items = lines().map(({ slug, sku, name, size, colour, price }) => ({ slug, sku, name, size, colour, price }));
    if (items.length && addToBagOrLogin(items)) {
      setAdded(true);
      setCheer((c) => c + 1);
    }
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
    backTo.current = slot;
  };
  const tryOn = (slot: SlotKey, piece: LookPiece | null) => {
    setChange(piece ? "preview" : "swap");
    setPreview(piece ? { slot, piece } : null);
  };
  const point = (slot: SlotKey | null) => {
    setFocus(slot);
    if (lensTimer.current) clearTimeout(lensTimer.current);
    if (!slot) setLens(null);
    else if (!narrow && window.matchMedia("(hover: hover)").matches) lensTimer.current = setTimeout(() => setLens(slot), 350);
  };
  const usualSizes = Array.from(new Set(kept.pieces.map(sizeOf).filter((s): s is Size => Boolean(s) && s !== "ONE")));
  const sizeText = usualSizes.length ? usualSizes.join(" / ") : "One size";
  const tintHex = (kept.pieces.find((p) => fitSlot(p.category) === "layer") ?? kept.pieces[0]).hex;
  const kicker = swapped ? "Your take" : base.curated ? "Designer's pick" : "Picked from today's rack";
  const delivery = total >= site.delivery.freeAbove ? "Free delivery in the Valley" : `Delivery ${formatPrice(site.delivery.flatFee)}, free over ${formatPrice(site.delivery.freeAbove)}`;
  const announce = `Fit ${index + 1} of ${looks.length}: ${base.label}, ${base.groupLabel}. ${kept.pieces.length} pieces, ${formatPrice(total)}.`;

  return (
    <div className="relative overflow-hidden bg-[#ededeb]">
      {/* A soft light behind the figure, tinted by the fit */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(42%_52%_at_50%_58%,#000_0%,transparent_100%)]"
        initial={false}
        animate={{ backgroundColor: mix(tintHex, 0.12) }}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {added ? `${kept.pieces.length} pieces added to your bag.` : announce}
      </p>
      <div className="relative mx-auto grid max-w-[1680px] gap-x-8 px-4 md:px-8 lg:h-[calc(100svh-88px)] lg:min-h-[620px] lg:grid-cols-[188px_minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_400px]">
        {/* Left: the occasions and their fits */}
        <nav aria-label="Occasions" className="relative z-10 flex min-w-0 flex-col pt-5 lg:py-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60">
            {looks.length} fits · {groups.length} occasions
          </p>
          <h2 id="occasion-title" className="display mt-1.5 text-[28px] leading-[0.9] lg:text-[40px]">
            Designer Fits
          </h2>
          <div
            ref={chips}
            role="radiogroup"
            aria-labelledby="occasion-title"
            onKeyDown={(e) => arrows(e, groups.length, gi, (i) => go(groups[i].fits[0].at))}
            className="no-scrollbar -mx-4 mt-3 flex gap-1 overflow-x-auto px-4 [mask-image:linear-gradient(90deg,#000_calc(100%-24px),transparent)] lg:mx-0 lg:mt-8 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:[mask-image:none]"
          >
            {groups.map((g, i) => {
              const on = g.key === group.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => !on && go(g.fits[0].at)}
                  className={`relative flex h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-full px-4 text-left text-[14px] font-semibold transition-colors duration-300 lg:h-11 lg:rounded-none lg:pl-4 lg:pr-0 lg:text-[17px] ${on ? "text-paper lg:text-ink" : "text-ink/55 hover:text-ink"}`}
                >
                  {on && (
                    <motion.span
                      layoutId="fits-occasion"
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-ink lg:inset-auto lg:left-0 lg:top-1/2 lg:h-5 lg:w-[2px] lg:-translate-y-1/2 lg:rounded-none"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <span aria-hidden className={`relative font-mono text-[11px] font-normal ${on ? "text-paper/60 lg:text-ink/60" : "text-ink/45"}`}>
                    {two(i + 1)}
                  </span>
                  <span className="relative">{g.label}</span>
                </button>
              );
            })}
          </div>
          {group.fits.length > 1 && (
            <div
              role="radiogroup"
              aria-label={`${group.label} fits`}
              onKeyDown={(e) =>
                arrows(
                  e,
                  group.fits.length,
                  group.fits.findIndex((f) => f.at === index),
                  (i) => go(group.fits[i].at),
                )
              }
              className="no-scrollbar -mx-4 mt-1 flex gap-4 overflow-x-auto px-4 lg:mx-0 lg:mt-5 lg:flex-col lg:gap-0 lg:border-l lg:border-ink/15 lg:px-0 lg:pl-4"
            >
              {group.fits.map(({ look: l, at }) => {
                const on = at === index;
                return (
                  <button
                    key={l.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={on ? 0 : -1}
                    onClick={() => go(at)}
                    className={`relative h-10 shrink-0 cursor-pointer text-left text-[14px] transition-colors ${on ? "font-semibold text-ink" : "text-ink/60 hover:text-ink"}`}
                  >
                    {l.label}
                    {on && <motion.span layoutId="fits-fit" aria-hidden className="absolute bottom-1.5 left-0 right-0 h-px bg-ink lg:right-auto lg:w-5" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
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

        {/* Centre: the fit, its lines, and one row of where you are */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div
            ref={stage}
            id="fits-stage"
            data-fits-stage
            role="region"
            aria-label={`${base.label}, fit ${index + 1} of ${looks.length}. Use the left and right arrow keys to browse.`}
            tabIndex={0}
            className="relative h-[min(50svh,420px)] min-w-0 select-none overflow-hidden outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-ink)] lg:h-auto lg:min-h-0 lg:flex-1"
          >
            {/* The fit's name, huge and faint, behind it */}
            <AnimatePresence initial={false}>
              <motion.p
                key={base.key}
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: change === "instant" ? { duration: 0 } : { delay: 0.2, duration: 0.9, ease: EASE } }}
                exit={{ opacity: 0, transition: { duration: 0.25 } }}
                className="display pointer-events-none absolute inset-x-0 whitespace-nowrap text-center leading-none text-ink/[0.045]"
                style={{ fontSize: titleSize, top: Math.max(0, figTop - titleSize * 0.12) }}
              >
                {base.label}
              </motion.p>
            </AnimatePresence>

            <motion.div
              className="absolute inset-0 touch-pan-y"
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={motionOn ? 0.18 : 0}
              onDragStart={() => {
                dragged.current = true;
              }}
              onDragEnd={(_, info) => {
                requestAnimationFrame(() => {
                  dragged.current = false;
                });
                if (info.offset.x < -80 || info.velocity.x < -500) go(index + 1);
                else if (info.offset.x > 80 || info.velocity.x > 500) go(index - 1);
              }}
              onClickCapture={(e) => {
                if (dragged.current) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              {/* The floor */}
              <div aria-hidden className="absolute h-4 rounded-[50%] bg-ink/[0.14] blur-[10px]" style={{ left: figLeft + figW * 0.2, width: figW * 0.6, top: figTop + figH - 8 }} />

              <div className="fit-breathe absolute inset-0">
                {photo ? (
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.div
                      key={`photo-${base.key}`}
                      initial={drawn ? { opacity: 0, y: -14 } : false}
                      animate={{ opacity: 1, y: 0, transition: { delay: 0.12, duration: 0.6, ease: EASE } }}
                      exit={{ opacity: 0, x: -dir * 10, transition: { duration: 0.22 } }}
                      className="absolute"
                      style={{ left: figLeft, top: figTop, width: figW, height: figH }}
                    >
                      <Image src={look.photo!} alt="" fill sizes={`${Math.ceil(figW)}px`} priority className="object-cover object-top" />
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <AnimatePresence initial={false}>
                    {worn.map((w, k) => {
                      const bx = boxOf(w.slot, layered, set);
                      const enter =
                        change === "preview" ? { opacity: 0 } : change === "swap" ? { opacity: 0, y: -10, scale: 1.025 } : change === "instant" ? false : { opacity: 0, y: -14, rotate: bx.r + dir * 1.5 };
                      const show =
                        change === "preview"
                          ? { duration: 0.18 }
                          : change === "swap"
                            ? { type: "spring" as const, stiffness: 300, damping: 30 }
                            : change === "instant"
                              ? { duration: 0 }
                              : { delay: layDelay(k), duration: 0.52, ease: EASE };
                      const dim = focus !== null && focus !== w.slot && !preview;
                      return (
                        <motion.div
                          key={`${w.slot}-${w.piece.slug}-${w.piece.colour}`}
                          initial={enter}
                          animate={{ opacity: 1, y: 0, scale: 1, rotate: bx.r, transition: show }}
                          exit={change === "preview" || change === "swap" ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, x: -dir * 10, transition: { duration: 0.22 } }}
                          className="absolute"
                          style={{ ...boxPx(bx), zIndex: bx.z }}
                        >
                          <motion.span
                            className="absolute inset-0"
                            animate={{ opacity: dim ? 0.55 : 1, scale: focus === w.slot && !preview ? 1.02 : 1, y: cheer ? [0, -6 - (cheer % 2) * 0.01, 0] : 0 }}
                            transition={{ opacity: { duration: 0.2 }, scale: { duration: 0.2 }, y: { duration: 0.5, delay: (worn.length - 1 - k) * 0.05, ease: EASE } }}
                          >
                            <PieceArt piece={w.piece} align={bx.align} eager={k < 2} />
                          </motion.span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                {/* Sneakers at the foot, to finish the lay (not part of the fit) */}
                {!photo && (
                  // eslint-disable-next-line @next/next/no-img-element -- decorative cut-out
                  <img
                    src="/rack/acc/sneakers-clear.webp"
                    alt=""
                    aria-hidden
                    draggable={false}
                    decoding="async"
                    className="absolute object-contain [filter:drop-shadow(0_6px_8px_rgba(0,0,0,0.12))]"
                    style={{ left: figLeft + figW * 0.31, top: figTop + figH * 0.93, width: figW * 0.38, height: figH * 0.07, zIndex: 5 }}
                  />
                )}
              </div>

              {/* The lines, from each garment to its name */}
              {mode !== "dots" && (
                <svg aria-hidden className="pointer-events-none absolute inset-0 z-[45] h-full w-full overflow-visible">
                  {points.map((p) => {
                    const rail = p.side === "left" ? railL : railR;
                    const dy = p.ly - p.y;
                    const kink = rail + (p.side === "left" ? 1 : -1) * Math.min(12, Math.abs(dy));
                    const knee = rail + (p.side === "left" ? 1 : -1) * (Math.abs(dy) + 8);
                    const d = Math.abs(dy) < 1 ? `M ${p.x} ${p.y} H ${rail}` : `M ${p.x} ${p.y} H ${knee} L ${kink} ${p.ly} H ${rail}`;
                    return (
                      <motion.path
                        key={`${base.key}-${p.slot}-${committed(p.slot)}`}
                        d={d}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                        className={`transition-[color] duration-200 ${focus === p.slot ? "text-ink" : "text-ink/25"}`}
                        initial={drawn ? { pathLength: 0 } : false}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: lineDelay, duration: 0.45, ease: EASE }}
                      />
                    );
                  })}
                </svg>
              )}
              {/* The dots, and the names on their rails */}
              {points.map((p, k) => (
                <div key={`${base.key}-${p.slot}-${committed(p.slot)}`}>
                  <motion.button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onMouseEnter={() => point(p.slot)}
                    onMouseLeave={() => point(null)}
                    onClick={() => {
                      setSwapping(p.slot);
                      document.getElementById(`fit-piece-${p.slot}`)?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
                    }}
                    initial={drawn ? { scale: 0 } : false}
                    animate={{ scale: 1, transition: { delay: Math.max(0, lineDelay - 0.06) + k * 0.05, type: "spring", stiffness: 520, damping: 22 } }}
                    whileHover={{ scale: 1.3, transition: { duration: 0.15 } }}
                    className="absolute z-[46] -ml-3 -mt-3 grid h-6 w-6 cursor-pointer place-items-center"
                    style={{ left: p.x, top: p.y }}
                  >
                    {mode === "dots" ? (
                      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-ink font-mono text-[10px] font-semibold text-paper ring-2 ring-paper">{p.n}</span>
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-ink ring-2 ring-paper" />
                    )}
                  </motion.button>
                  {mode !== "dots" && (
                    <motion.div
                      initial={drawn ? { opacity: 0, x: p.side === "left" ? 8 : -8 } : false}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: lineDelay + 0.18, duration: 0.35, ease: EASE }}
                      className="absolute z-[46] -translate-y-1/2"
                      style={p.side === "left" ? { right: box.w - railL + 8, top: p.ly } : { left: railR + 8, top: p.ly }}
                    >
                      <Link
                        href={`/product/${p.piece.slug}`}
                        title={p.piece.name}
                        onMouseEnter={() => point(p.slot)}
                        onMouseLeave={() => point(null)}
                        className={`group flex items-baseline gap-1.5 leading-tight ${p.side === "left" ? "flex-row-reverse text-right" : ""}`}
                        style={{ maxWidth: labelMax(p.side) }}
                      >
                        <span className="font-mono text-[10px] text-ink/60">{two(p.n)}</span>
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={p.piece.slug}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`line-clamp-2 bg-[linear-gradient(currentColor,currentColor)] bg-no-repeat pb-px text-[12.5px] font-semibold transition-[background-size] duration-300 ${p.side === "left" ? "bg-right-bottom" : "bg-left-bottom"} ${focus === p.slot ? "bg-[length:100%_1px]" : "bg-[length:0%_1px]"}`}
                          >
                            {narrow ? short(p.piece.name) : p.piece.name}
                          </motion.span>
                        </AnimatePresence>
                      </Link>
                    </motion.div>
                  )}
                </div>
              ))}

              {/* The close look: the garment at 2.4×, around where its line starts */}
              <AnimatePresence>
                {lens && !photo && <Lens key={lens} p={points.find((x) => x.slot === lens)} boxPx={boxPx} railL={railL} railR={railR} />}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* One row: what the fit is (left), where you are (right); the progress is its top line */}
          <div className="relative flex h-12 shrink-0 items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/60">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-ink/15">
              <motion.span
                className="absolute inset-y-0 left-0 w-full origin-left bg-ink"
                initial={false}
                animate={{ scaleX: looks.length > 1 ? index / (looks.length - 1) : 1 }}
                transition={{ duration: 0.6, ease: EASE }}
              />
              {groups.slice(1).map((g) => (
                <span key={g.key} className="absolute -top-[3px] h-[7px] w-px bg-ink/30" style={{ left: `${((g.fits[0].at - 0.5) / (looks.length - 1)) * 100}%` }} />
              ))}
            </span>
            <span className="min-w-0 truncate">
              {kept.pieces.length} pieces · {profile ? "Your size" : "Size"} <span className="text-ink">{sizeText}</span>
              {!photo && <span className="hidden sm:inline"> · Sneakers for styling</span>}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-1">
              <span className="mr-1 tabular-nums">
                <span className="font-semibold text-ink">{two(index + 1)}</span> / {two(looks.length)}
              </span>
              <button
                type="button"
                onClick={() => go(index - 1)}
                disabled={index === 0}
                aria-label="Previous fit"
                aria-controls="fits-stage"
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-full text-ink transition-[background-color,opacity] hover:bg-ink/5 disabled:cursor-default disabled:opacity-25"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                disabled={index === looks.length - 1}
                aria-label="Next fit"
                aria-controls="fits-stage"
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-full text-ink transition-[background-color,opacity] hover:bg-ink/5 disabled:cursor-default disabled:opacity-25"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </span>
          </div>
        </div>

        {/* Right: the story, the pieces, buying it */}
        <article aria-label={`${base.groupLabel} · ${base.label}`} className="relative z-10 flex min-h-0 min-w-0 flex-col overflow-x-clip pb-24 pt-4 lg:pb-8 lg:pt-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={base.key} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
              <motion.p initial={motionOn ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60">
                {base.groupLabel} · {kicker}
              </motion.p>
              <h3 className="display mt-1.5 flex flex-wrap gap-x-[0.22em] text-[36px] leading-[0.9] lg:text-[44px]">
                {base.label.split(" ").map((word, i) => (
                  <span key={i} className="inline-block overflow-hidden pb-[0.04em]">
                    <motion.span className="inline-block" initial={motionOn ? { y: "100%" } : false} animate={{ y: 0 }} transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease: EASE }}>
                      {word}
                    </motion.span>
                  </span>
                ))}
              </h3>
              <motion.p initial={motionOn ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.45, ease: EASE }} className="mt-3 text-[16px] font-semibold leading-snug">
                {base.note}
              </motion.p>
              <motion.p initial={motionOn ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.45, ease: EASE }} className="mt-1 text-[14px] leading-relaxed text-ink/65">
                {storyOf(kept)}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          {/* The pieces, numbered */}
          <ol className="no-scrollbar mt-4 divide-y divide-ink/10 border-y border-ink/10 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-4 lg:[mask-image:linear-gradient(#000_calc(100%-28px),transparent)]">
            {keptWorn.map((w, k) => {
              const on = focus === w.slot || swapping === w.slot;
              const alts = options[w.slot].filter((o) => !kept.pieces.some((x) => x.slug === o.slug));
              const size = sizeOf(w.piece);
              const left = w.piece.sizes.find((s) => s.size === size)?.stock ?? 0;
              return (
                <motion.li
                  id={`fit-piece-${w.slot}`}
                  key={`${base.key}-${w.slot}`}
                  initial={motionOn ? { opacity: 0, y: 6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + k * 0.06, duration: 0.4, ease: EASE }}
                  onMouseEnter={() => setFocus(w.slot)}
                  onMouseLeave={() => setFocus(null)}
                  onFocus={() => setFocus(w.slot)}
                  onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocus(null)}
                  className="relative py-3 pl-3"
                >
                  <span aria-hidden className={`absolute bottom-3 left-0 top-3 w-[2px] origin-top bg-ink transition-transform duration-300 ${on ? "scale-y-100" : "scale-y-0"}`} />
                  <div className="grid grid-cols-[18px_52px_minmax(0,1fr)] gap-x-2.5">
                    <span className="pt-0.5 font-mono text-[10px] font-semibold">{two(w.n)}</span>
                    <Link href={`/product/${w.piece.slug}`} aria-hidden tabIndex={-1} className="relative block h-[64px] w-[52px] [@media(max-height:800px)]:h-[52px]">
                      <PieceArt piece={w.piece} align="center" />
                    </Link>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <Link href={`/product/${w.piece.slug}`} className="min-w-0 truncate text-[13px] font-semibold uppercase tracking-[0.03em] underline-offset-4 hover:underline">
                          {w.piece.name}
                        </Link>
                        <span className="ml-auto shrink-0 text-[13.5px] font-medium tabular-nums">{formatPrice(w.piece.price)}</span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink/60">
                        <span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-ink/20" style={{ background: w.piece.hex }} />
                        {w.piece.colour}
                        {left > 0 && left <= 3 && size !== "ONE" && (
                          <span className="text-ink/75">
                            · Only {left} left in {size}
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-3">
                          {mine[w.slot] && (
                            <button type="button" onClick={() => swapIn(w.slot, null)} className="min-h-8 cursor-pointer underline underline-offset-2 hover:text-ink">
                              Undo swap
                            </button>
                          )}
                          {alts.length > 0 && (
                            <button
                              type="button"
                              ref={(el) => {
                                swapButtons.current[w.slot] = el;
                              }}
                              aria-expanded={swapping === w.slot}
                              onClick={() => setSwapping(swapping === w.slot ? null : w.slot)}
                              className="inline-flex min-h-8 cursor-pointer items-center gap-1 font-semibold text-ink"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                                <path d="M7 4L3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" />
                              </svg>
                              Swap the {SLOT_NAME[w.slot]}
                            </button>
                          )}
                        </span>
                      </p>
                      <Sizes piece={w.piece} size={size} onPick={pick(w.piece)} />
                    </div>
                  </div>
                  {/* Others for this place on the body: hover to try it on, tap to keep it */}
                  <AnimatePresence initial={false}>
                    {swapping === w.slot && (
                      <motion.div
                        initial={motionOn ? { opacity: 0, height: 0 } : false}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        onAnimationComplete={() => document.getElementById(`fit-piece-${w.slot}`)?.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" })}
                        className="overflow-hidden"
                      >
                        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60">
                          <span className="[@media(hover:hover)]:hidden">Tap one to swap</span>
                          <span className="hidden [@media(hover:hover)]:inline">Hover to try it on · tap to keep</span>
                        </p>
                        <div
                          role="group"
                          aria-label={`Swap the ${SLOT_NAME[w.slot]}`}
                          onKeyDown={(e) => {
                            if (e.key !== "Escape") return;
                            tryOn(w.slot, null);
                            setSwapping(null);
                            swapButtons.current[w.slot]?.focus();
                          }}
                          className="no-scrollbar -mx-1 mt-1.5 flex gap-2 overflow-x-auto px-1 py-1"
                          onMouseLeave={() => preview && tryOn(w.slot, null)}
                        >
                          {alts.map((o, j) => (
                            <motion.button
                              key={o.slug}
                              type="button"
                              onClick={() => swapIn(w.slot, o)}
                              onMouseEnter={() => tryOn(w.slot, o)}
                              onFocus={() => tryOn(w.slot, o)}
                              initial={motionOn ? { opacity: 0, y: 6 } : false}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: j * 0.04, duration: 0.3, ease: EASE }}
                              className="flex w-[150px] shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-paper/70 p-1.5 text-left ring-1 ring-ink/10 transition-[box-shadow,background-color] hover:bg-paper hover:ring-ink focus-visible:ring-2 focus-visible:ring-ink"
                            >
                              <span className="relative block h-12 w-10 shrink-0">
                                <PieceArt piece={o} align="center" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[12.5px] font-semibold">{o.name}</span>
                                <span className="block text-[12px] tabular-nums text-ink/60">{formatPrice(o.price)}</span>
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

          {/* What goes in the bag, and buying it */}
          <div ref={buyBlock} className="shrink-0 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/60">All {kept.pieces.length} pieces</span>
              <span className="relative overflow-hidden text-[24px] font-semibold tabular-nums">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={total} className="inline-block" initial={motionOn ? { y: "-100%", opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                    {formatPrice(total)}
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12px] text-ink/60">
              {keptWorn.map((w) => `${short(w.piece.name)} ${sizeOf(w.piece) === "ONE" ? "" : (sizeOf(w.piece) ?? "–")}`.trim()).join(" · ")}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={addAll}
                disabled={!ready}
                aria-label={`Add the fit · ${formatPrice(total)}`}
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
                className="inline-flex h-12 flex-[0.85] cursor-pointer items-center justify-center whitespace-nowrap rounded-full border border-ink/30 px-4 text-[13px] font-semibold uppercase tracking-[0.06em] transition-[border-color,background-color,color,scale] hover:border-ink hover:bg-ink hover:text-paper active:scale-[0.98] disabled:opacity-40"
              >
                Quick buy
              </button>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink/60">
              {missing ? (
                <span className="text-ink">Pick a size for the {missing.name}.</span>
              ) : added ? (
                <>
                  {kept.pieces.length} pieces added.{" "}
                  <Link href="/bag" className="font-semibold text-ink underline underline-offset-2">
                    View bag
                  </Link>
                </>
              ) : (
                <>
                  {delivery} · Pickup in store · Swap sizes within 14 days · Pay with {walletList()}
                </>
              )}
            </p>
            <Link href={`/fit?${encodeFit(fit)}`} className="mt-1 inline-flex min-h-11 items-center text-[13px] font-semibold underline underline-offset-4 lg:hidden">
              Build your own fit
            </Link>
          </div>
        </article>
      </div>

      {/* Phones: the fit and its total stay in reach while scrolling the story */}
      <AnimatePresence>
        {buyOut && (
          <motion.div
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 flex h-14 items-center gap-3 border-t border-ink/10 bg-paper/95 px-4 backdrop-blur-sm lg:hidden"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{base.label}</span>
              <span className="block text-[13px] tabular-nums">{formatPrice(total)}</span>
            </span>
            <button
              type="button"
              onClick={addAll}
              disabled={!ready}
              aria-label={added ? "This fit is in your bag" : "Add this fit to your bag"}
              className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-paper disabled:opacity-40"
            >
              <BagIcon className="h-4 w-4" />
              {added ? "In your bag" : "Add the fit"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The close look: a round lens showing the garment at 2.4× around the point its line starts from. */
function Lens({
  p,
  boxPx,
  railL,
  railR,
}: {
  p: { piece: LookPiece; n: number; x: number; y: number; ly: number; side: "left" | "right"; bx: Box } | undefined;
  boxPx: (bx: Box) => { left: number; top: number; width: number; height: number };
  railL: number;
  railR: number;
}) {
  if (!p) return null;
  const Z = 2.4;
  const R = 62;
  const px = boxPx(p.bx);
  const cx = p.side === "left" ? railL - 8 - R * 2 - 10 : railR + 8;
  const cy = Math.max(0, p.ly - R * 2 - 22);
  const fx = (p.x - px.left) * Z;
  const fy = (p.y - px.top) * Z;
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
      transition={{ duration: 0.28, ease: EASE }}
      className="pointer-events-none absolute z-[47]"
      style={{ left: Math.max(4, cx), top: cy }}
    >
      <div className="relative overflow-hidden rounded-full bg-paper shadow-[0_14px_30px_-18px_rgba(10,10,10,0.5)] ring-1 ring-ink/15" style={{ width: R * 2, height: R * 2 }}>
        <div className="absolute" style={{ width: px.width * Z, height: px.height * Z, left: R - fx, top: R - fy }}>
          <PieceArt piece={p.piece} align={p.bx.align} />
        </div>
      </div>
      <p className="mt-1.5 text-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/60">{two(p.n)} · up close</p>
    </motion.div>
  );
}

function Sizes({ piece, size, onPick }: { piece: LookPiece; size: Size | null; onPick: (s: Size) => void }) {
  if (piece.sizes.length === 1 && piece.sizes[0].size === "ONE") return <p className="mt-1.5 text-[12px] font-semibold text-ink/60">One size</p>;
  const current = piece.sizes.findIndex((s) => s.size === size);
  const open = piece.sizes.map((s, i) => (s.stock > 0 ? i : -1)).filter((i) => i >= 0);
  return (
    <div
      role="radiogroup"
      aria-label={`Size for ${piece.name}`}
      onKeyDown={(e) => {
        const at = open.indexOf(current);
        arrows(e, open.length, at < 0 ? 0 : at, (i) => onPick(piece.sizes[open[i]].size));
      }}
      className="mt-1 flex flex-wrap gap-0.5"
    >
      {piece.sizes.map((s, i) => {
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
            tabIndex={on || (current < 0 && i === open[0]) ? 0 : -1}
            onClick={() => onPick(s.size)}
            className={`relative h-11 min-w-11 cursor-pointer px-1.5 text-[13px] font-semibold transition-colors lg:h-9 lg:min-w-9 ${on ? "text-ink" : out ? "cursor-default text-ink/30 line-through" : "text-ink/55 hover:text-ink"}`}
          >
            {s.size}
            {on && <motion.span layoutId={`size-${piece.slug}`} aria-hidden className="absolute inset-x-2 bottom-1.5 h-px bg-ink" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          </button>
        );
      })}
    </div>
  );
}
