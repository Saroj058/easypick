"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, RotateCcw, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatPrice } from "@/lib/format";
import { GREETING, question, type PickState, type Quick } from "@/lib/pick/journey";
import type { PickCard } from "@/lib/pick/recommend";
import type { Mood, PickReply } from "@/lib/pick/turn";
import { ProductImage } from "../product-image";
import type { RobotMood } from "../ui/robot-hero";
import { SendSheet } from "./gift-pieces";

// Pick, the gift page's robot. No chat window: a small thought bubble over his head that walks with
// him. Ask him something (a tap or a few words) and the bubble thinks, then answers, with a few
// quick answers and, when he has them, up to three real pieces. Only the latest exchange shows.
// All of the thinking is on the server (/api/pick, lib/pick/turn.ts); this only draws it.
// What he knows (gift preferences only) is kept for this tab in sessionStorage.

const Robot = dynamic(() => import("../ui/robot-hero").then((m) => m.RobotCharacter), { ssr: false, loading: () => null });

const KEY = "ep-pick-v2";

interface Bubble {
  text: string;
  cards?: PickCard[];
  quick: Quick[];
}
interface Saved {
  state: PickState;
  bubble: Bubble;
  /** The customer's last words, shown small over his answer. */
  said?: string;
  hidden?: boolean;
}

const FIRST: Saved = {
  state: {},
  bubble: { text: `${GREETING} ${question("recipient", {}, []).text}`, quick: question("recipient", {}, []).quick },
};

