"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatPrice } from "@/lib/format";
import type { Category, Product, Size } from "@/lib/types";
import { HangTag } from "./hang-tag";
import { ArrowIcon } from "./icons";

// The home page's wardrobe: a hollow niche cut into the white page, built here (no photograph),
// after the owner's sample picture, in white instead of warm.
//
//  - a shallow recess: a thin ceiling, two thin side walls and a white floor ledge round a back wall;
//  - light along the top inside edge, both sides and the bottom, and under / above each shelf;
//  - two thin white shelves make three compartments: a short one on top for accessories (a trailing
//    plant, the cap, books and other display pieces), then two tall ones for clothes;
//  - under each shelf a steel rail runs from one side wall to the other, with five black hangers;
//    the shop's own pieces hang from them (their product photos, cut out).
// Picking a piece (pointing at it, tapping it, or tabbing to it) shows its name, colour, sizes and
// its hang tag under the hollow, with the way to its page.

export interface NichePiece {
  product: Product;
  colour: { name: string; hex: string };
}

const HANGERS = 5;
/** How deep the recess looks, as a share of its own size: shallow, as in the sample. */
const D = "7%";
const W = "rgba(255,255,255,";
/** The accessories compartment on top (plant, cap, books, sneakers…). Off for now (owner, 9 Oct 2026): just the two rails of clothes. */
const ACCESSORIES = false;
const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

// How each kind hangs, measured against its hanger (a real hanger is about 42 cm across):
//  - tops sit on the hanger's shoulders, so the hanger's neck shows in the collar and only its hook
//    is above the piece; laid out with the sleeves, a tee is about twice the hanger's width, a hoodie
//    or jacket a little more;
//  - trousers hang from a clip hanger by the waistband: narrow at the top, and the longest thing on
//    the rail.
const HANG: Record<Category, { width: string; top: string }> = {
  tees: { width: "196%", top: "27%" },
  hoodies: { width: "206%", top: "9%" },
  jackets: { width: "200%", top: "15%" },
  "co-ords": { width: "150%", top: "24%" },
  bottoms: { width: "112%", top: "50%" },
  accessories: { width: "90%", top: "60%" },
};

// Pieces photographed already hanging (public/rack/hung/<slug>.webp, cut from the owner's wardrobe
// photograph by scripts/rack-hung.mjs): real drape, on their own hanger, cut off level where they
// meet the rail. The number is the piece's width against its hanger slot: the photograph's proportions, a little enlarged.
const HUNG: Record<string, number> = {
  "oversized-heavy-tee": 223,
  "everyday-hoodie": 255,
  "boxy-pocket-tee": 204,
  "brushed-crewneck": 248,
  "washed-co-ord-set": 205,
  "tapered-jogger": 142,
  "coach-jacket": 245,
  "relaxed-straight-jean": 145,
  "fleece-quarter-zip": 236,
  "wide-cargo-pant": 156,
};

/** A wash of light coming off one edge of a box, brightest at the edge. */
function Wash({ from, reach, strength = 1 }: { from: "top" | "bottom" | "left" | "right"; reach: string; strength?: number }) {
  const along = from === "top" || from === "bottom";
  const angle = { top: "180deg", bottom: "0deg", left: "90deg", right: "270deg" }[from];
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        [from]: 0,
        ...(along ? { left: 0, right: 0, height: reach } : { top: 0, bottom: 0, width: reach }),
        background: `linear-gradient(${angle}, ${W}${strength}) 0%, ${W}${0.7 * strength}) 18%, ${W}${0.28 * strength}) 52%, ${W}0) 100%)`,
      }}
    />
  );
}

