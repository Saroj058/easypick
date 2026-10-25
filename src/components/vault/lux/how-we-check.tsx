"use client";

import { motion, useReducedMotion } from "framer-motion";

import { FadeUp, MaskLines } from "./reveal";
import { EASE, L } from "./tokens";

// Section 7 of /vault: how a piece gets onto the wall, in three plain steps. Every line here is
// what the blueprint says we really do (papers kept, checked by hand, never restocked). No public
// verify page, certificates or outside authentication are claimed: those don't exist yet.

const STEPS = [
  {
    n: "I",
    title: "Sourced with papers",
    body: "Every piece comes in with its invoice. We keep the records for each one, so we always know where it came from.",
  },
  {
    n: "II",
    title: "Checked by hand",
    body: "Each piece is looked over by hand, inside and out, before it reaches the wall. We keep photos of every check.",
  },
  {
    n: "III",
    title: "One of each, never restocked",
    body: "Most pieces arrive as a single one, and none are brought back. When it’s gone, it’s gone.",
  },
] as const;

/** A small brass tick: the accent is kept for "checked by hand" marks. */
function Check() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-3.5 w-3.5 ${L.brass}`} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="square">
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

/** A hairline that draws in once: down the column's left edge on desktop, across its top on phone. */
function Hairline({ delay, first }: { delay: number; first: boolean }) {
  const still = useReducedMotion();
  const t = { duration: 1.1, ease: EASE, delay };
  return (
    <>
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 block h-px origin-left bg-[#ede8df]/[0.12] md:hidden"
        initial={still ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={t}
      />
      {!first && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 hidden w-px origin-top bg-[#ede8df]/[0.12] md:block"
          initial={still ? false : { scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={t}
        />
      )}
    </>
  );
}

export function HowWeCheck() {
  return (
    <section aria-labelledby="vault-how-we-check" className={`${L.section} ${L.ivory}`}>
      <div className={L.wrap}>
        <p className={`${L.label} ${L.dim}`}>[ 07 — How we check ]</p>
        <div id="vault-how-we-check">
          <MaskLines
            className={`${L.serif} mt-6 text-[44px] leading-[0.92] md:mt-8 md:text-[88px]`}
            lines={[
              <>
                Checked by <em className="italic">hand.</em>
              </>,
              "One of each.",
            ]}
          />
        </div>

        <ol className="mt-14 grid grid-cols-1 md:mt-24 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.n} className="relative py-10 md:px-10 md:py-2 md:first:pl-0 md:last:pr-0">
              <Hairline delay={0.1 + i * 0.08} first={i === 0} />
              <FadeUp delay={0.15 + i * 0.08}>
                <div className="flex items-start justify-between gap-6">
                  <span aria-hidden="true" className={`${L.serif} text-[72px] leading-[0.9] md:text-[96px]`}>
                    {s.n}
                  </span>
                  <span className="mt-3">
                    <Check />
                  </span>
                </div>
                <h3 className={`${L.serif} mt-8 text-[28px] leading-[0.95] md:mt-12 md:text-[32px]`}>
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className={`mt-4 max-w-[34ch] text-[15px] leading-[1.5] md:text-[16px] ${L.dim}`}>{s.body}</p>
              </FadeUp>
            </li>
          ))}
        </ol>

        <p className={`mt-14 max-w-[62ch] border-t pt-6 text-[13px] leading-[1.5] md:mt-24 ${L.hair} ${L.dim}`}>
          Brand names describe the pieces. Easypick is an independent store, not an official seller of these brands.
        </p>
      </div>
    </section>
  );
}
