"use client";

import { Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** While Pick loads: the same height, the Easypick e turning. */
function PickLoader({ where }: { where: "gift" | "shop" }) {
  return (
    <section aria-label={where === "shop" ? "Pick, your shopping helper" : "Pick, your gift helper"} aria-busy className="relative !mb-8 -mt-6 md:!mb-10 md:-mt-10">
      <div className="grid min-h-[150px] place-items-center [perspective:600px] md:min-h-[190px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- the small brand mark */}
        <img src="/brand/mark.png" width={146} height={148} alt="" className="tour-spin h-10 w-auto opacity-80 motion-reduce:animate-none" />
        <span className="sr-only">Pick is on the way</span>
      </div>
    </section>
  );
}

// Whether Pick was left open in this tab, so a reload keeps the conversation in view.
const OPEN = "ep-pick-open";
const noop = () => () => {};
const readOpen = () => {
  try {
    return sessionStorage.getItem(OPEN) === "1";
  } catch {
    return false;
  }
};
const keepOpen = (v: boolean) => {
  try {
    if (v) sessionStorage.setItem(OPEN, "1");
    else sessionStorage.removeItem(OPEN);
  } catch {
    /* private mode: he starts as the button again */
  }
};

const PickChat = dynamic(() => import("./pick-chat").then((m) => m.PickChat), { ssr: false, loading: () => null });

/**
 * Pick, only when asked for (owner, 27 Oct 2026: "a button, want help from our AI assistant? Pick;
 * it makes Pick appear, and a cross on the right of his head makes him disappear and become the
 * button again"). Pick is a whole 3D scene, so nothing of him loads until the button is tapped.
 */
export function PickLazy({ where = "gift" }: { where?: "gift" | "shop" }) {
  const wasOpen = useSyncExternalStore(noop, readOpen, () => false);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const shown = chosen ?? wasOpen;
  const setShown = (v: boolean) => {
    keepOpen(v);
    setChosen(v);
  };
  // A question from the home page's Ask Pick (/shop?ask=…#pick): he opens and asks it straight away.
  // It comes off the address at once, so a reload doesn't ask it again.
  const [question, setQuestion] = useState<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("ask")?.trim().slice(0, 200);
    if (!q) return;
    url.searchParams.delete("ask");
    window.history.replaceState(window.history.state, "", url);
    keepOpen(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only readable after mount
    setChosen(true);
    setQuestion(q);
  }, []);
  const opener = useRef<HTMLButtonElement>(null);
  const hider = useRef<HTMLButtonElement>(null);
  const [moved, setMoved] = useState(false);
  // Keyboard focus follows: onto the cross when Pick appears, back to the button when he goes.
  useEffect(() => {
    if (!moved) return;
    (shown ? hider : opener).current?.focus();
  }, [shown, moved]);

  if (!shown)
    return (
      <div className="!mb-8 flex justify-center md:!mb-10">
        <button
          ref={opener}
          type="button"
          onClick={() => {
            setMoved(true);
            setShown(true);
          }}
          className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-full border border-ink/15 bg-paper py-1.5 pl-1.5 pr-5 text-[14px] font-semibold shadow-[0_10px_28px_-16px_rgba(10,10,10,0.45)] transition-[scale,border-color] hover:scale-[1.02] hover:border-ink active:scale-[0.98]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-volt">
            <Sparkles aria-hidden className="h-4 w-4" />
          </span>
          <span>
            Want help? <span className="text-steel-dark">Ask Pick, our AI assistant</span>
          </span>
        </button>
      </div>
    );
  return (
    <div className="relative">
      <button
        ref={hider}
        type="button"
        onClick={() => {
          setMoved(true);
          setShown(false);
        }}
        aria-label="Hide Pick"
        className="absolute right-0 top-0 z-20 grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-ink/15 bg-paper text-ink shadow-[0_6px_18px_-10px_rgba(10,10,10,0.5)] hover:border-ink md:-top-4"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
      <PickReady where={where} question={question} />
    </div>
  );
}

/** The loader stays until the chat's code has arrived. */
function PickReady({ where, question }: { where: "gift" | "shop"; question: string | null }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void import("./pick-chat").then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  return ready ? <PickChat where={where} question={question} /> : <PickLoader where={where} />;
}
