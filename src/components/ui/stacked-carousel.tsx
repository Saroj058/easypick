"use client";

import { animate, motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

// A fanned stack of cards: the one at the centre sits upright and in front, its neighbours lean
// away and drop back either side. Drag or swipe it, use the arrows or the arrow keys, or tap the
// centre card to open it. The cards go round in a ring.

interface Fan {
  distanceDivisor: number;
  velocityDivisor: number;
  sensitivity: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

const fanFor = (width: number): Fan =>
  width < 640
    ? { distanceDivisor: 120, velocityDivisor: 500, sensitivity: 180, x: 90, y: 20, rotation: 8, scale: 0.06 }
    : width < 1024
      ? { distanceDivisor: 160, velocityDivisor: 650, sensitivity: 220, x: 130, y: 30, rotation: 10, scale: 0.09 }
      : { distanceDivisor: 200, velocityDivisor: 800, sensitivity: 250, x: 170, y: 40, rotation: 12, scale: 0.12 };

export function StackedCarousel({
  count,
  renderCard,
  onSelect,
  onActivate,
  label = "Carousel",
  className,
  cardClassName,
}: {
  count: number;
  renderCard: (index: number) => React.ReactNode;
  /** Called when another card comes to the front. */
  onSelect?: (index: number) => void;
  /** Called when the front card is tapped. */
  onActivate?: (index: number) => void;
  label?: string;
  className?: string;
  cardClassName?: string;
}) {
  const progress = useMotionValue(0);
  const start = React.useRef(0);
  const dragged = React.useRef(false);
  const [width, setWidth] = React.useState(1280);

  React.useEffect(() => {
    const read = () => setWidth(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  const fan = React.useMemo(() => fanFor(width), [width]);
  const front = (p: number) => ((Math.round(p) % count) + count) % count;

  const go = (target: number) => {
    onSelect?.(front(target));
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) progress.set(target);
    else animate(progress, target, { type: "spring", stiffness: 200, damping: 30, mass: 1 });
  };

  const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    let shift = Math.round(-info.offset.x / fan.distanceDivisor + -info.velocity.x / fan.velocityDivisor);
    shift = Math.max(-3, Math.min(3, shift));
    go(Math.round(start.current) + shift);
  };

  const arrow = "absolute top-[136px] z-[60] sm:top-[176px] lg:top-[200px] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/60 text-white backdrop-blur transition hover:bg-black";

  return (
    <div className={cn("relative select-none", className)} role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="relative flex h-[21rem] w-full items-start justify-center overflow-hidden sm:h-[26rem] lg:h-[30rem]">
        {/* A transparent surface over the cards takes the drag, the tap and the keys. */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0}
          tabIndex={0}
          role="button"
          aria-label={`${label}: left and right arrows change the card, Enter opens it`}
          onDragStart={() => {
            start.current = progress.get();
            dragged.current = true;
          }}
          onDrag={(_, info) => progress.set(progress.get() - info.delta.x / fan.sensitivity)}
          onDragEnd={onDragEnd}
          onTap={() => {
            // A drag ends with a tap event too; only a real tap opens the card.
            if (dragged.current) dragged.current = false;
            else onActivate?.(front(progress.get()));
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              go(Math.round(progress.get()) - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              go(Math.round(progress.get()) + 1);
            } else if (e.key === "Enter") onActivate?.(front(progress.get()));
          }}
          className="absolute inset-0 z-50 cursor-grab touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:cursor-grabbing"
        />

        {Array.from({ length: count }, (_, i) => (
          <FanCard key={i} index={i} total={count} progress={progress} fan={fan} className={cardClassName}>
            {renderCard(i)}
          </FanCard>
        ))}

        {count > 1 && (
          <>
            <button type="button" aria-label="Previous" onClick={() => go(Math.round(progress.get()) - 1)} className={`${arrow} left-1 md:left-3`}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" aria-label="Next" onClick={() => go(Math.round(progress.get()) + 1)} className={`${arrow} right-1 md:right-3`}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FanCard({ index, total, progress, fan, className, children }: { index: number; total: number; progress: MotionValue<number>; fan: Fan; className?: string; children: React.ReactNode }) {
  // The card does not clip: what is drawn in it may hang below it, and the stage keeps room for that.
  // How far this card is from the front, the short way round the ring.
  const offset = useTransform(progress, (p) => {
    let diff = (index - p) % total;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  });
  const x = useTransform(offset, (o) => o * fan.x);
  const rotate = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 0 : o * fan.rotation));
  const y = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 0 : Math.abs(o) * fan.y));
  const scale = useTransform(offset, (o) => 1 - Math.abs(o) * fan.scale);
  const opacity = useTransform(offset, [-total / 2, -total / 2 + 0.5, 0, total / 2 - 0.5, total / 2], [0, 1, 1, 1, 0]);
  const zIndex = useTransform(offset, (o) => Math.round(100 - Math.abs(o) * 10));
  const shade = useTransform(offset, [-2, -0.5, 0, 0.5, 2], [0.55, 0.25, 0, 0.25, 0.55]);

  return (
    <motion.div style={{ x, rotate, y, scale, opacity, zIndex }} className={cn("pointer-events-none absolute top-6 h-56 w-44 sm:top-8 sm:h-72 sm:w-56 lg:top-10 lg:h-80 lg:w-64", className)}>
      {children}
      {/* Cards further back sit in shadow. */}
      <motion.div style={{ opacity: shade }} className="pointer-events-none absolute inset-0 bg-black" />
    </motion.div>
  );
}
