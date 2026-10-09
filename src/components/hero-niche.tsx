import Link from "next/link";

import { formatPrice } from "@/lib/format";
import type { Category } from "@/lib/types";

// The home page's wardrobe: a hollow niche cut into the white page, built here (no photograph),
// after the owner's sample picture, in white instead of warm.
//
// Layout, copied from the sample:
//  - a shallow recess: a thin ceiling, two thin side walls and a white floor ledge round a back wall;
//  - light strips along the top inside edge, both sides and the bottom, and under / above each shelf;
//  - two thin white shelves make three compartments: accessories on top (a trailing plant at its
//    left end), then two for clothes;
//  - under each shelf a steel rail runs from one side wall to the other, with five slim black
//    hangers on it;
//  - one plant bottom right, on the floor ledge.
// The shop's own pieces hang from the hangers (their product photos, cut out); each leads to its page.

const HANGERS = 5;

/** A piece hung in the niche: its own product photo, cut out (public/rack/<slug>.webp, from scripts/rack-cutouts.mjs). */
export interface NichePiece {
  slug: string;
  name: string;
  price: number;
  category: Category;
}

/** The pieces with a cut-out photo. A new product needs scripts/rack-cutouts.mjs run, and its slug added here. */
export const NICHE_CUTOUTS = new Set(["boxy-pocket-tee", "brushed-crewneck", "coach-jacket", "everyday-hoodie", "fleece-quarter-zip", "oversized-heavy-tee", "relaxed-straight-jean", "six-panel-cap", "tapered-jogger", "washed-co-ord-set", "wide-cargo-pant"]);

// How each kind hangs, relative to its hanger: how wide it is, and where its top sits (tops cover
// the hanger's shoulders; trousers hang from its bar).
const HANG: Record<Category, { width: string; top: string }> = {
  tees: { width: "168%", top: "24%" },
  hoodies: { width: "176%", top: "12%" },
  jackets: { width: "172%", top: "16%" },
  "co-ords": { width: "128%", top: "22%" },
  bottoms: { width: "104%", top: "74%" },
  accessories: { width: "90%", top: "60%" },
};
/** How deep the recess looks, as a share of its own size: shallow, as in the sample. */
const D = "3.6%";
const W = "rgba(255,255,255,";

/** A wash of light coming off one edge of a box, brightest at the edge. */
function Wash({ from, reach, strength = 1, className = "" }: { from: "top" | "bottom" | "left" | "right"; reach: string; strength?: number; className?: string }) {
  const along = from === "top" || from === "bottom";
  const angle = { top: "180deg", bottom: "0deg", left: "90deg", right: "270deg" }[from];
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{
        [from]: 0,
        ...(along ? { left: 0, right: 0, height: reach } : { top: 0, bottom: 0, width: reach }),
        background: `linear-gradient(${angle}, ${W}${strength}) 0%, ${W}${0.7 * strength}) 18%, ${W}${0.28 * strength}) 52%, ${W}0) 100%)`,
      }}
    />
  );
}

/** A slim black hanger with a steel hook, drawn so it stays crisp at any size. */
function Hanger() {
  return (
    <svg viewBox="0 0 60 66" className="block h-auto w-full overflow-visible" aria-hidden>
      <path d="M30 24 V15 q0 -7 5.5 -7 q5.5 0 5 5.5" fill="none" stroke="#8e8e8e" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M30 23 L5 47 q-3.5 3.5 1 6 H54 q4.500 -2.500 1 -6 Z" fill="none" stroke="#141414" strokeWidth="4.2" strokeLinejoin="round" />
    </svg>
  );
}

/** A plant in a white pot: the leaves are a cut-out photograph, the pot is drawn so it matches the niche. */
function Plant({ kind, className = "" }: { kind: "up" | "trail"; className?: string }) {
  const up = kind === "up";
  return (
    <div aria-hidden className={`relative shrink-0 [filter:drop-shadow(8px_8px_7px_rgba(0,0,0,0.2))] ${up ? "aspect-[1/1.42]" : "aspect-[1/0.72]"} ${className}`}>
      <span
        className="absolute rounded-b-[18%] bg-[linear-gradient(90deg,#d2d2cf,#ffffff_30%,#f5f5f3_66%,#c4c4c1)] [clip-path:polygon(0_0,100%_0,87%_100%,13%_100%)]"
        style={up ? { left: "24%", width: "48%", top: "67%", bottom: 0 } : { left: "31%", width: "37%", top: "38%", bottom: 0 }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- a small cut-out photograph of the leaves */}
      <img src={up ? "/rack/plant-up.webp" : "/rack/plant-trail.webp"} alt="" draggable={false} className="absolute left-0 top-0 block h-auto w-full max-w-none" />
    </div>
  );
}

/**
 * One shelf with the rail under it. `top` is where the shelf sits on the back wall. Light comes off
 * the wall just above the shelf and from under it; the rail runs wall to wall with its hangers.
 */
