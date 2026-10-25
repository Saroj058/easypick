"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

import { EASE } from "./tokens";

// The Vault's reveals, shared so every section moves the same way. Text stays real text in the
// page; with less motion asked for it simply shows. Each watches its outer box coming into view,
// never the moving part: a line hidden behind its own mask is never "seen", so it would never open.

/** Lines that slide up from behind a mask, one after another, the first time they're seen. */
export function MaskLines({ lines, className = "", lineClassName = "", delay = 0, as: Tag = "h2" }: { lines: React.ReactNode[]; className?: string; lineClassName?: string; delay?: number; as?: "h1" | "h2" | "h3" | "p" }) {
  const still = useReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.3 });
  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em]">
          <motion.span className={`block ${lineClassName}`} initial={still ? false : { y: "105%" }} animate={still || seen ? { y: "0%" } : { y: "105%" }} transition={{ duration: 0.9, ease: EASE, delay: delay + i * 0.08 }}>
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** A small rise and fade, once, at 15% in view. */
export function FadeUp({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={still ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** A picture that opens upward from a clip while settling from a slight zoom. */
export function ClipReveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const still = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.2 });
  const open = still || seen;
  return (
    <div ref={ref} className={className}>
      <motion.div className="h-full w-full overflow-hidden" initial={still ? false : { clipPath: "inset(100% 0 0 0)" }} animate={open ? { clipPath: "inset(0% 0 0 0)" } : { clipPath: "inset(100% 0 0 0)" }} transition={{ duration: 1.2, ease: EASE, delay }}>
        <motion.div className="h-full w-full" initial={still ? false : { scale: 1.15 }} animate={open ? { scale: 1 } : { scale: 1.15 }} transition={{ duration: 1.4, ease: EASE, delay }}>
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}
