"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

export interface ReelCard {
  src: string;
  name: string;
  price: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const subVis = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};

/**
 * The rail, played by itself (owner, 26 Oct 2026: "say that you can scroll on the rails, make it
 * creative"): real pieces hanging from one thin rail, sliding along one at a time as if someone were
 * scrolling, a small ring dragging across in step like a thumb. The piece that stops in front grows a
 * little and shows its name with the price under it, small and thin, as on the real rail. Still for
 * people who ask for less motion, and while the tab is hidden.
 */
export function RailDemo({ reel, every = 2100, className = "" }: { reel: ReelCard[]; /** ms between moves */ every?: number; className?: string }) {
  const still = !!useReducedMotion();
  const hidden = useSyncExternalStore(subVis, () => document.hidden, () => false);
  const [at, setAt] = useState(0);
  const n = reel.length;
  useEffect(() => {
    if (still || hidden || n < 2) return;
    const t = setInterval(() => setAt((a) => (a + 1) % n), every);
    return () => clearInterval(t);
  }, [still, hidden, n, every]);

  return (
    <div aria-hidden className={`relative h-full w-full overflow-hidden ${className}`}>
      {/* The rail */}
      <span className="absolute inset-x-0 top-[9%] h-[3px] rounded-full bg-[#111]" />
      {reel.map((p, i) => {
        // The shortest way round, so the row loops without a jump.
        let o = i - at;
        if (o > n / 2) o -= n;
        if (o < -n / 2) o += n;
        const front = o === 0;
        return (
          <motion.div
            key={p.src}
            className="absolute left-1/2 top-[9%] flex h-[84%] w-[30%] origin-top flex-col items-center"
            initial={false}
            animate={{ x: `calc(-50% + ${o * 118}%)`, scale: front ? 1.08 : 0.84, opacity: Math.abs(o) > 2 ? 0 : front ? 1 : 0.45 }}
            transition={{ duration: still ? 0 : 0.8, ease: EASE }}
            style={{ zIndex: 10 - Math.abs(o) }}
          >
            {/* The hanger */}
            <span className="block h-[clamp(14px,3vh,28px)] w-px bg-[#111]/60" />
            <Image src={p.src} alt="" width={468} height={503} sizes="(min-width: 768px) 10vw, 28vw" className="h-[66%] w-full object-contain object-top grayscale [filter:drop-shadow(0_18px_14px_rgba(0,0,0,0.18))]" />
            <motion.span initial={false} animate={{ opacity: front ? 1 : 0, y: front ? 0 : 6 }} transition={{ duration: 0.4, ease: EASE, delay: front ? 0.3 : 0 }} className="mt-3 block whitespace-nowrap text-center">
              <span className="block text-[12px] font-medium text-[#111] md:text-[13px]">{p.name}</span>
              <span className="mt-0.5 block text-[11.5px] font-light tabular-nums text-[#111]/70 md:text-[12.5px]">{p.price}</span>
            </motion.span>
          </motion.div>
        );
      })}
      {/* The thumb: a ring that drags left in step with each move */}
      {!still && n > 1 && (
        <motion.span
          className="absolute bottom-[1%] left-[calc(50%-16px)] block size-8 rounded-full border border-[#111]/70 bg-white/60"
          animate={{ x: [28, -28, -28], opacity: [0, 1, 0], scale: [1, 0.86, 1] }}
          transition={{ duration: every / 1000, times: [0, 0.6, 1], repeat: Infinity, ease: EASE }}
        />
      )}
    </div>
  );
}