export function PickChat() {
  const still = useReducedMotion();
  const [now, setNow] = useState<Saved>(FIRST);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [mood, setMood] = useState<RobotMood>("greeting");
  const [text, setText] = useState("");
  const [askBudget, setAskBudget] = useState(false);
  const [typed, setTyped] = useState<number | null>(null);
  const [sending, setSending] = useState<PickCard | null>(null);
  const band = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // Pick up where they left off in this tab.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw) as Saved;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
        if (typeof v?.bubble?.text === "string") setNow(v);
      }
    } catch {
      // Nothing kept: start fresh.
    }
    setReady(true);
    const t = setTimeout(() => setMood((m) => (m === "greeting" ? "curious" : m)), 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(now));
    } catch {
      // Private mode: not kept.
    }
  }, [now, ready]);

  // His answer types itself out, quickly (not with reduced motion).
  const line = now.bubble.text;
  useEffect(() => {
    if (!ready || still || !line) return;
    let n = 0;
    const step = Math.max(2, Math.ceil(line.length / 30));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts typing out a new answer
    setTyped(0);
    const id = setInterval(() => {
      n += step;
      if (n >= line.length) {
        clearInterval(id);
        setTyped(null);
      } else setTyped(n);
    }, 18);
    return () => clearInterval(id);
  }, [line, still, ready]);

  const ask = useCallback(
    async (body: { quick: Quick } | { text: string }, said: string) => {
      if (thinking) return;
      const before = now;
      setThinking(true);
      setMood("thinking");
      setAskBudget(false);
      setNow((c) => ({ ...c, said, hidden: false }));
      try {
        const res = await fetch("/api/pick", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state: before.state, ...body }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(res.status === 429 ? "busy" : "failed");
        const r = (await res.json()) as PickReply;
        setNow({
          state: r.state,
          said,
          bubble: { text: r.messages.map((m) => m.text).filter(Boolean).join(" "), cards: r.messages.flatMap((m) => m.cards ?? []), quick: r.quick },
        });
        setAskBudget(r.input === "budget");
        setMood(moodFor(r.mood));
        if (r.input === "budget") requestAnimationFrame(() => field.current?.focus());
      } catch (e) {
        // Nothing is lost: what he knew stays, and the same answers come back.
        setNow({
          ...before,
          said,
          bubble: {
            ...before.bubble,
            text:
              e instanceof Error && e.message === "busy"
                ? "That's a lot at once. Give me a moment, then try again."
                : "Hmm, I lost my train of thought. Try that again? You can also browse every piece below.",
          },
        });
        setMood("reassuring");
      } finally {
        setThinking(false);
      }
    },
    [now, thinking],
  );

  const choose = (q: Quick) => {
    if (q.action === "restart") {
      setNow({ state: {}, bubble: { text: `Fresh start. ${question("recipient", {}, []).text}`, quick: question("recipient", {}, []).quick } });
      setMood("greeting");
      setAskBudget(false);
      return;
    }
    if (q.action === "own-budget") {
      setAskBudget(true);
      setNow((c) => ({ ...c, said: q.label, bubble: { text: "Sure. Type it below, in rupees.", quick: [] } }));
      setMood("listening");
      requestAnimationFrame(() => field.current?.focus());
      return;
    }
    void ask({ quick: q }, q.label);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || thinking) return;
    setText("");
    const n = askBudget ? Number(t.replace(/[^0-9]/g, "")) : NaN;
    if (askBudget && n > 0) void ask({ quick: { label: t, set: { budget: n } } }, `Under ${formatPrice(n)}`);
    else void ask({ text: t }, t);
  };

  const pick = (c: PickCard) => {
    setSending(c);
    setNow((s) => ({ ...s, state: { ...s.state, picked: c.slug }, said: c.name, bubble: { ...s.bubble, text: `Great pick. ${c.name} it is. Now the note, the wrap and where it goes.` } }));
    setMood("happy");
  };

  const shown = typed === null ? line : line.slice(0, typed);
  const settled = typed === null && !thinking;
  const open = !now.hidden;

  return (
    <section aria-label="Pick, your gift helper">
      {/* Pick walks the whole width of the screen; his bubble walks with him (--pick-x is set by the robot). */}
      <div ref={band} className="relative mx-[calc(50%-50vw)] [--pick-x:0.5]">
        {/* Room for the bubble, which grows upward from just over his head */}
        <div className="relative flex min-h-[170px] items-end pb-6">
        <AnimatePresence>
          {open && (
            <motion.div
              key="bubble"
              initial={still ? false : { opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={still ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              // Above his head, following him, never off the edge of the screen.
              className="relative z-10 w-[min(340px,calc(100vw-24px))] origin-bottom -translate-x-1/2"
              style={{ left: "clamp(calc(min(340px, 100vw - 24px) / 2 + 12px), calc(var(--pick-x) * 100%), calc(100% - min(340px, 100vw - 24px) / 2 - 12px))" }}
            >
              {now.said && (
                <p className="mb-1.5 ml-auto w-fit max-w-[80%] truncate rounded-full bg-ink px-3 py-1 text-[12px] text-paper" aria-label="You said">
                  {now.said}
                </p>
              )}
              <div className="relative rounded-[22px] border border-ink bg-paper px-4 py-3 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]">
                <span className="absolute right-1.5 top-1.5 flex">
                  <button type="button" onClick={() => choose({ label: "Start again", action: "restart" })} aria-label="Start again" className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-steel-dark hover:bg-mist hover:text-ink">
                    <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNow((c) => ({ ...c, hidden: true }));
                      setMood("idle");
                    }}
                    aria-label="Hide Pick's bubble"
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-steel-dark hover:bg-mist hover:text-ink"
                  >
                    <X aria-hidden className="h-4 w-4" />
                  </button>
                </span>

                <div aria-live="polite" className="pr-14">
                  {thinking ? (
                    <p className="flex h-6 items-center gap-1.5" role="status" aria-label="Pick is thinking">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="h-2 w-2 rounded-full bg-ink/45 motion-safe:animate-bounce" style={{ animationDelay: `${d * 130}ms` }} />
                      ))}
                    </p>
                  ) : (
                    <p className="whitespace-pre-line text-[14.5px] leading-snug">{shown}</p>
                  )}
                </div>

                {settled && now.bubble.cards && now.bubble.cards.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5" aria-label="Pick's suggestions">
                    {now.bubble.cards.map((c) => (
                      <MiniCard key={c.slug} card={c} onSend={() => pick(c)} />
                    ))}
                  </ul>
                )}

                {settled && now.bubble.quick.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Quick answers">
                    {now.bubble.quick.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => choose(q)}
                        className="inline-flex h-8 cursor-pointer items-center rounded-full border border-ink/20 px-3 text-[12.5px] font-semibold transition-[border-color,background-color,color,scale] duration-150 hover:border-ink hover:bg-ink hover:text-paper active:scale-[0.97]"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* The thought trail down to his head */}
              <span aria-hidden className="absolute -bottom-3 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border border-ink bg-paper" />
              <span aria-hidden className="absolute -bottom-[22px] left-[calc(50%+6px)] h-1.5 w-1.5 rounded-full border border-ink bg-paper" />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        <div className="relative h-[150px] md:h-[180px]">
          <Robot mood={open ? mood : "inactive"} loved={mood === "happy"} followRef={band} className="absolute inset-0" />
        </div>
      </div>

      {/* One short line to talk to him */}
      <form onSubmit={submit} className="mx-auto mt-2 flex max-w-[460px] items-center gap-2">
        <label htmlFor="pick-say" className="sr-only">
          Ask Pick
        </label>
        <input
          ref={field}
          id="pick-say"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            if (now.hidden) setNow((c) => ({ ...c, hidden: false }));
            if (!thinking) setMood("listening");
          }}
          onBlur={() => !thinking && setMood((m) => (m === "listening" ? "curious" : m))}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="send"
          inputMode={askBudget ? "numeric" : "text"}
          placeholder={askBudget ? "Your budget, like 3000" : "Ask Pick… birthday, brother, under 3000"}
          className="h-11 min-w-0 flex-1 rounded-full border border-ink/20 bg-paper px-4 text-base outline-none transition-[border-color,box-shadow] placeholder:text-steel focus:border-ink focus:shadow-[0_0_0_3px_rgba(10,10,10,0.08)] md:text-[14px]"
        />
        <button type="submit" disabled={thinking || !text.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-ink text-paper transition-[opacity,scale] active:scale-95 disabled:cursor-default disabled:opacity-30">
          <ArrowUp aria-hidden className="h-5 w-5" />
        </button>
      </form>

      <SendSheet
        piece={sending}
        initial={sending && now.state.sizing === "known" && now.state.size && sending.sizes.includes(now.state.size) ? { size: now.state.size } : undefined}
        onClose={() => setSending(null)}
      />
    </section>
  );
}

