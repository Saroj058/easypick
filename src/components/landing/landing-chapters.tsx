"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
import {
  ArrowDown,
  Bell,
  Bookmark,
  CalendarDays,
  CircleCheck,
  Gem,
  Gift,
  Mail,
  Maximize2,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  Ruler,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { formatPrice } from "@/lib/format";

import "./hero-cards.css";

/** The films play a little faster than life (owner, 27 Oct 2026: "run the full videos ... make it fast"). */
const RATE = 1.25;
/** When each part of a card happens after it lands (s): the three promises, the Watch button, the film. */
const AT = { s1: 1.6, s2: 2.5, s3: 3.4, watch: 3.8, film: 4.9 };
/** How long a card waits when its film can't play by itself (s). */
const READ = 8;

/** A recording of the real site in use (public/story/video, made with scripts/record-story.mjs). */
export interface Film {
  src: string;
  poster: string;
  /** Its length at life speed (s). */
  length: number;
  /** Each step's caption, as burnt into the film, and when it shows (s). */
  steps: [string, number][];
}

export const ICONS = { tag: Tag, ruler: Ruler, swap: RefreshCw, shirt: Shirt, bag: ShoppingBag, wallet: Wallet, chat: MessageCircle, spark: Sparkles, gift: Gift, mail: Mail, calendar: CalendarDays, zap: Zap, check: CircleCheck, mark: Bookmark, gem: Gem, star: Star, bell: Bell } satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof ICONS;
/** Which small machine a card shows. */
export type Kind = "tag" | "shop" | "pick" | "gift" | "fits" | "size" | "vault" | "drop";
type Promise3 = [[IconName, string, string], [IconName, string, string], [IconName, string, string]];

export interface ChapterData {
  /** Its word in the row of topics. */
  topic: string;
  label: string;
  /** The two title lines; the word in *stars* is set in italic. */
  title: [string, string];
  /** The card in one sentence (for search engines and screen readers). */
  line: string;
  href: string;
  cta: string;
  /** The usual way of shopping, crossed out. */
  bubble: string;
  /** Three promises: an icon, a word or two, and a small line. */
  beats: Promise3;
  kind: Kind;
  film: Film;
  /** When in the film each promise lights again (s); without it all three stay lit. */
  thr?: [number, number, number];
  /** Play only the start of the film (s). */
  upto?: number;
}

/** A real piece for the cards' machines. */
export interface Piece {
  name: string;
  price: number;
  img: string;
  chest?: number;
  length?: number;
}
export interface Showcase {
  /** The piece on the tag and the shop card. */
  hero: Piece;
  /** Pick's three. */
  picks: Piece[];
  drop: Piece;
  /** A whole fit: a top, a bottom, an outer layer. */
  fit: Piece[];
  /** A Vault piece. */
  vault: Piece;
}

const wrap = (n: number, i: number) => ((i % n) + n) % n;
const noop = () => () => {};
const subVis = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
const useTabHidden = () => useSyncExternalStore(subVis, () => document.hidden, () => false);
/** Data Saver on: the films wait for a tap. */
const useSaveData = () => useSyncExternalStore(noop, () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true, () => false);
const clock = (s: number) => {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
};
const stepAt = (film: Film, t: number) => film.steps.reduce((i, [, s], k) => (t >= s - 0.25 ? k : i), -1);

/** "No *guessing.*" → No <em>guessing.</em> */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/).map((p, i) => (p.startsWith("*") ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>))}
    </>
  );
}

type Shown = { i: number; key: number; d: number };
type Watching = { film: Film; title: string; from: number };

/**
 * The home's cards, after the EASYPICK opening (owner, 27 Oct 2026: picked the "explainer" mockup, "make the
 * video play, but gradually"; "build it but even better"). Each card runs Picture → Explain → Film: the photo
 * and the title slide in; the usual way of shopping appears in a bubble and is crossed out while the card's
 * own small machine moves (a hang tag, a size picked, Pick answering, a gift box opening ...) and its three
 * promises light up one by one; then the Watch button grows into the film of the real site, which plays with
 * the step it's on and lights the promises again as it goes. When it ends, the next card slides in. The topics
 * at the foot jump to a card. It holds for Pause, a hidden tab, a film open full screen, and while scrolled
 * away. With less motion or Data Saver the films wait for a tap.
 */
