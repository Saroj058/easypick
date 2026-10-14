"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { GiftBox, GiftNote } from "./gift-box";

// "First time sending a gift here?" A small question under the gift card balance. Yes opens the
// four steps, each with a picture of that moment; No folds it away. The answer is remembered on
// this browser, so a returning sender isn't asked again.

const KEY = "ep-gift-how";

const STEPS: { n: string; title: string; line: string; art: React.ReactNode }[] = [
  {
    n: "01",
    title: "Pick a piece.",
    line: "Choose it below. You don't need their size.",
    art: (
      <div className="relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small cut-out photograph */}
        <img src="/rack/everyday-hoodie.webp" alt="" className="absolute inset-0 m-auto h-[82%] w-auto object-contain [filter:drop-shadow(0_10px_12px_rgba(0,0,0,0.18))]" />
        <span className="absolute bottom-3 right-3 rounded-full bg-volt px-2.5 py-1 text-[11px] font-semibold">Send it as a gift</span>
      </div>
    ),
  },
  {
    n: "02",
    title: "Write a note.",
    line: "A few words, the wrap, and pay with eSewa.",
    art: (
      <div className="flex h-full w-full items-center justify-center">
        <div className="w-[230px] origin-center -rotate-3 scale-[0.62]">
          <GiftNote to="Sam" from="You" message="Wear it well." />
        </div>
      </div>
    ),
  },
  {
    n: "03",
    title: "They get a link.",
    line: "By email. They pick their size, online or in our store.",
    art: (
      <div className="flex h-full w-full items-center justify-center">
        {/* A phone, with the message they receive */}
        <div className="h-[132px] w-[86px] rounded-[16px] border-[3px] border-ink bg-paper p-1.5 shadow-[0_12px_20px_-12px_rgba(0,0,0,0.5)]">
          <div className="mx-auto mb-1.5 h-1 w-6 rounded-full bg-ink/20" />
          <div className="rounded-lg rounded-tl-none bg-mist px-1.5 py-1 text-[7.5px] leading-tight">A gift for you, from a friend.</div>
          <div className="mt-1.5 rounded-md bg-ink px-1.5 py-1 text-center text-[7px] font-semibold uppercase tracking-[0.06em] text-paper">Pick my size</div>
          <div className="mt-1.5 grid grid-cols-4 gap-0.5">
            {["S", "M", "L", "XL"].map((s) => (
              <span key={s} className={`rounded-sm border py-0.5 text-center font-mono text-[6px] ${s === "M" ? "border-ink bg-ink text-paper" : "border-ink/20"}`}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    n: "04",
    title: "It arrives, wrapped.",
    line: "With your note. Wrong size? They swap it within 14 days.",
    art: (
      <div className="flex h-full w-full items-center justify-center">
        <GiftBox tag={["FOR SAM", "FROM YOU"]} className="w-[150px]" />
      </div>
    ),
  },
];

export function GiftHow() {
  const still = useReducedMotion();
  // null: not asked yet on this browser. Read once, after the page has loaded.
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [read, setRead] = useState(false);
  if (!read && typeof window !== "undefined") {
    setRead(true);
    try {
      const v = localStorage.getItem(KEY);
      if (v === "no") setAnswer("no");
    } catch {
      // No storage: just ask.
    }
  }
  const choose = (v: "yes" | "no") => {
    setAnswer(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // Not remembered; fine.
    }
  };

  return (
    <section aria-labelledby="how-h">
      {/* The question */}
      <div className="flex flex-col gap-3 rounded-2xl border border-ink/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5">
        <h2 id="how-h" className="flex items-center gap-3 font-semibold">
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-volt font-mono text-[14px]">
            ?
          </span>
          {answer === "yes" ? "Here's how it works." : "First time sending a gift here?"}
        </h2>
        <div className="flex gap-2">
          {answer === "yes" ? (
            <button type="button" onClick={() => choose("no")} className="inline-flex h-10 cursor-pointer items-center rounded-full px-4 text-[13px] font-semibold underline underline-offset-4">
              Got it, hide this
            </button>
          ) : (
            <>
              <button type="button" onClick={() => choose("yes")} className="inline-flex h-10 cursor-pointer items-center rounded-full bg-ink px-5 text-[13px] font-semibold text-paper transition-[scale] duration-150 active:scale-[0.97]">
                Yes, show me
              </button>
              {answer !== "no" && (
                <button type="button" onClick={() => choose("no")} className="inline-flex h-10 cursor-pointer items-center rounded-full border border-ink/30 px-5 text-[13px] font-semibold transition-[border-color] hover:border-ink">
                  No
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* The four steps, each with a picture of that moment */}
      <AnimatePresence initial={false}>
        {answer === "yes" && (
          <motion.ol
            key="how"
            initial={still ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={still ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-4 pt-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4"
          >
            {STEPS.map((s, i) => (
              <motion.li
                key={s.n}
                initial={still ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: still ? 0 : 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-[78%] shrink-0 snap-start rounded-2xl border border-ink/15 bg-paper p-3 sm:w-[46%] md:w-auto"
              >
                <div className="h-[170px] overflow-hidden rounded-xl bg-mist/60">{s.art}</div>
                <p className="mt-3 font-mono text-[12px] tracking-[0.12em] text-steel-dark">{s.n}</p>
                <p className="display mt-1 text-[26px] leading-none">{s.title}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-steel-dark">{s.line}</p>
                {/* The way on to the next step */}
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="absolute -right-[18px] top-[85px] z-10 hidden h-8 w-8 items-center justify-center rounded-full border border-ink bg-paper text-[14px] lg:flex">
                    →
                  </span>
                )}
              </motion.li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  );
}
