"use client";

import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

// A quiet button with a band of light that keeps sweeping across its label and its edge.
// Here it is a link (it takes people somewhere), drawn in ink on white: the sweep is the
// label and the hairline border going from faint to full and back. With motion turned off
// it is a plain outlined pill.

const sweep = {
  initial: { "--x": "100%", scale: 0.8 },
  animate: { "--x": "-100%", scale: 1 },
  whileTap: { scale: 0.95 },
  transition: {
    repeat: Infinity,
    repeatType: "loop",
    repeatDelay: 1,
    type: "spring",
    stiffness: 20,
    damping: 15,
    mass: 2,
    scale: { type: "spring", stiffness: 200, damping: 5, mass: 0.5 },
  },
} as unknown as MotionProps;

export function ShinyLink({ href, children, className, ...props }: { href: string; children: React.ReactNode; className?: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  const still = useReducedMotion();
  return (
    // The link is 44px tall for the thumb; the pill inside it is what is drawn.
    <Link href={href} className={cn("group flex h-11 shrink-0 items-center", className)} {...props}>
      <motion.span {...(still ? {} : sweep)} className="relative block rounded-full px-5 py-2 transition-shadow duration-300 ease-in-out group-hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)]">
        <span
          className="relative flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.07em] text-ink"
          style={still ? undefined : { maskImage: "linear-gradient(-75deg, #000 calc(var(--x) + 20%), rgb(0 0 0 / 0.35) calc(var(--x) + 30%), #000 calc(var(--x) + 100%))" }}
        >
          {children}
        </span>
        <span
          aria-hidden
          style={{ mask: "linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box, linear-gradient(rgb(0,0,0), rgb(0,0,0))", maskComposite: "exclude" }}
          className={cn(
            "absolute inset-0 z-10 block rounded-[inherit] p-px",
            still ? "bg-ink/60" : "bg-[linear-gradient(-75deg,rgb(10_10_10/0.18)_calc(var(--x)+20%),rgb(10_10_10/0.95)_calc(var(--x)+25%),rgb(10_10_10/0.18)_calc(var(--x)+100%))]",
          )}
        />
      </motion.span>
    </Link>
  );
}
