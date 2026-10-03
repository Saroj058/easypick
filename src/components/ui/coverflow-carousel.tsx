"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export interface CoverflowCarouselProps {
  /** How many slides there are; each is drawn by `renderSlide`. */
  count: number;
  renderSlide: (index: number) => React.ReactNode;
  /** Called when another slide comes to the centre. */
  onSelect?: (index: number) => void;
  /** Called when the slide already at the centre is tapped. */
  onActivate?: (index: number) => void;
  /** Degrees the first neighbour tilts. */
  rotate?: number;
  /** How far the first neighbour recedes, as a fraction of card width. */
  depth?: number;
  /** Viewer distance as a multiple of card width: smaller is a wider lens. */
  perspective?: number;
  /** Exponent on distance. Below 1 the rake eases off as cards travel out. */
  falloff?: number;
  /** Opacity lost per step from the centre. */
  fade?: number;
  /** Any CSS length. Everything else is derived from it, so the rake scales. */
  cardWidth?: string;
  /** Card height as a multiple of its width (1 is square, 1.25 is a 4:5 photo). */
  aspect?: number;
  /** Space between cards, as a fraction of card width. */
  gap?: number;
  loop?: boolean;
  /** Room kept under the cards for anything hanging off them (a price tag). Any CSS length. */
  overhang?: string;
  /** The slide at the centre to begin with. */
  initial?: number;
  showNavigation?: boolean;
  /** Names the carousel for assistive tech. */
  label?: string;
  className?: string;
  cardClassName?: string;
}

/**
 * A cover-flow carousel: the slide at the centre faces you, its neighbours turn away and recede.
 * Drag or swipe it, use the arrows or the arrow keys, or tap a neighbour to bring it to the centre.
 */
