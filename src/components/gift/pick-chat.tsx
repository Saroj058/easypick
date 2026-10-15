"use client";

import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { RotateCcw, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { formatPrice } from "@/lib/format";
import { GREETING, question, type PickState, type Quick } from "@/lib/pick/journey";
import type { PickCard } from "@/lib/pick/recommend";
import type { Mood, PickReply } from "@/lib/pick/turn";
import { ProductImage } from "../product-image";
import type { RobotMood } from "../ui/robot-hero";
import { ThinkingOrb } from "../ui/ai-thinking-orb";
import { OrbInput } from "../ui/animated-input";
import { SendSheet } from "./gift-pieces";

// Pick, the gift page's robot. At first just Pick, roaming, and an "Ask Pick" line. Ask him something
// and the box shrinks into a ball that flies up beside him and thinks (the dotted orb); then he
// answers in a panel on his left and the box comes back: his reply, a few quick
// answers and, when he has them, up to three real pieces. Only the latest exchange shows.
// All of the thinking is on the server (/api/pick, lib/pick/turn.ts); this only draws it.
// What he knows (gift preferences only) is kept for this tab in sessionStorage.

const Robot = dynamic(() => import("../ui/robot-hero").then((m) => m.RobotCharacter), { ssr: false, loading: () => null });

/** Where Pick is: the gift page, or the shop (for themselves first, gifts too). */
type Where = "gift" | "shop";
const keyFor = (w: Where) => (w === "shop" ? "ep-pick-shop-v1" : "ep-pick-v3");

/** The first question. On the shop it starts with "for me". */
function opening(where: Where): { text: string; quick: Quick[] } {
  const q = question("recipient", {}, []);
  if (where === "gift") return { text: `${GREETING} ${q.text}`, quick: q.quick };
  return {
    text: "Hey, I'm Pick! 👋 Looking for something for yourself, or for someone?",
    quick: [{ label: "For me", set: { recipient: "self" } }, ...q.quick.filter((x) => x.set?.recipient !== "self")],
  };
}

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

const first = (where: Where): Saved => ({
  state: {},
  bubble: opening(where),
  // Nothing over him at first: just Pick and the "Ask Pick" line.
  hidden: true,
});

export function PickChat({ where = "gift" }: { where?: Where } = {}) {
  const KEY = keyFor(where);
  const FIRST = first(where);
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

  // Asking: the box shrinks to a ball, the ball flies up to where he answers and becomes the
  // thinking orb; with the answer, the box comes back (owner, 15 Oct 2026).
  const [phase, setPhase] = useState<"idle" | "launch" | "think">("idle");
  const section = useRef<HTMLElement>(null);
  const pillBox = useRef<HTMLDivElement>(null);
  const orbSpot = useRef<HTMLDivElement>(null);
  const ball = useRef<HTMLDivElement>(null);
  /** Plays the flight; resolves when the orb starts thinking, with that moment. */
  // The flight plays once, for the first question; after that only the orb thinks (owner, 15 Oct 2026).
  const flew = useRef(false);
  const [gliding, setGliding] = useState(false);
  const launch = useCallback(async () => {
    if (flew.current) {
      setPhase("think");
      return performance.now();
    }
    flew.current = true;
    setGliding(true);
    setPhase("launch");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sec = section.current;
    const pill = pillBox.current;
    const b = ball.current;
    const spotEl = orbSpot.current;
    if (!still && sec && pill && b && spotEl && pill.offsetWidth) {
      const S = sec.getBoundingClientRect();
      const P = pill.getBoundingClientRect();
      const O = spotEl.getBoundingClientRect();
      const D = 48;
      const cx = P.left - S.left + P.width / 2 - D / 2;
      const cy = P.top - S.top + P.height / 2 - D / 2;
      const tx = O.left - S.left + O.width / 2 - D / 2;
      const ty = O.top - S.top + O.height / 2 - D / 2;
      const core = b.firstElementChild as HTMLElement;
      // The box, then a ball.
      await animate(b, { x: P.left - S.left, y: P.top - S.top, width: P.width, height: P.height, opacity: 1, scale: 1 }, { duration: 0 });
      animate(core, { opacity: [0, 1] }, { duration: 0.35, delay: 0.15 });
      await animate(b, { x: cx, y: cy, width: D, height: D }, { duration: 0.45, ease: [0.65, 0, 0.35, 1] });
      // Up, along a curve, growing to the orb's size.
      await animate(
        b,
        { x: [cx, cx + (tx - cx) * 0.15, tx], y: [cy, cy + (ty - cy) * 0.7, ty], scale: [1, 1.5, 2] },
        { duration: 0.7, ease: [0.5, 0, 0.1, 1] },
      );
      animate(b, { opacity: 0, scale: 2.3 }, { duration: 0.35 });
    }
    setPhase("think");
    return performance.now();
  }, [still]);

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
  }, [KEY]);
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(now));
    } catch {
      // Private mode: not kept.
    }
  }, [now, ready, KEY]);

  // His answer types itself out, quickly (not with reduced motion).
  const line = now.bubble.text;
  useEffect(() => {
    if (!ready || still || !line) return;
    // By the clock, not by ticks: the answer is out in about half a second even on a slow phone.
    const start = performance.now();
    const total = Math.min(700, 250 + line.length * 4);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts typing out a new answer
    setTyped(0);
    const id = setInterval(() => {
      const n = Math.floor(((performance.now() - start) / total) * line.length);
      if (n >= line.length) {
        clearInterval(id);
        setTyped(null);
      } else setTyped(n);
    }, 30);
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
      // The thinking orb always shows for at least 3 seconds before the answer (owner, 15 Oct 2026).
      const flight = launch();
      const atLeast3s = async () => {
        const landed = await flight;
        await new Promise((r) => setTimeout(r, Math.max(0, 3000 - (performance.now() - landed))));
      };
      try {
        const res = await fetch("/api/pick", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state: before.state, ...body }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(res.status === 429 ? "busy" : "failed");
        await atLeast3s();
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
        await atLeast3s();
        // Nothing is lost: what he knew stays, and the same answers come back.
        setNow({
          ...before,
          hidden: false,
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
        setPhase("idle");
        setGliding(false);
      }
    },
    [now, thinking, launch],
  );

  const choose = (q: Quick) => {
    if (q.action === "restart") {
      setNow({ state: {}, bubble: { text: `Fresh start. ${opening(where).text.replace(/^Hey, I'm Pick! 👋 /, "")}`, quick: opening(where).quick }, hidden: false });
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

  const submit = () => {
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

  // Where Pick stands while he answers: just right of his panel. Measured, so it holds on any screen.
  const spot = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const b = band.current?.getBoundingClientRect();
      const p = panel.current?.getBoundingClientRect();
      spot.current = open && b && p && b.width ? Math.min(0.94, (p.right - b.left + (b.width < 640 ? 50 : 72)) / b.width) : null;
    };
    measure();
    if (!open || !panel.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(panel.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [open, thinking]);

  const close = () => {
    setNow((c) => ({ ...c, hidden: true }));
    setMood("idle");
    setAsking(false);
  };
  // The "Ask Pick" box shows once they tap his line (or while an answer is open).
  const [asking, setAsking] = useState(false);
  const showBox = asking || open;
  const startAsking = () => {
    setAsking(true);
    setMood("listening");
    requestAnimationFrame(() => field.current?.focus());
  };

  return (
    <section aria-label={where === "shop" ? "Pick, your shopping helper" : "Pick, your gift helper"} ref={section} className="relative !mb-8 -mt-6 md:!mb-10 md:-mt-10">
      {/* Pick walks the whole width of the screen. Asked something, he walks over and answers in a
          panel on his left, turning to it; closed, he goes back to roaming. */}
      <div ref={band} className={`relative mx-[calc(50%-50vw)] flex items-end [--pick-side:1] [--pick-x:0.5] min-h-[150px] md:min-h-[190px]`}>
        <div className="absolute inset-x-0 bottom-0 h-[150px] md:h-[190px]">
          <Robot mood={open ? mood : asking ? "listening" : "idle"} loved={mood === "happy"} spotRef={spot} followRef={band} className="absolute inset-0" />
        </div>
        {/* Pick himself is a button: tap him and the Ask box shows. It walks with him. */}
        <button
          type="button"
          onClick={startAsking}
          aria-label="Chat with Pick"
          className="absolute bottom-0 z-10 h-[120px] w-[84px] -translate-x-1/2 cursor-pointer rounded-full md:h-[160px] md:w-[110px]"
          style={{ left: "calc(var(--pick-x) * 100%)" }}
        />
        {/* Before anything is asked: his line, beside him (on the side with room) as he walks. Tap it to ask. */}
        {!open && (
          <button
            type="button"
            onClick={startAsking}
            className="absolute bottom-[52px] z-10 w-max max-w-[min(280px,calc(50vw-64px))] cursor-pointer rounded-2xl bg-paper px-4 py-2.5 text-left text-[13px] font-semibold leading-snug shadow-[0_10px_28px_-14px_rgba(10,10,10,0.5),0_0_0_1px_rgba(10,10,10,0.1)] transition-[scale] hover:scale-[1.03] active:scale-[0.98] md:bottom-[100px] md:text-[14px]"
            style={{ left: "calc(var(--pick-x) * 100% + var(--pick-side) * 58px)", transform: "translateX(calc((var(--pick-side) - 1) * 50%))" }}
          >
            <Typed lines={["Hi, I'm Pick. Ask me anything about clothes.", "Tap me to chat."]} still={!!still} />

          </button>
        )}

        <div className="relative z-10 mx-auto w-full max-w-[820px] px-3 pb-4 md:px-4 md:pb-6">
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panel}
                key="panel"
                initial={still ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={still ? { opacity: 0 } : { opacity: 0, x: -10, scale: 0.98 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-[calc(100%-96px)] max-w-[540px] origin-right md:w-[calc(100%-220px)]"
              >
                {thinking ? (
                  // Where the ball lands and thinks: the dotted orb (ui/ai-thinking-orb.tsx), beside Pick.
                  <motion.div
                    initial={still || gliding ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="flex min-h-[112px] items-center justify-end pr-2"
                    aria-live="polite"
                  >
                    {phase === "think" ? <ThinkingOrb size={96} /> : <div ref={orbSpot} aria-hidden className="h-24 w-24" />}
                  </motion.div>
                ) : (
                <motion.div
                  initial={still ? false : { opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="relative overflow-hidden rounded-[26px] bg-paper shadow-[0_24px_60px_-28px_rgba(10,10,10,0.45),0_0_0_1px_rgba(10,10,10,0.08)]"
                >
                  <header className="flex items-center gap-2 px-4 pt-3.5 md:px-5">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-volt">
                      <Sparkles aria-hidden className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[13px] font-semibold">Pick</span>
                    <span className="text-[12px] text-steel-dark">{where === "shop" ? "your shopping helper" : "your gift helper"}</span>
                    <span className="ml-auto -mr-2 flex">
                      <button type="button" onClick={() => choose({ label: "Start again", action: "restart" })} aria-label="Start again" className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-steel-dark hover:bg-mist hover:text-ink">
                        <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={close} aria-label="Close Pick's answer" className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-steel-dark hover:bg-mist hover:text-ink">
                        <X aria-hidden className="h-4 w-4" />
                      </button>
                    </span>
                  </header>

                  <div className="px-4 pb-4 pt-2 md:px-5 md:pb-5">
                    {now.said && (
                      <p className="mb-2 truncate text-[12.5px] text-steel-dark" aria-label="You said">
                        <span className="mr-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em]">You</span>
                        {now.said}
                      </p>
                    )}
                    <div aria-live="polite">
                      <p className="whitespace-pre-line text-[15.5px] leading-snug tracking-[-0.005em] md:text-[17px]">{shown}</p>
                    </div>

                    {settled && now.bubble.cards && now.bubble.cards.length > 0 && (
                      <ul className="mt-3 divide-y divide-ink/[0.07] overflow-hidden rounded-2xl ring-1 ring-ink/[0.08]" aria-label="Pick's suggestions">
                        {now.bubble.cards.map((c, i) => (
                          <MiniCard key={c.slug} card={c} index={i} onSend={() => pick(c)} where={where} />
                        ))}
                      </ul>
                    )}

                    {settled && now.bubble.quick.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Quick answers">
                        {now.bubble.quick.map((q) => (
                          <button
                            key={q.label}
                            type="button"
                            onClick={() => choose(q)}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full bg-mist/70 px-3 text-[12.5px] font-semibold transition-[background-color,color,scale] duration-150 hover:bg-ink hover:text-paper active:scale-[0.97]"
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* The point of the panel, toward Pick on its right */}
                  <span aria-hidden className="absolute -right-[7px] bottom-8 h-3.5 w-3.5 rotate-45 rounded-[3px] bg-paper shadow-[1px_-1px_0_0_rgba(10,10,10,0.08)]" />
                </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* The ball the box shrinks into, on its way up (see launch) */}
      <div ref={ball} aria-hidden className="pointer-events-none absolute left-0 top-0 z-20 rounded-full border border-ink/15 bg-paper opacity-0 shadow-[0_12px_30px_-20px_rgba(10,10,10,0.45)]">
        <span className="absolute inset-1 overflow-hidden rounded-full opacity-0">
          <span className="orb-spin absolute -inset-2 rounded-full bg-[conic-gradient(from_0deg,#c6ff3d,#f4ffd6,#5f8f00,#ffffff,#c6ff3d)] blur-[6px]" />
          <span className="absolute inset-0 rounded-full shadow-[inset_0_-6px_12px_rgba(0,0,0,0.35)]" />
        </span>
      </div>

      {/* Ask Pick: shown once they tap his line; hidden while the ball is away */}
      {showBox && (
      <motion.div
        ref={pillBox}
        initial={false}
        animate={gliding ? { opacity: 0, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={gliding ? { duration: 0.08 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={`mx-auto mt-3 max-w-[460px] ${gliding ? "pointer-events-none" : ""}`}
      >
      <OrbInput
        id="pick-say"
        label="Ask Pick"
        inputRef={field}
        value={text}
        onValueChange={setText}
        onSubmit={submit}
        busy={thinking}
        onFocus={() => !thinking && setMood("listening")}
        onBlur={() => !thinking && setMood((m) => (m === "listening" ? (open ? "curious" : "idle") : m))}
        maxLength={200}
        inputMode={askBudget ? "numeric" : "text"}
        staticPlaceholder={askBudget ? "Your budget, like 3000" : undefined}
        placeholders={where === "shop" ? ["something for me under 2000", "an oversized hoodie in M", "what goes with black cargos?", "hi Pick, how are you?"] : ["gift for my brother, under 3000", "birthday gift for my girlfriend", "something minimal for a friend", "hi Pick, how are you?"]}
      />
      </motion.div>
      )}

      <SendSheet
        piece={sending}
        initial={sending && now.state.sizing === "known" && now.state.size && sending.sizes.includes(now.state.size) ? { size: now.state.size } : undefined}
        onClose={() => setSending(null)}
      />
    </section>
  );
}

/** A suggested piece: photo, name, price and why; Send this. */
function MiniCard({ card, index, onSend, where }: { card: PickCard; index: number; onSend: () => void; where: Where }) {
  const still = useReducedMotion();
  return (
    <motion.li
      initial={still ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: still ? 0 : index * 0.06 }}
      className="flex items-center gap-2.5 bg-paper p-2 md:gap-3 md:pr-2.5"
    >
      <span className="relative block h-14 w-11 shrink-0 overflow-hidden rounded-xl bg-[#efefef] md:w-12">
        <span className="absolute inset-x-0 -top-[6%] block">
          <ProductImage image={card.image ?? { src: null, alt: card.name, kind: "front" }} category={card.category} colourHex={card.colourHex} decorative sizes="48px" />
        </span>
      </span>
      <Link href={where === "shop" ? `/product/${card.slug}` : `/product/${card.slug}?from=gift`} className="group min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold leading-tight group-hover:underline">{card.name}</span>
        <span className="mt-0.5 block font-mono text-[12px] tabular-nums">
          {formatPrice(card.price)}
          {card.was && <span className="ml-1.5 text-steel-dark line-through">{formatPrice(card.was)}</span>}
        </span>
        <span className="block truncate text-[11.5px] text-steel-dark">{card.why}</span>
      </Link>
      {where === "shop" && card.slug ? (
        <Link href={`/product/${card.slug}`} className="inline-flex h-9 shrink-0 items-center rounded-full bg-ink px-3.5 text-[12.5px] font-semibold text-paper">
          View
        </Link>
      ) : (
        <button type="button" onClick={onSend} aria-label="Send this" className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-volt px-3 text-[12.5px] font-semibold transition-[background-color,scale] hover:bg-[#b5f020] active:scale-[0.97] md:px-3.5">
          Send<span className="max-md:hidden">&nbsp;this</span>
        </button>
      )}
    </motion.li>
  );
}

function moodFor(m: Mood): RobotMood {
  return m === "greeting" ? "greeting" : m === "happy" ? "happy" : m === "reassuring" ? "reassuring" : m === "speaking" ? "speaking" : "curious";
}

/** His greeting, typed out like a typewriter, one line after the other. */
function Typed({ lines, still }: { lines: string[]; still: boolean }) {
  const full = lines.join("\n");
  const [n, setN] = useState(0);
  useEffect(() => {
    if (still) return;
    const start = performance.now();
    const id = setInterval(() => {
      // 45 ms a letter, with a short pause at the line break.
      const t = performance.now() - start;
      const k = Math.floor(t / 45);
      const brk = full.indexOf("\n");
      const m = k <= brk ? k : Math.max(brk, Math.floor((t - 450) / 45));
      setN(Math.min(full.length, m));
      if (m >= full.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [full, still]);
  const shown = still ? full : full.slice(0, n);
  const done = still || n >= full.length;
  const [a, b] = shown.split("\n");
  return (
    <>
      {/* The whole line for screen readers; the typing is only for the eye */}
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden className="grid">
        {/* Holds the final size so the bubble doesn't grow as it types */}
        <span className="invisible col-start-1 row-start-1">
          {lines[0]}
          <span className="mt-0.5 block font-normal text-steel-dark">{lines[1]}</span>
        </span>
        <span className="col-start-1 row-start-1">
          {a}
          {b !== undefined && <span className="mt-0.5 block font-normal text-steel-dark">{b}{!done && <Caret />}</span>}
          {b === undefined && !done && <Caret />}
        </span>
      </span>
    </>
  );
}
function Caret() {
  return <span className="ml-px inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-ink" />;
}