/** A suggested piece, small: photo, name, price, why; and Send this. */
function MiniCard({ card, onSend }: { card: PickCard; onSend: () => void }) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl bg-mist/60 p-1.5 pr-2">
      <span className="relative block h-12 w-11 shrink-0 overflow-hidden rounded-lg bg-[#efefef]">
        <span className="absolute inset-x-0 -top-[6%] block">
          <ProductImage image={card.image ?? { src: null, alt: card.name, kind: "front" }} category={card.category} colourHex={card.colourHex} decorative sizes="48px" />
        </span>
      </span>
      <Link href={`/product/${card.slug}?from=gift`} className="min-w-0 flex-1" title={card.why}>
        <span className="block truncate text-[13px] font-semibold leading-tight hover:underline">{card.name}</span>
        <span className="block truncate text-[11.5px] text-steel-dark">
          <span className="font-mono text-ink">{formatPrice(card.price)}</span> · {card.why}
        </span>
      </Link>
      <button type="button" onClick={onSend} className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full bg-volt px-3 text-[12px] font-semibold transition-[background-color,scale] hover:bg-[#b5f020] active:scale-[0.97]">
        Send this
      </button>
    </li>
  );
}

function moodFor(m: Mood): RobotMood {
  return m === "greeting" ? "greeting" : m === "happy" ? "happy" : m === "reassuring" ? "reassuring" : m === "speaking" ? "speaking" : "curious";
}
