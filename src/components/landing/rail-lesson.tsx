"use client";

import { animate, useReducedMotion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PieceControls, type RailPiece } from "@/components/home/rail-wall";
import { ProductImage } from "@/components/product-image";
import { CoverflowCarousel } from "@/components/ui/coverflow-carousel";
import type { Size } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;

/** The lesson, one step at a time: what the hand does and what the caption says (ms from the start). */
const SCRIPT = [
  { at: 0, part: "row", say: "01 · Swipe the rail" },
  { at: 1700, part: "card", say: "02 · The one in front is yours" },
  { at: 3200, part: "sizes", say: "03 · Tap your size" },
  { at: 4900, part: "buy", say: "04 · Buy now pays here" },
  { at: 6400, part: "bag", say: "05 · Or keep it in the bag" },
] as const;

/**
 * How to shop on the rail, taught on the rail itself (owner, 27 Oct 2026: "use the exact card design
 * of the rails … it should feel like the system is teaching how to use it"): the real cover-flow row
 * and the real card details under it, played by a hand: it swipes the row, points at the piece in
 * front, taps a size, then Buy now and the bag. Nothing is bought or put in the bag; it can't be
 * touched (inert). Less motion: the last step, still, with every caption listed.
 */
export function RailLesson({ pieces }: { pieces: RailPiece[] }) {
  const still = !!useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const hand = useRef<HTMLSpanElement>(null);
  const [step, setStep] = useState(still ? SCRIPT.length - 1 : 0);
  const [index, setIndex] = useState(still ? 1 : 0);
  const [picked, setPicked] = useState<Size | null>(null);
  const [bagged, setBagged] = useState(still);
  const front = pieces[index % pieces.length];
  const firstSize = (front.colours[0]?.sizes.find((x) => x.left > 0 && x.size !== "ONE")?.size ?? null) as Size | null;

  // The script: each step at its time; the row moves on in the first, the size is tapped in the third.
  useEffect(() => {
    if (still) return;
    const timers = [
      ...SCRIPT.map((s, i) => window.setTimeout(() => setStep(i), s.at)),
      window.setTimeout(() => setIndex(1), 800),
      window.setTimeout(() => setPicked(firstSize), SCRIPT[2].at + 900),
      window.setTimeout(() => setBagged(true), SCRIPT[4].at + 800),
    ];
    return () => timers.forEach(clearTimeout);
  }, [still, firstSize]);

  // The hand goes to the part the step is about (measured, so it lands on the real thing) and presses.
  useEffect(() => {
    const box = root.current;
    const el = hand.current;
    if (!box || !el || still) return;
    const part = SCRIPT[step].part;
    const target = box.querySelector<HTMLElement>(`[data-part="${part}"]`) ?? box.querySelector<HTMLElement>("[data-part='row']");
    if (!target) return;
    const b = box.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const x = r.left - b.left + r.width / 2 - 14;
    const y = r.top - b.top + r.height / 2 - 14;
    if (part === "row") {
      // A drag from right to left across the row, twice.
      void animate(el, { x: [x + 70, x - 70, x + 70, x - 70], y, opacity: [0, 1, 1, 1], scale: [1, 0.85, 1, 0.85] }, { duration: 1.5, ease: "easeInOut" });
    } else {
      void animate(el, { x, y, opacity: 1, scale: [1, 1, 0.8, 1] }, { duration: 0.9, ease: EASE, times: [0, 0.55, 0.75, 1] });
    }
  }, [step, still, picked]);

  const say = SCRIPT[step].say;
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      <div ref={root} inert aria-hidden className="relative w-full select-none">
        <div data-part="row">
          <CoverflowCarousel
            count={pieces.length}
            index={index}
            interactive={false}
            aspect={1.25}
            cardWidth="clamp(118px, 13vw, 190px)"
            loop={pieces.length >= 5}
            overhang="12px"
            label="The rail, shown"
            cardClassName="[&_img]:pointer-events-none"
            renderSlide={(i) => (
              <>
                <ProductImage image={pieces[i].image} category={pieces[i].category} colourHex={pieces[i].colours[0]?.hex ?? "#888"} decorative sizes="190px" className="h-full overflow-hidden" />
                {i === index % pieces.length && (
                  <>
                    <span data-part="card" className="absolute inset-0" />
                    {/* The card's bag button, as on the real rail */}
                    <span data-part="bag" className="absolute bottom-1 left-1 z-10 grid h-11 w-11 place-items-center">
                      <span className={`grid h-9 w-9 place-items-center rounded-full ring-1 backdrop-blur-md transition-colors duration-300 ${bagged ? "bg-ink text-paper ring-ink" : "bg-paper/80 text-ink ring-ink/10"}`}>
                        <ShoppingBag aria-hidden className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                    </span>
                  </>
                )}
              </>
            )}
          />
        </div>
        <div className="-mt-4 px-2">
          <PieceControls key={front.id} piece={front} mySize={null} onBuy={() => {}} demo={{ picked }} />
        </div>
        {/* The hand: a fingertip */}
        {!still && <span ref={hand} className="pointer-events-none absolute left-0 top-0 z-[300] block size-7 rounded-full border border-ink bg-paper/70 opacity-0 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)]" />}
      </div>
      {/* What the hand is doing, in words */}
      {still ? (
        <ol className="mt-3 grid gap-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#111]/75">
          {SCRIPT.map((s) => (
            <li key={s.say}>{s.say}</li>
          ))}
        </ol>
      ) : (
        <p aria-hidden className="mt-2 h-4 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#111]">
          {say}
        </p>
      )}
    </div>
  );
}
