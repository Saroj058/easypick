"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Minus, RotateCcw, Sparkles } from "lucide-react";
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

// Pick, the gift page's robot, as a real helper: a short chat that asks one thing at a time (who
// it's for, the occasion, their style, a budget, the size), or reads a typed sentence, then shows
// real pieces from the catalogue with why each one fits. "Send this" opens the same send-as-gift
// form as the strip below. Every answer comes from /api/pick (lib/pick/turn.ts).
// The conversation is kept for this tab only (sessionStorage), and only gift preferences are in it.

const Robot = dynamic(() => import("../ui/robot-hero").then((m) => m.RobotCharacter), { ssr: false, loading: () => null });

const KEY = "ep-pick-v1";

type Line = { from: "pick" | "you"; text: string; cards?: PickCard[] };
interface Saved {
  lines: Line[];
  state: PickState;
  quick: Quick[];
  open: boolean;
}

const START: Saved = {
  lines: [{ from: "pick", text: `${GREETING} ${question("recipient", {}, []).text}` }],
  state: {},
  quick: question("recipient", {}, []).quick,
  open: true,
};

function load(): Saved | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Saved;
    return Array.isArray(v.lines) && v.lines.length ? v : null;
  } catch {
    return null;
  }
}

export function PickChat() {
  const still = useReducedMotion();
  const [chat, setChat] = useState<Saved>(START);
  const [restored, setRestored] = useState(false);
  const [pending, setPending] = useState(false);
  const [mood, setMood] = useState<RobotMood>("greeting");
  const [text, setText] = useState("");
  const [askBudget, setAskBudget] = useState(false);
  const [typed, setTyped] = useState<number | null>(null); // characters shown of the newest line
  const [sending, setSending] = useState<PickCard | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // Pick up where they left off in this tab.
  useEffect(() => {
    const saved = load();
    if (saved) setChat(saved);
    setRestored(true);
    const t = setTimeout(() => setMood((m) => (m === "greeting" ? "curious" : m)), 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(chat));
    } catch {
      // Private mode: the chat just isn't kept.
    }
  }, [chat, restored]);

  // The newest line from Pick types itself out, quickly. Never with reduced motion.
  const newest = chat.lines[chat.lines.length - 1];
  useEffect(() => {
    if (!restored || still || newest?.from !== "pick" || !newest.text) return;
    let n = 0;
    const step = Math.max(2, Math.ceil(newest.text.length / 28));
    setTyped(0);
    const id = setInterval(() => {
      n += step;
      if (n >= newest.text.length) {
        clearInterval(id);
        setTyped(null);
      } else setTyped(n);
    }, 18);
    return () => clearInterval(id);
  }, [newest, still, restored]);

  // New lines scroll the chat, never the page.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: still ? "auto" : "smooth" });
  }, [chat.lines.length, pending, still]);

  const send = useCallback(
    async (body: { quick: Quick } | { text: string }, said: string) => {
      if (pending) return;
      setPending(true);
      setMood("thinking");
      setAskBudget(false);
      const before = chat;
      setChat((c) => ({ ...c, lines: [...c.lines, { from: "you", text: said }], quick: [] }));
      try {
        const res = await fetch("/api/pick", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state: before.state, ...body }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(res.status === 429 ? "busy" : "failed");
        const r = (await res.json()) as PickReply;
        setChat((c) => ({
          ...c,
          state: r.state,
          quick: r.quick,
          lines: [...c.lines, ...r.messages.filter((m) => m.text || m.cards?.length).map((m) => ({ from: "pick" as const, text: m.text, cards: m.cards }))],
        }));
        setAskBudget(r.input === "budget");
        setMood(moodFor(r.mood));
        if (r.input === "budget") requestAnimationFrame(() => field.current?.focus());
      } catch (e) {
        // Nothing is lost: their answers stay, and the same buttons come back.
        setChat((c) => ({
          ...c,
          quick: before.quick,
          lines: [
            ...c.lines,
            {
              from: "pick",
              text:
                e instanceof Error && e.message === "busy"
                  ? "That's a lot of messages at once. Give me a moment, then try again."
                  : "I lost my connection for a second. Your answers are safe, so just try that again. You can also browse every piece below.",
            },
          ],
        }));
        setMood("reassuring");
      } finally {
        setPending(false);
      }
    },
    [chat, pending],
  );

  const choose = (q: Quick) => {
    if (q.action === "own-budget") {
      setAskBudget(true);
      setChat((c) => ({ ...c, lines: [...c.lines, { from: "you", text: q.label }, { from: "pick", text: "Sure. Type it in rupees, like 3000." }], quick: [] }));
      setMood("listening");
      requestAnimationFrame(() => field.current?.focus());
      return;
    }
    if (q.action === "restart") {
      setChat({ ...START, lines: [{ from: "pick", text: `Fresh start. ${question("recipient", {}, []).text}` }] });
      setMood("greeting");
      setAskBudget(false);
      return;
    }
    void send({ quick: q }, q.label);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || pending) return;
    setText("");
    // A number on its own, when Pick asked for a budget, is the budget.
    const n = askBudget ? Number(t.replace(/[^0-9]/g, "")) : NaN;
    if (askBudget && n > 0) void send({ quick: { label: t, set: { budget: n } } }, `Under ${formatPrice(n)}`);
    else void send({ text: t }, t);
  };

  const pick = (c: PickCard) => {
    setSending(c);
    setChat((s) => ({ ...s, state: { ...s.state, picked: c.slug }, lines: [...s.lines, { from: "pick", text: `Great pick. ${c.name} it is. Now the note, the wrap and where it goes.` }] }));
    setMood("happy");
  };

  const setOpen = (open: boolean) => {
    setChat((c) => ({ ...c, open }));
    setMood(open ? "curious" : "inactive");
  };

  const shownText = (l: Line, i: number) => (i === chat.lines.length - 1 && typed !== null && l.from === "pick" ? l.text.slice(0, typed) : l.text);
  const ready = typed === null && !pending;

  return (
    <section aria-label="Pick, your gift helper">
      {/* Pick himself, free across the whole width of the screen: he strolls from side to side,
          follows the pointer over his band, and comes to the middle, over the chat, to talk. */}
      <div className="relative mx-[calc(50%-50vw)] h-[150px] md:h-[200px]">
        <Robot mood={chat.open ? mood : "inactive"} loved={mood === "happy"} className="absolute inset-0" />
      </div>

      <div className="mx-auto max-w-[780px]">
        <AnimatePresence initial={false} mode="wait">
          {chat.open ? (
            <motion.div
              key="open"
              initial={still ? false : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={still ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-2xl border border-ink bg-paper"
            >
              <header className="flex items-center gap-2 border-b border-ink/10 px-4 py-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-volt opacity-70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7fb800]" />
                </span>
                <h2 className="text-[14px] font-semibold">Pick</h2>
                <span className="text-[12px] text-steel-dark">your gift helper</span>
                <span className="ml-auto flex gap-1">
                  <button type="button" onClick={() => choose({ label: "Start again", action: "restart" })} className="grid h-9 w-9 cursor-pointer place-items-center rounded-full hover:bg-mist" aria-label="Start again">
                    <RotateCcw aria-hidden className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 cursor-pointer place-items-center rounded-full hover:bg-mist" aria-label="Minimise Pick">
                    <Minus aria-hidden className="h-4 w-4" />
                  </button>
                </span>
              </header>

              {/* The conversation: scrolls inside, so the page never jumps */}
              <div ref={log} role="log" aria-live="polite" aria-label="Chat with Pick" className="max-h-[min(440px,58vh)] space-y-2.5 overflow-y-auto overscroll-contain px-4 py-4">
                {chat.lines.map((l, i) =>
                  l.cards?.length ? (
                    <ul key={i} className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:thin]" aria-label="Pick's suggestions">
                      {l.cards.map((c) => (
                        <PickCardView key={c.slug} card={c} onSend={() => pick(c)} />
                      ))}
                    </ul>
                  ) : (
                    <motion.p
                      key={i}
                      initial={still || i < 1 ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                      className={
                        l.from === "pick"
                          ? "max-w-[92%] whitespace-pre-line rounded-2xl rounded-tl-md bg-mist/70 px-3.5 py-2.5 text-[15px] leading-snug"
                          : "ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-ink px-3.5 py-2.5 text-[15px] leading-snug text-paper"
                      }
                    >
                      {shownText(l, i)}
                    </motion.p>
                  ),
                )}
                {pending && (
                  <p className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-md bg-mist/70 px-3.5 py-3" role="status" aria-label="Pick is thinking">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 rounded-full bg-ink/50 motion-safe:animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />
                    ))}
                  </p>
                )}
              </div>

              {/* Quick answers: the whole journey works with these alone */}
              {ready && chat.quick.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pb-3" role="group" aria-label="Quick answers">
                  {chat.quick.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => choose(q)}
                      className="inline-flex h-9 cursor-pointer items-center rounded-full border border-ink/20 bg-paper px-3.5 text-[13px] font-semibold transition-[border-color,background-color,color,scale] duration-150 hover:border-ink hover:bg-ink hover:text-paper active:scale-[0.97]"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={submit} className="flex items-center gap-2 border-t border-ink/10 px-3 py-2.5">
                <label htmlFor="pick-say" className="sr-only">
                  Message Pick
                </label>
                <input
                  ref={field}
                  id="pick-say"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={() => !pending && setMood("listening")}
                  onBlur={() => !pending && setMood((m) => (m === "listening" ? "curious" : m))}
                  maxLength={400}
                  autoComplete="off"
                  enterKeyHint="send"
                  inputMode={askBudget ? "numeric" : "text"}
                  placeholder={askBudget ? "Your budget, like 3000" : "Or type: birthday, brother, under 3000"}
                  className="h-11 min-w-0 flex-1 rounded-full bg-mist/60 px-4 text-base outline-none transition-shadow placeholder:text-steel focus:shadow-[0_0_0_2px_var(--color-ink)] md:text-[14px]"
                />
                <button type="submit" disabled={pending || !text.trim()} aria-label="Send" className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-ink text-paper transition-[opacity,scale] active:scale-95 disabled:cursor-default disabled:opacity-30">
                  <ArrowUp aria-hidden className="h-5 w-5" />
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="closed" initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center">
              <button type="button" onClick={() => setOpen(true)} className="group inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-full border border-ink bg-paper pl-4 pr-5 text-[14px] font-semibold transition-colors hover:bg-ink hover:text-paper">
                <Sparkles aria-hidden className="h-4 w-4" />
                Ask Pick for a gift idea
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SendSheet
        piece={sending}
        initial={sending && chat.state.sizing === "known" && chat.state.size && sending.sizes.includes(chat.state.size) ? { size: chat.state.size } : undefined}
        onClose={() => setSending(null)}
      />
    </section>
  );
}

/** A suggested piece: the real photo, name, price, what's in stock, and why it fits. */
function PickCardView({ card, onSend }: { card: PickCard; onSend: () => void }) {
  const one = card.sizes.length === 1 && card.sizes[0] === "ONE";
  return (
    <li className="w-[200px] shrink-0 snap-start overflow-hidden rounded-2xl border border-ink/15 bg-paper md:w-[218px]">
      <div className="relative aspect-[5/4] overflow-hidden bg-[#efefef]">
        <span className="absolute inset-x-0 -top-[12%] block">
          <ProductImage image={card.image ?? { src: null, alt: card.name, kind: "front" }} category={card.category} colourHex={card.colourHex} decorative sizes="220px" />
        </span>
        {card.few && <span className="absolute left-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[11px] font-semibold">Few left</span>}
      </div>
      <div className="p-3">
        <p className="truncate font-semibold leading-tight">{card.name}</p>
        <p className="mt-0.5 font-mono text-[13px] tabular-nums">
          {formatPrice(card.price)}
          {card.was && <span className="ml-1.5 text-steel-dark line-through">{formatPrice(card.was)}</span>}
        </p>
        <p className="mt-1 truncate text-[12px] text-steel-dark">
          {one ? "One size" : card.sizes.join(" · ")}
          {card.colours.length > 1 ? ` · ${card.colours.length} colours` : ""}
        </p>
        <p className="mt-2 line-clamp-3 min-h-[3.4em] text-[12.5px] leading-snug">{card.why}</p>
        <div className="mt-3 flex gap-2">
          <Link href={`/product/${card.slug}?from=gift`} className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-ink/25 text-[12.5px] font-semibold transition-colors hover:border-ink">
            View
          </Link>
          <button type="button" onClick={onSend} className="inline-flex h-9 flex-[1.4] cursor-pointer items-center justify-center rounded-full bg-volt text-[12.5px] font-semibold transition-[background-color,scale] hover:bg-[#b5f020] active:scale-[0.97]">
            Send this
          </button>
        </div>
      </div>
    </li>
  );
}

function moodFor(m: Mood): RobotMood {
  return m === "greeting" ? "greeting" : m === "happy" ? "happy" : m === "reassuring" ? "reassuring" : m === "speaking" ? "speaking" : "curious";
}
