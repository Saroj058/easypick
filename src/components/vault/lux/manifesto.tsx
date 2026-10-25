"use client";

import { Fragment, useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

import { EASE, L } from "./tokens";

// The Vault, section 2: the admin's intro line set large, lighting up word by word as it scrolls
// past, then the Vault's real numbers (owner, 25 Oct 2026: luxury revamp). The numbers are always
// printed at their true value in the page's HTML; the count-up only plays on top of that.

const fmt = (n: number) => n.toLocaleString("en-US");

export function VaultManifesto({ intro, numbers }: { intro: string; numbers: { label: string; value: number }[] }) {
  const ref = useRef<HTMLElement>(null);
  const still = useReducedMotion();
  // 0 when the section's top reaches the lower quarter of the screen, 1 when its middle is a bit above centre.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.75", "center 0.4"] });

  const text = intro.trim();
  const words = text ? text.split(/\s+/) : [];
  const shown = numbers.some((n) => n.value > 0);
  if (!words.length && !shown) return null;

  return (
    <section ref={ref} aria-label="The Vault" className={`${L.section} ${L.ivory}`}>
      <div className={`${L.wrap} grid grid-cols-12 gap-x-4 md:gap-x-6`}>
        <p aria-hidden className={`col-span-12 mb-8 md:mb-12 ${L.label} ${L.dim}`}>[ 01 — The Vault ]</p>

        {words.length > 0 && (
          <p className={`col-span-12 md:col-span-9 md:col-start-3 ${L.serif} text-[34px] leading-[1.02] sm:text-[44px] md:text-[64px] md:leading-[0.95] lg:text-[76px]`}>
            {words.map((w, i) => (
              <Fragment key={i}>
                {still ? w : <Word word={w} i={i} n={words.length} progress={scrollYProgress} />}
                {i < words.length - 1 ? " " : null}
              </Fragment>
            ))}
          </p>
        )}

        {shown && (
          <dl className={`col-span-12 mt-16 grid border-t ${L.hair} pt-6 md:col-span-8 md:col-start-3 md:mt-28 md:pt-8 ${numbers.length <= 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"} gap-x-4 gap-y-10 md:gap-x-10`}>
            {numbers.map((n) => (
              <div key={n.label} className="flex min-w-0 flex-col-reverse gap-3">
                <dt className={`${L.label} ${L.dim}`}>{n.label}</dt>
                <dd className={`${L.serif} text-[44px] leading-[0.9] tabular-nums sm:text-[56px] md:text-[88px]`}>
                  <Count value={n.value} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

/** One word of the statement: 20% lit until the scroll reaches its share of the line, then full. */
function Word({ word, i, n, progress }: { word: string; i: number; n: number; progress: MotionValue<number> }) {
  // Each word lights over a slightly wider window than its share, so the light runs smoothly.
  const start = i / n;
  const end = Math.min(1, start + 2 / n);
  const opacity = useTransform(progress, [start, end], [0.2, 1]);
  return <motion.span style={{ opacity }}>{word}</motion.span>;
}

/** A real number that counts up once the first time it's seen. Before JS, and with less motion, it's just the number. */
function Count({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const still = useReducedMotion();
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const mv = useMotionValue(value);
  const label = useTransform(mv, (v) => fmt(Math.round(v)));

  useEffect(() => {
    if (!seen || still || value <= 0) return;
    mv.set(0);
    const run = animate(mv, value, { duration: 1.2, ease: EASE });
    return () => {
      run.stop();
      mv.set(value);
    };
  }, [seen, still, value, mv]);

  return <motion.span ref={ref}>{label}</motion.span>;
}
