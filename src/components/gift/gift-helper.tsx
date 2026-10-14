"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";

// A small character on the gift page: the robot (ui/robot-hero.tsx) and a speech bubble. It asks
// whether this is their first time sending a gift here. No: a short, warm line and on to the
// pieces. Yes: it walks them through it, one bubble at a time (pick the piece; know the size,
// we deliver; don't know it, they pick it from a link or try it on in the store), and ends on a
// warm line. The answer is remembered on this browser, so a returning sender gets a hello instead.
// (Owner, 14 Oct 2026: in place of the four illustrated steps.)

const KEY = "ep-gift-how";

/** The 3D robot loads after the page, in the browser only. */
const Robot = dynamic(() => import("../ui/robot-hero").then((m) => m.RobotCharacter), {
  ssr: false,
  loading: () => null,
});

type Mode = "ask" | "no" | "back" | 0 | 1 | 2 | 3;

const STEPS: { title: string; line: string }[] = [
  {
    title: "First, choose the piece.",
    line: "Scroll down and pick whatever feels like them. Their size doesn't matter yet.",
  },
  {
    title: "Know their size?",
    line: "Choose it, and we deliver it to their door, wrapped, with your note.",
  },
  {
    title: "Not sure? No stress.",
    line: "They get a link and pick their own size. Or they come to our store, try it on, and carry the best one home.",
  },
  {
    title: "That's all it takes.",
    line: "The piece is the easy part. Remembering them is the sweet part, and you've already done that.",
  },
];

const noSubscribe = () => () => {};
const readSeen = () => {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
};

export function GiftHelper() {
  const still = useReducedMotion();
  const seen = useSyncExternalStore(noSubscribe, readSeen, () => false);
  const [chosen, setChosen] = useState<Mode | null>(null);
  const mode: Mode = chosen ?? (seen ? "back" : "ask");

  const go = (m: Mode) => {
    setChosen(m);
    try {
      localStorage.setItem(KEY, "seen");
    } catch {
      // Not remembered; they get asked again next time.
    }
  };
  const toPieces = () =>
    document.getElementById("pieces")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });

  const step = typeof mode === "number" ? mode : null;
  // Heart eyes for the warm lines.
  const loved = mode === "no" || mode === "back" || step === 3;

  const primary =
    "inline-flex h-10 cursor-pointer items-center rounded-full bg-ink px-5 text-[13px] font-semibold text-paper transition-[scale] duration-150 active:scale-[0.97]";
  const quiet =
    "inline-flex h-10 cursor-pointer items-center rounded-full border border-ink/30 px-5 text-[13px] font-semibold transition-[border-color] hover:border-ink";
  const link = "inline-flex h-10 cursor-pointer items-center px-1 text-[13px] font-semibold underline underline-offset-4";

  return (
    <section aria-labelledby="helper-h" className="flex items-end gap-3 md:gap-5">
      {/* The robot, standing on its own little floor */}
      <div className="relative h-[150px] w-[118px] shrink-0 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#f3f3f3_0%,#f3f3f3_58%,#dedede_100%)] md:h-[190px] md:w-[160px]">
        <Robot loved={loved} className="absolute inset-0" />
      </div>

      {/* The speech bubble, its tail pointing at the robot */}
      <div className="relative mb-4 min-w-0 flex-1 rounded-2xl border border-ink bg-paper px-4 py-3.5 md:px-5 md:py-4">
        <span aria-hidden className="absolute -left-[7px] bottom-6 h-3 w-3 rotate-45 border-b border-l border-ink bg-paper" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={String(mode)}
            initial={still ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={still ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            aria-live="polite"
          >
            {mode === "ask" && (
              <>
                <h2 id="helper-h" className="text-[17px] font-semibold leading-snug md:text-[19px]">
                  Hi, I&apos;m Pick. First time sending a gift here?
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => go(0)} className={primary}>
                    Yes, first time
                  </button>
                  <button type="button" onClick={() => go("no")} className={quiet}>
                    No, I&apos;ve done this
                  </button>
                </div>
              </>
            )}

            {(mode === "no" || mode === "back") && (
              <>
                <h2 id="helper-h" className="text-[17px] font-semibold leading-snug md:text-[19px]">
                  {mode === "no" ? "Look at you, back to make someone's day again." : "You're back. Someone's about to have a good day."}
                </h2>
                <p className="mt-1 text-[14px] leading-relaxed text-steel-dark">
                  {mode === "no"
                    ? "Whoever they are, they're lucky to have you."
                    : "I'd say they're lucky, but you already know that."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={toPieces} className={primary}>
                    Find the piece
                  </button>
                  <button type="button" onClick={() => go(0)} className={link}>
                    Show me how it works
                  </button>
                </div>
              </>
            )}

            {step !== null && (
              <>
                <p className="font-mono text-[11px] tabular-nums tracking-[0.14em] text-steel-dark">
                  {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
                </p>
                <h2 id="helper-h" className="mt-1 text-[17px] font-semibold leading-snug md:text-[19px]">
                  {STEPS[step].title}
                </h2>
                <p className="mt-1 max-w-[60ch] text-[14px] leading-relaxed text-steel-dark">{STEPS[step].line}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {step < STEPS.length - 1 ? (
                    <button type="button" onClick={() => go((step + 1) as Mode)} className={primary}>
                      Next
                    </button>
                  ) : (
                    <button type="button" onClick={toPieces} className={primary}>
                      Find the piece
                    </button>
                  )}
                  {step > 0 && (
                    <button type="button" onClick={() => go((step - 1) as Mode)} className={link}>
                      Back
                    </button>
                  )}
                  {/* Where they are in it */}
                  <span aria-hidden className="ml-auto flex gap-1.5">
                    {STEPS.map((_, i) => (
                      <span key={i} className={`h-[3px] rounded-full transition-[width,background-color] duration-300 ${i === step ? "w-6 bg-ink" : "w-2.5 bg-ink/20"}`} />
                    ))}
                  </span>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