/** A black hanger with a steel hook, drawn so it stays crisp at any size. Tops get the shaped one; trousers a bar with two clips. */
function Hanger({ clips = false, hookOnly = false }: { clips?: boolean; /** The piece's photograph has its own hanger: only the hook over the rail is drawn. */ hookOnly?: boolean }) {
  return (
    <svg viewBox="0 0 60 66" className="block h-auto w-full overflow-visible" aria-hidden>
      <path d="M30 24 V15 q0 -7 5.5 -7 q5.5 0 5 5.5" fill="none" stroke="#8e8e8e" strokeWidth="1.8" strokeLinecap="round" />
      {hookOnly ? null : clips ? (
        <>
          <path d="M30 23 V30" stroke="#8e8e8e" strokeWidth="1.8" />
          <path d="M7 31 H53" stroke="#141414" strokeWidth="3.6" strokeLinecap="round" />
          {[12, 43].map((x) => (
            <g key={x}>
              <rect x={x} y="28" width="5.5" height="11" rx="1" fill="#b9b9b9" stroke="#6f6f6f" strokeWidth="0.6" />
              <rect x={x + 1.4} y="35" width="2.7" height="3" fill="#6f6f6f" />
            </g>
          ))}
        </>
      ) : (
        <path d="M30 23 L5 47 q-3.5 3.5 1 6 H54 q4.500 -2.500 1 -6 Z" fill="none" stroke="#141414" strokeWidth="4.2" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** The trailing plant: the leaves are a cut-out photograph, the white pot is drawn so it matches the niche. */
function Plant({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`relative aspect-[1/0.72] shrink-0 [filter:drop-shadow(6px_6px_5px_rgba(0,0,0,0.2))] ${className}`}>
      <span className="absolute rounded-b-[18%] bg-[linear-gradient(90deg,#d2d2cf,#ffffff_30%,#f5f5f3_66%,#c4c4c1)] [clip-path:polygon(0_0,100%_0,87%_100%,13%_100%)]" style={{ left: "31%", width: "37%", top: "38%", bottom: 0 }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- a small cut-out photograph of the leaves */}
      <img src="/rack/plant-trail.webp" alt="" draggable={false} className="absolute left-0 top-0 block h-auto w-full max-w-none" />
    </div>
  );
}

const shade = "[filter:drop-shadow(4px_3px_3px_rgba(0,0,0,0.22))]";

/** Books lying in a stack, for the accessories shelf. */
function BookStack({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex shrink-0 flex-col items-center ${shade} ${className}`}>
      {[
        ["82%", "#c6ff3d"],
        ["94%", "#ecebe6"],
        ["100%", "#141414"],
      ].map(([w, c]) => (
        <span key={c} className="relative block aspect-[8/1] rounded-[1px]" style={{ width: w, background: c }}>
          <span className="absolute inset-y-[22%] right-[6%] w-[12%] bg-white/55" />
        </span>
      ))}
    </div>
  );
}

/** Books standing in a row, the last one leaning. */
function BookRow({ className = "" }: { className?: string }) {
  const books = [
    ["100%", "#141414"],
    ["86%", "#ecebe6"],
    ["94%", "#55613a"],
    ["78%", "#8e8e93"],
    ["90%", "#f4f4f2"],
  ];
  return (
    <div aria-hidden className={`flex aspect-[1/0.78] shrink-0 items-end gap-[3%] ${shade} ${className}`}>
      {books.map(([h, c], i) => (
        <span key={i} className={`relative block flex-1 rounded-[1px] ${i === books.length - 1 ? "origin-bottom-left rotate-[9deg]" : ""}`} style={{ height: h, background: c }}>
          <span className="absolute inset-x-[25%] top-[12%] h-[6%] bg-white/50" />
        </span>
      ))}
    </div>
  );
}

/**
 * A photographed display piece for the accessories shelf (public/rack/acc/<name>.webp).
 * The beanie is cut out. The sneakers, sunglasses and bottle have white parts that can't be told
 * from a white background, so instead of being cut out their white is made see-through (how far a
 * pixel is from white is how solid it is): the wall shows through and their own soft shadows stay.
 */
function Accessory({ name, cut = false, className = "" }: { name: string; cut?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small photograph, already compressed
    <img src={`/rack/acc/${name}.webp`} alt="" aria-hidden draggable={false} className={`block h-auto shrink-0 ${cut ? shade : ""} ${className}`} />
  );
}

export function HeroNiche({ upper, lower, cap }: { /** Tops, on the first rail. */ upper: NichePiece[]; /** Bottoms and jackets, on the second. */ lower: NichePiece[]; /** The cap on the accessories shelf, if it is on sale. */ cap: NichePiece | null }) {
  const all = [...upper, ...lower, ...(cap ? [cap] : [])];
  const [activeSlug, setActiveSlug] = useState(upper[Math.min(1, upper.length - 1)]?.product.slug ?? all[0]?.product.slug ?? null);
  const sel = all.find((p) => p.product.slug === activeSlug) ?? all[0] ?? null;
  const sizes = sel ? sel.product.variants.filter((v) => v.colour === sel.colour.name).sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)) : [];
  const oneSize = sizes.length === 1 && sizes[0].size === "ONE";

  /** A piece that can be picked: pointing at it or tapping it shows its details and tag in the bottom compartment. */
  const router = useRouter();
  const pick = (piece: NichePiece) => ({
    type: "button" as const,
    // The first tap picks it; a tap on the piece already picked opens its page.
    onClick: () => (piece.product.slug === activeSlug ? router.push(`/product/${piece.product.slug}`) : setActiveSlug(piece.product.slug)),
    onMouseEnter: () => setActiveSlug(piece.product.slug),
    onFocus: () => setActiveSlug(piece.product.slug),
    "aria-pressed": piece.product.slug === activeSlug,
    "aria-label": `${piece.product.name}, ${piece.colour.name}, ${formatPrice(piece.product.salePrice ?? piece.product.price)}`,
  });

  /** One shelf with the rail under it and what hangs there. */
  const shelf = (top: string, pieces: NichePiece[], items?: React.ReactNode, /** No shelf above: the rail hangs straight under the ceiling. */ bare = false) => (
    <div className="absolute inset-x-0" style={{ top }}>
      {/* Light on the wall just above the shelf, from a strip along its back edge */}
      <div className="absolute inset-x-0 bottom-full h-[clamp(14px,3.4vw,40px)]">
        <Wash from="bottom" reach="100%" strength={0.95} />
      </div>
      {/* What stands on the shelf */}
      {items && !bare && <div className="absolute inset-x-[1.5%] bottom-full z-20 flex items-end justify-between">{items}</div>}
      {/* The shelf: a thin white slab let into both side walls, with its shadow under it */}
      <div aria-hidden className={`relative z-10 -mx-[1%] h-[7px] bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_60%,#ececea_100%)] shadow-[0_2px_3px_rgba(0,0,0,0.16)] md:h-[11px] ${bare ? "invisible" : ""}`} />
      {/* The light strip under the shelf */}
      <div className="relative h-0">
        <div aria-hidden className="absolute inset-x-0 top-0 z-[1] h-[2px] bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.95)]" />
        <Wash from="top" reach="clamp(48px,11vw,120px)" />
      </div>
      {/* The rail, tight under the shelf, fixed into the two side walls */}
      <div aria-hidden className="absolute inset-x-0 top-[17px] z-[2] h-[4px] rounded-full bg-[linear-gradient(180deg,#fafafa_0%,#c9c9c9_38%,#7c7c7c_72%,#a8a8a8_100%)] shadow-[0_9px_5px_rgba(0,0,0,0.13)] md:top-[30px] md:h-[7px]" />
      {["left-0", "right-0"].map((side) => (
        <span key={side} aria-hidden className={`absolute ${side} top-[19px] z-[3] h-[10px] w-[4px] -translate-y-1/2 rounded-[1px] bg-[linear-gradient(180deg,#f4f4f4,#8c8c8c_60%,#666)] md:top-[33.5px] md:h-[17px] md:w-[6px]`} />
      ))}
      {/* Five hangers along it, each with a piece */}
      {/* Packed close and side-on, as on a real rail; the picked piece's slot opens wide and its neighbours slide along to make room. */}
      <ul className="absolute inset-x-[4%] top-[11px] z-[4] flex justify-center [container-type:inline-size] md:top-[19px]">
        {Array.from({ length: HANGERS }, (_, i) => {
          const piece = pieces[i];
          const on = piece?.product.slug === activeSlug;
          const hung = piece ? HUNG[piece.product.slug] : undefined;
          return (
            <li key={i} className={`relative flex justify-center transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${on ? "z-10 w-[24cqw]" : "w-[7.4cqw]"}`}>
              <div className="relative w-[7.9cqw] shrink-0 [perspective:700px]">
              <span aria-hidden className="block [filter:drop-shadow(5px_7px_4px_rgba(0,0,0,0.2))]">
                <Hanger clips={piece?.product.category === "bottoms"} hookOnly={Boolean(hung)} />
              </span>
              {piece && (
                <button
                  {...pick(piece)}
                  className={`absolute left-1/2 block -translate-x-1/2 origin-top cursor-pointer transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${hung ? "top-[9px] md:top-[17px]" : ""} ${on ? "scale-[1.08] [transform:rotateY(0deg)]" : "[transform:rotateY(-74deg)]"}`}
                  style={hung ? { width: `${hung}%` } : { width: HANG[piece.product.category].width, top: HANG[piece.product.category].top }}
                >
                  {/* As on a real rail, a piece hangs turned side-on; the picked one turns on its hook to face out. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- the piece's own photo, cut out; small and already compressed */}
                  <img src={hung ? `/rack/hung/${piece.product.slug}.webp` : `/rack/${piece.product.slug}.webp`} alt="" draggable={false} className={`block h-auto w-full transition-[filter] duration-300 ${on ? "[filter:drop-shadow(9px_14px_9px_rgba(0,0,0,0.34))]" : "[filter:drop-shadow(6px_9px_6px_rgba(0,0,0,0.22))]"}`} />
                </button>
              )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div>
      {/* No room is drawn round it: the white page is the wall, and this is a hole cut into the screen. */}
      <div role="group" aria-label="The Easypick wardrobe: pieces from the shop, hung in a lit white hollow" className={`relative -mx-4 ${ACCESSORIES ? "aspect-[7/6]" : "aspect-[5/4]"} overflow-hidden bg-paper text-ink md:-mx-8 lg:mx-0`}>
        <div className="absolute inset-0 shadow-[0_0_0_1px_rgba(0,0,0,0.09)]">
          {/* The four faces of the recess, in perspective: ceiling in soft shade, sides, and the lit floor ledge */}
          <div aria-hidden className="absolute inset-x-0 top-0 bg-[linear-gradient(180deg,#d8d8d5,#ecece9)]" style={{ height: D, clipPath: `polygon(0 0,100% 0,calc(100% - ${D}) 100%,${D} 100%)` }} />
          <div aria-hidden className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#e0e0dd,#f6f6f4)]" style={{ width: D, clipPath: `polygon(0 0,100% ${D},100% calc(100% - ${D}),0 100%)` }} />
          <div aria-hidden className="absolute inset-y-0 right-0 bg-[linear-gradient(270deg,#dadad7,#f4f4f2)]" style={{ width: D, clipPath: `polygon(100% 0,0 ${D},0 calc(100% - ${D}),100% 100%)` }} />
          <div aria-hidden className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,#ffffff,#f3f3f1)]" style={{ height: D, clipPath: `polygon(${D} 0,calc(100% - ${D}) 0,100% 100%,0 100%)` }} />

          {/* The back wall: a touch off white, so the light on it shows */}
          <div className="absolute bg-[#e9e9e6]" style={{ inset: D }}>
            {/* Soft shade in the middle of each compartment, away from the lights */}
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.025)_7%,rgba(0,0,0,0)_12%,rgba(0,0,0,0.04)_36%,rgba(0,0,0,0)_52%,rgba(0,0,0,0.04)_80%,rgba(0,0,0,0)_100%)]" />
            {/* Light strips round the inside of the recess */}
            <div aria-hidden className="absolute inset-x-0 top-0 z-[1] h-[2px] bg-white shadow-[0_0_10px_3px_rgba(255,255,255,0.95)]" />
            <Wash from="top" reach="13%" />
            <Wash from="bottom" reach="15%" />
            <Wash from="left" reach="5%" strength={0.9} />
            <Wash from="right" reach="5%" strength={0.9} />

            {/* The short top compartment: accessories and display pieces. Under its shelf, the tops. */}
            {shelf(
              ACCESSORIES ? "11%" : "-1%",
              upper,
              <>
                <Plant className="w-[9.5%]" />
                {cap && (
                  <button {...pick(cap)} className={`w-[8%] cursor-pointer transition-transform duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${cap.product.slug === activeSlug ? "-translate-y-0.5 scale-[1.08]" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the cap's own photo, cut out */}
                    <img src={`/rack/${cap.product.slug}.webp`} alt="" draggable={false} className={`block h-auto w-full ${shade}`} />
                  </button>
                )}
                <BookStack className="w-[10%]" />
                <Accessory name="sneakers-clear" className="-mb-[0.4%] w-[13.5%]" />
                <BookRow className="w-[8%]" />
                <Accessory name="beanie" cut className="w-[6.4%]" />
                <Accessory name="bottle-clear" className="-mb-[0.3%] w-[2.7%]" />
                {/* Sunglasses resting on the last stack of books */}
                <div className="flex w-[9%] shrink-0 flex-col items-center">
                  <Accessory name="sunglasses-clear" className="-mb-[6%] w-[84%]" />
                  <BookStack className="w-full" />
                </div>
              </>,
              !ACCESSORIES,
            )}
            {/* Second shelf: under it, the bottoms and jackets */}
            {shelf(ACCESSORIES ? "44%" : "38.5%", lower)}

            {/* The bottom compartment: the picked piece's details on the left, its tag on the right */}
            <div className="absolute inset-x-0 bottom-0" style={{ top: ACCESSORIES ? "77%" : "78%" }}>
              <div aria-hidden className="relative z-10 -mx-[1%] h-[7px] bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_60%,#ececea_100%)] shadow-[0_2px_3px_rgba(0,0,0,0.16)] md:h-[11px]" />
              <div className="relative h-0">
                <div aria-hidden className="absolute inset-x-0 top-0 z-[1] h-[2px] bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.95)]" />
                <Wash from="top" reach="clamp(30px,7vw,80px)" />
              </div>
              {sel && (
                <div className="absolute inset-x-[4%] bottom-[5%] top-[9px] z-[5] flex items-center justify-between gap-3 md:top-[13px]">
                  <div className="min-w-0" aria-live="polite">
                    <p className="truncate text-[14px] font-semibold md:text-lg">{sel.product.name}</p>
                    <p className="flex items-center gap-2 text-[12px] text-ink/75 md:mt-1 md:text-[14px]">
                      <span aria-hidden className="h-3 w-3 rounded-full border border-ink/30 md:h-3.5 md:w-3.5" style={{ background: sel.colour.hex }} />
                      {sel.colour.name}
                      <span className="font-mono text-ink md:hidden">· {formatPrice(sel.product.salePrice ?? sel.product.price)}</span>
                    </p>
                    <p className="flex gap-2.5 font-mono text-[12px] text-ink/85 md:mt-1 md:gap-3 md:text-[13px]">
                      <span className="sr-only">Sizes: </span>
                      {oneSize
                        ? "One size"
                        : sizes.map((v) =>
                            v.stock > 0 ? (
                              <span key={v.sku}>
                                {v.size}
                                {v.stock <= 3 && <sup className="ml-px text-[9px] text-ink/70">{v.stock}</sup>}
                              </span>
                            ) : (
                              <s key={v.sku} className="text-steel-dark">
                                {v.size}
                                <span className="sr-only"> sold out</span>
                              </s>
                            ),
                          )}
                    </p>
                  </div>
                  <Link href={`/product/${sel.product.slug}`} className="group inline-flex min-h-11 shrink-0 items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] md:text-sm">
                    View piece
                    <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                  {/* The tag: the piece's fixed price and its measurements in cm */}
                  <div className="relative h-[92px] w-[72px] shrink-0 self-end max-md:hidden" aria-hidden>
                    <div className="absolute bottom-0 left-0 w-[200px] origin-bottom-left rotate-[3deg] scale-[0.36] [filter:drop-shadow(0_6px_10px_rgba(0,0,0,0.18))]">
                      <HangTag key={sel.product.id} product={sel.product} colour={sel.colour.name} className="animate-fade-up [--hole:var(--color-mist)]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