export function CoverflowCarousel({
  count,
  renderSlide,
  onSelect,
  onActivate,
  rotate = 44,
  depth = 0.6,
  perspective = 3,
  falloff = 0.56,
  fade = 0.1,
  cardWidth = "clamp(148px, 22vw, 260px)",
  aspect = 1,
  gap = 0.05,
  loop = true,
  overhang = "0px",
  initial = 0,
  showNavigation = false,
  label = "Carousel",
  className,
  cardClassName,
}: CoverflowCarouselProps) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  /** Fractional card index at the centre. The single source of truth. */
  const posRef = React.useRef(initial);
  /** Where the current settle is headed. Stepping off `pos` instead would swallow a keypress that lands mid-flight. */
  const targetRef = React.useRef(initial);
  const widthRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const dragRef = React.useRef<{ id: number; x: number; pos: number; v: number; t: number; moved: number } | null>(null);
  const selectedRef = React.useRef(initial);

  const [selected, setSelected] = React.useState(initial);

  /** Nearest whole card, folded back into 0..count-1. */
  const indexAt = React.useCallback((pos: number) => ((Math.round(pos) % count) + count) % count, [count]);

  const select = React.useCallback(
    (index: number) => {
      if (index === selectedRef.current) return;
      selectedRef.current = index;
      setSelected(index);
      onSelect?.(index);
    },
    [onSelect],
  );

  // Paint straight to the DOM. Sixty state updates a second would re-render every card for numbers React never needs to see.
  const paint = React.useCallback(() => {
    const width = widthRef.current;
    if (!width) return;
    const pitch = width * (1 + gap);
    const pos = posRef.current;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;

      // Fold the distance into the shorter way round the ring. This is the whole looping mechanism: no cloned nodes.
      let offset = index - pos;
      if (loop) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }

      const distance = Math.abs(offset);
      // Both the tilt and the recession ease off as cards travel out, so the second card stays readable.
      const ramp = Math.pow(distance, falloff);
      // Capped short of edge-on so a far card never turns its back.
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);

      card.style.transform = `translateX(calc(-50% + ${offset * pitch}px)) translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`;

      // A card is teleported across the ring at exactly half a turn out, so it has to be gone by then or the jump is visible.
      const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
      card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge);
      card.style.zIndex = String(100 - Math.round(distance));
    });
  }, [count, depth, fade, falloff, gap, loop, rotate]);

  const settle = React.useCallback(
    (target: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      targetRef.current = target;
      select(indexAt(target));

      // People who have turned motion off get the new card at once.
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        posRef.current = target;
        paint();
        rafRef.current = null;
        return;
      }
      const step = () => {
        const remaining = target - posRef.current;
        if (Math.abs(remaining) < 0.0004) {
          posRef.current = target;
          paint();
          rafRef.current = null;
          return;
        }
        posRef.current += remaining * 0.16; // exponential ease-out
        paint();
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [indexAt, paint, select],
  );

  const clamp = React.useCallback((pos: number) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))), [count, loop]);

  const goTo = React.useCallback(
    (index: number) => {
      // Take the shorter way round rather than unwinding the whole ring.
      const target = loop ? index + Math.round((targetRef.current - index) / count) * count : index;
      settle(clamp(target));
    },
    [clamp, count, loop, settle],
  );

  const nudge = React.useCallback((by: number) => settle(clamp(Math.round(targetRef.current) + by)), [clamp, settle]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    targetRef.current = posRef.current;
    dragRef.current = { id: event.pointerId, x: event.clientX, pos: posRef.current, v: 0, t: performance.now(), moved: 0 };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;

    const pitch = widthRef.current * (1 + gap);
    if (!pitch) return;

    const now = performance.now();
    const previous = posRef.current;
    drag.moved = Math.max(drag.moved, Math.abs(event.clientX - drag.x));
    posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch);
    // Cards per second, for the throw.
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000;
    drag.t = now;

    select(indexAt(posRef.current));
    paint();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;

    // A tap, not a drag: bring the tapped card to the centre, or open it if it is already there.
    if (drag.moved < 6 && event.type === "pointerup") {
      const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-slide]");
      const index = hit ? Number(hit.dataset.slide) : -1;
      if (index >= 0) {
        if (index === selectedRef.current) onActivate?.(index);
        else goTo(index);
        return;
      }
    }
    // Let a flick carry, but never more than two cards.
    const carried = Math.max(-2, Math.min(2, drag.v * 0.18));
    settle(clamp(Math.round(posRef.current + carried)));
  };

  // Card width drives pitch, depth and perspective, so it is the only thing worth measuring, and only when the box changes.
  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const card = cardRefs.current[0];
      if (!card) return;
      widthRef.current = card.offsetWidth;
      paint();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [paint]);

  React.useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // The arrows sit at the middle of the cards, not of the cards plus what hangs under them.
  const arrow = "absolute top-[calc(50%-var(--cf-over)/2)] z-[200] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-ink/15 bg-paper/85 text-ink backdrop-blur transition hover:bg-paper disabled:opacity-30";

  return (
    <div className={cn("isolate w-full", className)} style={{ ["--cf-card" as string]: cardWidth, ["--cf-over" as string]: overhang }} role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="relative">
        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              nudge(-1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              nudge(1);
            } else if (event.key === "Enter") onActivate?.(selectedRef.current);
          }}
          // Vertical padding keeps the drop shadows clear of the overflow clip.
          className="cursor-grab overflow-hidden pb-[calc(2rem+var(--cf-over))] pt-8 outline-none focus-visible:ring-2 focus-visible:ring-ink active:cursor-grabbing"
          style={{
            perspective: `calc(var(--cf-card) * ${perspective})`,
            // Horizontal drag is ours; the page keeps vertical scrolling.
            touchAction: "pan-y",
          }}
        >
          <div className="relative select-none" style={{ height: `calc(var(--cf-card) * ${aspect})`, transformStyle: "preserve-3d" }}>
            {Array.from({ length: count }, (_, index) => (
              <div
                key={index}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                data-slide={index}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}`}
                aria-current={index === selected ? "true" : undefined}
                className={cn("absolute left-1/2 top-0 bg-photo shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] will-change-transform", cardClassName)}
                style={{ width: "var(--cf-card)", height: `calc(var(--cf-card) * ${aspect})` }}
              >
                {renderSlide(index)}
              </div>
            ))}
          </div>
        </div>

        {showNavigation && count > 1 && (
          <>
            <button type="button" aria-label="Previous" onClick={() => nudge(-1)} disabled={!loop && selected === 0} className={`${arrow} left-1 md:left-3`}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" aria-label="Next" onClick={() => nudge(1)} disabled={!loop && selected === count - 1} className={`${arrow} right-1 md:right-3`}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