export function LandingChapters({ chapters, showcase }: { chapters: ChapterData[]; showcase: Showcase }) {
  const still = !!useReducedMotion();
  const saveData = useSaveData();
  const tabHidden = useTabHidden();
  const [shown, setShown] = useState<Shown>({ i: 0, key: 0, d: 1 });
  const [leaving, setLeaving] = useState<Shown | null>(null);
  const [stopped, setStopped] = useState(false);
  const [inView, setInView] = useState(true);
  const [watching, setWatching] = useState<Watching | null>(null);
  // The browser wouldn't play a film by itself (a phone saving battery): from then on they wait for a tap.
  const [blocked, setBlocked] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const n = chapters.length;
  const hold = stopped || tabHidden || !inView || !!watching;
  const auto = !still && !saveData && !blocked;

  const go = useCallback(
    (to: number, d: number) => {
      const i = wrap(n, to);
      if (i === shown.i) return;
      setLeaving({ ...shown, d });
      setShown({ i, key: shown.key + 1, d });
      progress.set(0);
    },
    [n, shown, progress],
  );
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), 1100);
    return () => clearTimeout(t);
  }, [leaving]);
  // Scrolled away (down to the rail), it holds; back up, it goes on where it was.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Past the hero, to the rail.
  const shop = () => {
    const el = root.current?.closest("section");
    if (el) window.scrollTo({ top: el.getBoundingClientRect().bottom + window.scrollY - (window.innerWidth >= 768 ? 88 : 72), behavior: still ? "auto" : "smooth" });
  };
  const ch = chapters[shown.i];

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label="How Easypick works"
      className="hc"
      // The card's piece leans a little toward the mouse (computers).
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || still) return;
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        e.currentTarget.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("[role=dialog]")) return;
        if (e.key === "ArrowRight") go(shown.i + 1, 1);
        else if (e.key === "ArrowLeft") go(shown.i - 1, -1);
      }}
    >
      {leaving && <Card key={leaving.key} ch={chapters[leaving.i]} index={leaving.i} phase="leave" d={leaving.d} hold auto={false} still={still} showcase={showcase} progress={progress} onEnd={noop} onBlocked={noop} onWatch={noop} />}
      <Card
        key={shown.key}
        ch={ch}
        index={shown.i}
        phase="live"
        d={shown.d}
        hold={hold}
        auto={auto}
        still={still}
        showcase={showcase}
        progress={progress}
        onEnd={() => go(shown.i + 1, 1)}
        onBlocked={() => setBlocked(true)}
        onWatch={(film, from) => setWatching({ film, title: ch.label, from })}
      />

      <div className="hc-foot">
        <button type="button" className="hc-pz" onClick={() => setStopped((v) => !v)} aria-pressed={stopped} aria-label={stopped ? "Play" : "Pause"}>
          {stopped ? <Play aria-hidden className="h-3.5 w-3.5 fill-current" /> : <Pause aria-hidden className="h-3.5 w-3.5 fill-current" />}
        </button>
        <div className="hc-topics" role="group" aria-label="Topics">
          {chapters.map((c, i) => (
            <button key={c.topic} type="button" onClick={() => go(i, i > shown.i ? 1 : -1)} aria-current={i === shown.i ? "step" : undefined}>
              {c.topic}
              {i === shown.i && <motion.span aria-hidden className="hc-under" style={{ scaleX: progress }} />}
            </button>
          ))}
        </div>
        <button type="button" className="hc-shop" onClick={shop}>
          Shop now <ArrowDown aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>

      <FilmDialog watching={watching} onClose={() => setWatching(null)} />
      <p className="sr-only" aria-live="polite">{hold ? `${ch.label}, ${shown.i + 1} of ${n}` : ""}</p>
    </div>
  );
}