function Shelf({ top, items, pieces = [], clearRight = false }: { top: string; items?: React.ReactNode; /** What hangs on the rail, left to right (five at most). */ pieces?: NichePiece[]; /** Keep the right end clear (the plant stands there). */ clearRight?: boolean }) {
  return (
    <div className="absolute inset-x-0" style={{ top }}>
      {/* Light on the wall just above the shelf, from a strip along its back edge */}
      <div className="absolute inset-x-0 bottom-full h-[clamp(22px,5vw,56px)]">
        <Wash from="bottom" reach="100%" strength={0.95} />
      </div>
      {/* What stands on the shelf */}
      {items && <div className="absolute inset-x-[1.5%] bottom-full z-20 flex items-end">{items}</div>}
      {/* The shelf: a thin white slab let into both side walls, with its shadow under it */}
      <div aria-hidden className="relative z-10 -mx-[1%] h-[7px] bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_60%,#ececea_100%)] shadow-[0_2px_3px_rgba(0,0,0,0.16)] md:h-[11px]" />
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
      {/* Five hangers along it: each hook loops over the rail and the hanger hangs below */}
      <ul className={`absolute top-[11px] z-[4] flex justify-between md:top-[19px] ${clearRight ? "left-[7%] right-[21%]" : "inset-x-[9%]"}`}>
        {Array.from({ length: HANGERS }, (_, i) => {
          const piece = pieces[i];
          return (
            <li key={i} className="relative w-[10.5%]">
              <span aria-hidden className="block [filter:drop-shadow(5px_7px_4px_rgba(0,0,0,0.2))]">
                <Hanger />
              </span>
              {piece && (
                // The piece itself, hanging: it leads to its page, and lifts a little when pointed at.
                <Link
                  href={`/product/${piece.slug}`}
                  aria-label={`${piece.name}, ${formatPrice(piece.price)}`}
                  title={`${piece.name} · ${formatPrice(piece.price)}`}
                  className="group absolute left-1/2 z-[1] block -translate-x-1/2 origin-top transition-transform duration-300 hover:z-10 hover:scale-[1.06] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  style={{ width: HANG[piece.category].width, top: HANG[piece.category].top }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- the piece's own photo, cut out; small and already compressed */}
                  <img src={`/rack/${piece.slug}.webp`} alt="" draggable={false} className="block h-auto w-full [filter:drop-shadow(7px_10px_7px_rgba(0,0,0,0.25))]" />
                  {/* Its name and price, shown when it is pointed at or focused */}
                  <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 font-mono text-[10px] font-semibold text-paper opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                    {piece.name} · {formatPrice(piece.price)}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function HeroNiche({ upper, lower, cap }: { /** Tops, on the first rail. */ upper: NichePiece[]; /** Bottoms and jackets, on the second. */ lower: NichePiece[]; /** The cap on the accessories shelf, if it is on sale. */ cap: NichePiece | null }) {
  return (
    // No room is drawn round it: the white page is the wall, and this is a hole cut into the screen.
    <div role="group" aria-label="The Easypick wardrobe: pieces from the shop, hung in a lit white hollow" className="absolute inset-0">
      <div className="absolute inset-0 shadow-[0_0_0_1px_rgba(0,0,0,0.09)]">
        {/* The four faces of the recess, in perspective: ceiling in soft shade, sides, and the lit floor ledge */}
        <div aria-hidden className="absolute inset-x-0 top-0 bg-[linear-gradient(180deg,#d8d8d5,#ecece9)]" style={{ height: D, clipPath: `polygon(0 0,100% 0,calc(100% - ${D}) 100%,${D} 100%)` }} />
        <div aria-hidden className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#e0e0dd,#f6f6f4)]" style={{ width: D, clipPath: `polygon(0 0,100% ${D},100% calc(100% - ${D}),0 100%)` }} />
        <div aria-hidden className="absolute inset-y-0 right-0 bg-[linear-gradient(270deg,#dadad7,#f4f4f2)]" style={{ width: D, clipPath: `polygon(100% 0,0 ${D},0 calc(100% - ${D}),100% 100%)` }} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,#ffffff,#f3f3f1)]" style={{ height: D, clipPath: `polygon(${D} 0,calc(100% - ${D}) 0,100% 100%,0 100%)` }} />

        {/* The back wall: a touch off white, so the light on it shows */}
        <div className="absolute bg-[#e9e9e6]" style={{ inset: D }}>
          {/* Soft shade in the middle of each compartment, away from the lights */}
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.03)_9%,rgba(0,0,0,0)_15%,rgba(0,0,0,0.04)_38%,rgba(0,0,0,0)_53%,rgba(0,0,0,0.04)_80%,rgba(0,0,0,0)_100%)]" />
          {/* Light strips round the inside of the recess */}
          <div aria-hidden className="absolute inset-x-0 top-0 z-[1] h-[2px] bg-white shadow-[0_0_10px_3px_rgba(255,255,255,0.95)]" />
          <Wash from="top" reach="17%" />
          <Wash from="bottom" reach="15%" />
          <Wash from="left" reach="5%" strength={0.9} />
          <Wash from="right" reach="5%" strength={0.9} />

          {/* Top compartment: accessories, with a trailing plant at the left end of the shelf */}
          <Shelf
            top="17%"
            pieces={upper}
            items={
              <>
                <Plant kind="trail" className="w-[11%]" />
                {cap && (
                  <Link href={`/product/${cap.slug}`} aria-label={`${cap.name}, ${formatPrice(cap.price)}`} title={`${cap.name} · ${formatPrice(cap.price)}`} className="ml-[3%] flex w-[40%] items-end justify-between transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                    {[0, 1, 2, 3].map((i) => (
                      // eslint-disable-next-line @next/next/no-img-element -- the cap's own photo, cut out
                      <img key={i} src="/rack/six-panel-cap.webp" alt="" draggable={false} className="h-auto w-[19%] [filter:drop-shadow(4px_3px_3px_rgba(0,0,0,0.3))]" />
                    ))}
                  </Link>
                )}
              </>
            }
          />
          {/* Second shelf: the two clothes compartments are above and below it */}
          <Shelf top="57%" pieces={lower} clearRight />

          {/* One plant, bottom right, on the floor ledge */}
          <div className="absolute bottom-0 right-[2.5%] z-[5] w-[11%]">
            <Plant kind="up" className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