function Card({
  ch,
  index,
  phase,
  d,
  hold,
  auto,
  still,
  showcase,
  progress,
  onEnd,
  onBlocked,
  onWatch,
}: {
  ch: ChapterData;
  index: number;
  phase: "live" | "leave";
  d: number;
  hold: boolean;
  /** Its film grows in and plays by itself. */
  auto: boolean;
  still: boolean;
  showcase: Showcase;
  progress: MotionValue<number>;
  onEnd: () => void;
  onBlocked: () => void;
  onWatch: (film: Film, from: number) => void;
}) {
  const live = phase === "live";
  const [landed, setLanded] = useState(false);
  // Where the card is: 0 arriving, 1–3 the promises, 4 the Watch button, 5 the film.
  const [stage, setStage] = useState(still ? 4 : 0);
  const [lit, setLit] = useState(still ? 3 : 0);
  const [step, setStep] = useState(-1);
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLElement>(null);
  const elapsed = useRef(0);
  const ending = useRef(false);
  const film = ch.film;
  const upto = ch.upto ?? film.length;
  // The whole card, for the topic's underline: the explaining, then the film at its speed.
  const total = AT.film + upto / RATE;
  const latest = useRef({ hold, onEnd, onBlocked });
  useEffect(() => {
    latest.current = { hold, onEnd, onBlocked };
  });

  useEffect(() => {
    if (!live) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setLanded(true)));
    return () => cancelAnimationFrame(r);
  }, [live]);

  // The explaining runs on its own clock, held with the hero.
  useEffect(() => {
    if (!live || hold || stage >= 5 || (stage === 4 && !auto && elapsed.current >= AT.watch + READ)) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      elapsed.current += (now - last) / 1000;
      last = now;
      const e = elapsed.current;
      progress.set(Math.min(1, e / (auto ? total : AT.watch + READ)));
      const s = e >= AT.film && auto ? 5 : e >= AT.watch ? 4 : e >= AT.s3 ? 3 : e >= AT.s2 ? 2 : e >= AT.s1 ? 1 : 0;
      setStage((v) => Math.max(v, s));
      setLit((v) => Math.max(v, Math.min(3, s)));
      if (s >= 5) return;
      // A card whose film waits for a tap moves on after a while.
      if (!auto && e >= AT.watch + READ) return latest.current.onEnd();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, hold, stage, auto, total, progress]);

  // The film: plays while the card is here and nothing holds it.
  const filmOn = stage >= 5;
  useEffect(() => {
    const v = video.current;
    if (!v || !live || !filmOn) return;
    if (hold) {
      v.pause();
      return;
    }
    const t = window.setTimeout(() => void v.play().catch((e: unknown) => e instanceof DOMException && e.name === "NotAllowedError" && latest.current.onBlocked()), 600);
    return () => window.clearTimeout(t);
  }, [live, filmOn, hold]);
  // Its step, the promises lit again as it goes, the underline; at its end it shrinks back and the next card comes.
  useEffect(() => {
    const v = video.current;
    if (!v || !live || !filmOn) return;
    let raf = 0;
    const tick = () => {
      const t = v.currentTime;
      setStep(stepAt(film, t));
      if (ch.thr) setLit(ch.thr.filter((x) => t >= x).length);
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, t / upto)})`;
      progress.set(Math.min(1, (AT.film + t / RATE) / total));
      if (t >= upto - 0.05 || v.ended) {
        if (!ending.current) {
          ending.current = true;
          v.pause();
          setStage(4);
          window.setTimeout(() => !latest.current.hold && latest.current.onEnd(), 1100);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, filmOn, film, upto, ch.thr, progress, total]);

  const fast = (v: HTMLVideoElement) => {
    v.defaultPlaybackRate = RATE;
    v.playbackRate = RATE;
  };
  const s = live ? stage : 4;
  const cls = ["hc-card", !live || landed ? "hc-on" : "hc-enter", live ? "" : "hc-leave", d < 0 ? "hc-back" : "", s >= 5 ? "hc-filmon" : ""].join(" ");
  const beat = (k: 0 | 1 | 2) => {
    const [icon, word, small] = ch.beats[k];
    const I = ICONS[icon];
    return (
      <div className={`hc-beat ${lit > k ? "hc-lit" : ""}`}>
        <div className="hc-c">
          <I aria-hidden className="hc-ic" strokeWidth={1.8} />
        </div>
        {word}
        <small>{small}</small>
      </div>
    );
  };

  return (
    <div className={cls} aria-hidden={!live} role="group" aria-roledescription="slide" aria-label={`${index + 1}: ${ch.label}`}>
      <div className="hc-words">
        <p className="hc-label">
          {String(index + 1).padStart(2, "0")} — {ch.label}
        </p>
        {/* The usual way of shopping, crossed out as the card explains (one quiet line, not a bubble) */}
        <p className={`hc-usual ${s >= 1 ? "hc-struck" : ""}`}>
          Usually: <s>{ch.bubble}</s>
        </p>
        <h2 className="hc-title">
          <span className="hc-ln">
            <span>
              <Words text={ch.title[0]} />
            </span>
          </span>
          <span className="hc-ln">
            <span>
              <Words text={ch.title[1]} />
            </span>
          </span>
        </h2>
        <p className="sr-only">{ch.line}</p>
        <div className="hc-beats">
          {beat(0)}
          <div className={`hc-link ${lit > 1 ? "hc-lit" : ""}`} />
          {beat(1)}
          <div className={`hc-link ${lit > 2 ? "hc-lit" : ""}`} />
          {beat(2)}
        </div>
        <Link href={ch.href} className="hc-cta" tabIndex={live ? undefined : -1}>
          <span>{ch.cta}</span> →
        </Link>
      </div>

      <div aria-hidden className="hc-objwrap">
        <div className={`hc-obj ${s >= 1 ? "hc-s1" : ""} ${s >= 2 ? "hc-s2" : ""} ${s >= 3 ? "hc-s3" : ""}`}>
          <div className="hc-tilt">
            <Machine kind={ch.kind} s={s} showcase={showcase} />
          </div>
        </div>
      </div>

      <button
        type="button"
        tabIndex={live ? undefined : -1}
        className={`hc-watch ${s >= 4 ? "hc-shown" : ""} ${s >= 5 ? "hc-film" : ""}`}
        aria-label={s >= 5 ? "Watch full screen" : `Watch how it works, ${clock(upto / RATE)}`}
        onClick={() => {
          if (s >= 5) onWatch(film, video.current?.currentTime ?? 0);
          else setStage(5);
        }}
      >
        <span className="hc-pill">
          <span className="hc-th">
            <Image src={film.poster} alt="" fill sizes="90px" className="object-cover" />
          </span>
          <span>
            Watch how it works
            <small>{clock(upto / RATE)} · the real site</small>
          </span>
        </span>
        {live && <video ref={video} src={film.src} poster={film.poster} muted playsInline preload="auto" onLoadedMetadata={(e) => fast(e.currentTarget)} onPlay={(e) => fast(e.currentTarget)} aria-hidden />}
        <span className={`hc-step ${step >= 0 ? "hc-show" : ""}`} aria-hidden>
          {step >= 0 && (
            <>
              <b>
                {String(step + 1).padStart(2, "0")}/{String(film.steps.length).padStart(2, "0")}
              </b>
              {film.steps[step][0]}
            </>
          )}
        </span>
        <span className="hc-full" aria-hidden>
          <Maximize2 className="hc-ic" />
        </span>
        <span className="hc-bar" aria-hidden>
          <i ref={bar} style={{ transform: "scaleX(0)" }} />
        </span>
      </button>
    </div>
  );
}

type Img = (src: string, cls?: string, sizes?: string) => ReactNode;
const img: Img = (src, cls = "", sizes = "280px") => (
  <span className={`hc-img ${cls}`}>
    <Image src={src} alt="" fill sizes={sizes} className="object-cover" />
  </span>
);

/** Each card's small machine: what it does, in three moves (s1–s3), on real pieces. */
function Machine({ kind, s, showcase }: { kind: Kind; s: number; showcase: Showcase }) {
  const { hero, picks, drop, fit, vault } = showcase;
  const done = s >= 3 ? "hc-done" : "";
  if (kind === "tag")
    return (
      <div className="hc-tagobj">
        <div className="hc-string" />
        <div className="hc-tag">
          <div className="hc-mono">{hero.name}</div>
          <div className="hc-price">{formatPrice(hero.price)}</div>
          <span className="hc-stamp">FIXED · ONLINE = IN STORE</span>
          <div className="hc-rows">
            {hero.chest != null && (
              <div className="hc-r1">
                <span>Chest, M</span>
                <b>{hero.chest} cm</b>
              </div>
            )}
            {hero.length != null && (
              <div className="hc-r2">
                <span>Length, M</span>
                <b>{hero.length} cm</b>
              </div>
            )}
            <div className="hc-r3">
              <span>Size swap</span>
              <b>7 days</b>
            </div>
          </div>
        </div>
      </div>
    );
  if (kind === "shop")
    return (
      <div className={`hc-sheet ${done}`}>
        {img(hero.img, "hc-shot")}
        <div className="hc-pad">
          <div className="hc-mono">New in</div>
          <div className="hc-name">
            <span>{hero.name}</span>
            <span>{formatPrice(hero.price)}</span>
          </div>
          <div className="hc-chips">
            {["S", "M", "L", "XL"].map((z) => (
              <span key={z} className={`hc-chip ${z === "M" && s >= 1 ? "hc-lit" : ""}`}>
                {z}
              </span>
            ))}
          </div>
          <div className="hc-btn">
            <span>Buy now</span>
            <span>
              <CircleCheck className="hc-ic" /> Paid with eSewa
            </span>
          </div>
        </div>
      </div>
    );
  if (kind === "pick") return <PickChat s={s} picks={picks} />;
  if (kind === "gift") {
    const g = picks[1] ?? hero;
    return (
      <div className="hc-sheet">
        {img(g.img, "hc-shot")}
        <div className="hc-giftcard">
          <div className="hc-mono">A gift for Sita</div>
          <p>She picks the size</p>
          <div className="hc-chips">
            {["S", "M", "L"].map((z) => (
              <span key={z} className={`hc-chip ${z === "L" && s >= 3 ? "hc-lit" : ""}`}>
                {z}
              </span>
            ))}
          </div>
          <div className="hc-sent">
            <CircleCheck className="hc-ic" /> Sent · swap within 14 days
          </div>
        </div>
      </div>
    );
  }
  if (kind === "fits") {
    const total = fit.reduce((a, p) => a + p.price, 0);
    return (
      <div className={`hc-fan ${done}`}>
        {fit.slice(0, 3).map((p, k) => (
          <div key={k} className="hc-sheet">
            {img(p.img, "", "140px")}
            <div className="hc-cap">
              <span className="truncate">{p.name.split(" ").slice(-1)[0]}</span>
              <b>M</b>
            </div>
          </div>
        ))}
        <div className="hc-btn">
          <span>Quick buy the fit · {formatPrice(total)}</span>
          <span>
            <CircleCheck className="hc-ic" /> The whole fit, in M
          </span>
        </div>
      </div>
    );
  }
  if (kind === "size")
    return (
      <div className="hc-sheet">
        <span className="relative block">
          {img(hero.img, "hc-shot")}
          <span className="hc-dim hc-w">
            <i />
            <span>Chest {hero.chest ? `${hero.chest} cm` : "in cm"}</span>
          </span>
          <span className="hc-dim hc-h">
            <i />
            <span>Length {hero.length ? `${hero.length} cm` : "in cm"}</span>
          </span>
        </span>
        <div className="hc-pad hc-yours">
          <div>
            <div className="hc-mono">Your size</div>
            <div className="hc-name">
              <span>Saved for every piece</span>
            </div>
          </div>
          <b>M</b>
        </div>
      </div>
    );
  if (kind === "vault")
    return (
      <div className={`hc-sheet hc-vault ${done}`}>
        <span className="relative block bg-[#161616]">
          {img(vault.img, "hc-shot")}
          <span className="hc-num hc-mono">Mostly one of each</span>
        </span>
        <div className="hc-pad">
          <div className="hc-mono">The Vault · original</div>
          <div className="hc-name">
            <span className="truncate">{vault.name}</span>
            <span>{formatPrice(vault.price)}</span>
          </div>
          <div className="hc-btn">
            <span>Buy now</span>
            <span>
              <CircleCheck className="hc-ic" /> Yours
            </span>
          </div>
        </div>
      </div>
    );
  return <DropCount s={s} drop={drop} />;
}

const ASK = "something oversized in M, under 2500";
function PickChat({ s, picks }: { s: number; picks: Piece[] }) {
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (s < 1 || typed >= ASK.length) return;
    const t = setTimeout(() => setTyped((n) => n + 1), 22);
    return () => clearTimeout(t);
  }, [s, typed]);
  return (
    <div className="hc-sheet hc-chat">
      <div className="hc-mono">Pick · AI assistant</div>
      <div className="hc-me">{ASK.slice(0, s >= 3 ? ASK.length : typed)}</div>
      <div className="hc-dots">
        <i />
        <i />
        <i />
      </div>
      <div className="hc-picks">
        {picks.slice(0, 3).map((p, k) => (
          <div key={k} className="hc-pk">
            {img(p.img, "", "48px")}
            <span>
              {p.name}
              <small>{formatPrice(p.price)}</small>
            </span>
            <b>Add M</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function DropCount({ s, drop }: { s: number; drop: Piece }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    if (s < 1 || n <= 0) return;
    const t = setTimeout(() => setN((v) => v - 1), 420);
    return () => clearTimeout(t);
  }, [s, n]);
  return (
    <div className="hc-sheet hc-drop">
      <span className="relative block">
        {img(drop.img, "hc-shot")}
        <span className="hc-clock">
          <span className="hc-mono">The next drop</span>
          <b>00:00:0{Math.max(0, n)}</b>
        </span>
        <span className="hc-livetag hc-mono">
          <i /> Live now
        </span>
      </span>
      <div className="hc-pad">
        <div className="hc-mono">One message on drop day</div>
        <div className="hc-name">
          <span className="truncate">{drop.name}</span>
          <span>{formatPrice(drop.price)}</span>
        </div>
      </div>
    </div>
  );
}

/** A film full screen, with its steps under it (tap one to go there). */
function FilmDialog({ watching, onClose }: { watching: Watching | null; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState(-1);
  const film = watching?.film;
  return (
    <Dialog.Root open={!!film} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[#0a0a0a]/95" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-0 z-[91] flex flex-col items-center justify-center overflow-y-auto px-4 py-16 outline-none md:px-10">
          <Dialog.Title className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.3em] text-white/60">{watching?.title}</Dialog.Title>
          <Dialog.Close aria-label="Close" className="absolute right-3 top-3 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <X aria-hidden className="h-5 w-5" />
          </Dialog.Close>
          {film && (
            <div className="w-full max-w-[1200px]">
              <video
                ref={video}
                key={film.src}
                src={film.src}
                poster={film.poster}
                autoPlay
                muted
                playsInline
                controls
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  v.defaultPlaybackRate = RATE;
                  v.playbackRate = RATE;
                  if (watching?.from) v.currentTime = Math.max(0, watching.from - 0.5);
                }}
                onTimeUpdate={(e) => setStep(stepAt(film, e.currentTarget.currentTime))}
                className="mx-auto block max-h-[70svh] w-full bg-black"
              />
              <ol aria-label="Steps" className="mx-auto mt-5 grid max-w-[720px] grid-cols-2 gap-x-6">
                {film.steps.map(([label, t], i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        const v = video.current;
                        if (!v) return;
                        v.currentTime = Math.max(0, t - 0.2);
                        void v.play().catch(() => {});
                      }}
                      aria-current={i === step ? "step" : undefined}
                      className={`flex min-h-8 w-full cursor-pointer items-baseline gap-2.5 py-1 text-left text-[13px] transition-colors hover:text-white ${i === step ? "font-semibold text-white" : i < step ? "text-white/60" : "text-white/40"}`}
                    >
                      <span className="w-5 shrink-0 font-mono text-[10px] opacity-70">{String(i + 1).padStart(2, "0")}</span>
                      {label}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
