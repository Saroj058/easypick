"use client";

import { motion } from "framer-motion";
import Image from "next/image";

// The moving pictures of the home's story cards (owner, 27 Oct 2026: each card shows what it says:
// steps joined by a line, pieces coming together into a fit, a tee becoming a gift, measurements
// drawn around a garment, the Vault lit up, an order packed to the door, and everything gathered at
// the end). Each plays once as its card lands and settles by about 2.6 s; still for less motion.

export type SceneKind = "steps" | "pick" | "gift" | "fits" | "vault" | "door" | "close";

export interface SceneData {
  kind: SceneKind;
  /** Measurements for "fits", true to a real piece: [label, cm]. */
  marks?: [string, number][];
}

const EASE = [0.16, 1, 0.3, 1] as const;
const T0 = 0.55; // when the card has nearly landed

/** One timed move: from `a` to `b`, starting `at` seconds after the card arrives. */
const play = (still: boolean, at: number, d = 0.8) => (still ? { duration: 0 } : { delay: T0 + at, duration: d, ease: EASE });

function Photo({ src, alt = "", className = "", pos = "50% 50%" }: { src: string; alt?: string; className?: string; pos?: string }) {
  return <Image src={src} alt={alt} fill sizes="(min-width: 768px) 30vw, 92vw" className={`object-cover grayscale ${className}`} style={{ objectPosition: pos }} />;
}

export function StoryScene({ scene, still }: { scene: SceneData; still: boolean }) {
  switch (scene.kind) {
    case "steps":
      return <Steps still={still} />;
    case "pick":
      return <Pick still={still} />;
    case "gift":
      return <Gift still={still} />;
    case "fits":
      return <Fits still={still} marks={scene.marks ?? []} />;
    case "vault":
      return <Vault still={still} />;
    case "door":
      return <Door still={still} />;
    case "close":
      return <Close still={still} />;
  }
}

/** Pick it. Pay it. Wear it: three pictures joined by one line, online and in the store under it. */
function Steps({ still }: { still: boolean }) {
  const steps = [
    { src: "/story/phone.webp", say: "Pick it" },
    { src: "/story/kiosk.webp", say: "Pay it" },
    { src: "/story/kathmandu.webp", say: "Wear it" },
  ];
  return (
    <div className="flex h-full w-full flex-col justify-center gap-4">
      <div className="relative grid grid-cols-3 gap-3">
        {steps.map((s, i) => (
          <motion.div key={s.say} initial={still ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={play(still, i * 0.18, 0.7)} className="flex flex-col items-center">
            <span className="relative block aspect-[3/5] w-full overflow-hidden bg-[#ececea]">
              <Photo src={s.src} />
            </span>
            <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em]">
              0{i + 1} · {s.say}
            </span>
          </motion.div>
        ))}
        {/* The line that joins them */}
        <svg aria-hidden viewBox="0 0 300 10" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[16%] top-[46%] h-2 w-[68%] overflow-visible">
          <motion.path d="M0,5 L300,5" stroke="#111" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={play(still, 0.6, 1)} />
        </svg>
      </div>
      <motion.dl initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={play(still, 1.4, 0.6)} className="grid gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#111]/75">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-[#111]">Online</dt>
          <dd>Buy now · eSewa · to your door</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-[#111]">In store</dt>
          <dd>Try it · pay at the kiosk · walk out</dd>
        </div>
      </motion.dl>
    </div>
  );
}

/** Separate pieces coming together into one fit. */
function Pick({ still }: { still: boolean }) {
  const pieces = [
    { src: "/rack/coach-jacket.webp", w: 741, h: 773, box: "left-[18%] top-[2%] w-[64%]", from: { x: "-70%", y: "10%", rotate: -8 } },
    { src: "/rack/wide-cargo-pant.webp", w: 548, h: 907, box: "left-[29%] top-[36%] w-[42%]", from: { x: "90%", y: "-30%", rotate: 7 } },
    { src: "/rack/acc/sneakers-clear.webp", w: 520, h: 228, box: "left-[30%] top-[84%] w-[40%]", from: { x: "-60%", y: "-20%", rotate: -5 } },
  ];
  return (
    <div className="relative h-full w-full bg-[#f2f1ee]">
      <div className="relative mx-auto h-full max-w-[min(100%,62vh)] md:max-w-none" style={{ aspectRatio: "3 / 5" }}>
        {pieces.map((p, i) => (
          <motion.div key={p.src} className={`absolute ${p.box}`} initial={still ? false : { ...p.from, opacity: 0.4 }} animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }} transition={play(still, 0.15 + i * 0.12, 1)}>
            <Image src={p.src} alt="" width={p.w} height={p.h} sizes="(min-width: 768px) 18vw, 40vw" className="h-auto w-full grayscale [filter:drop-shadow(0_14px_12px_rgba(0,0,0,0.18))]" />
          </motion.div>
        ))}
      </div>
      <motion.span initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={play(still, 1.4, 0.5)} className="absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-[0.2em]">
        One fit
      </motion.span>
    </div>
  );
}

/** A piece becomes a gift: the tee, then the box, then the note. */
function Gift({ still }: { still: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#ececea]">
      <motion.div className="absolute inset-0" initial={still ? false : { opacity: 1, scale: 1 }} animate={{ opacity: 0, scale: 0.86 }} transition={play(still, 0.1, 0.9)}>
        <Photo src="/products/oversized-heavy-tee/front.jpg" />
      </motion.div>
      <motion.div className="absolute inset-0" initial={still ? false : { opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={play(still, 0.3, 1)}>
        <Photo src="/story/gift-box.webp" />
      </motion.div>
      <motion.div className="absolute bottom-[8%] right-[6%] w-[44%] shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]" initial={still ? false : { x: "60%", rotate: 6, opacity: 0 }} animate={{ x: 0, rotate: -4, opacity: 1 }} transition={play(still, 1.1, 0.9)}>
        <span className="relative block aspect-[3/4] w-full overflow-hidden">
          <Photo src="/story/gift-card.webp" pos="50% 70%" />
        </span>
      </motion.div>
    </div>
  );
}

/** Measurements drawn around a real piece, in cm. */
function Fits({ still, marks }: { still: boolean; marks: [string, number][] }) {
  // Where each line runs on the flat-lay (in % of the picture): chest across, length down, sleeve along.
  const lines: Record<string, { d: string; at: [number, number] }> = {
    chest: { d: "M24,42 L76,42", at: [50, 38] },
    length: { d: "M50,14 L50,90", at: [60, 70] },
    sleeve: { d: "M74,22 L90,40", at: [86, 22] },
    shoulder: { d: "M30,20 L70,20", at: [50, 16] },
  };
  const shown = marks.filter(([k]) => lines[k.toLowerCase()]).slice(0, 3);
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f2f1ee]">
      <div className="absolute inset-[6%]">
        <Image src="/products/oversized-heavy-tee/front.jpg" alt="" fill sizes="(min-width: 768px) 30vw, 92vw" className="object-contain grayscale mix-blend-multiply" />
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {shown.map(([k], i) => (
            <motion.path key={k} d={lines[k.toLowerCase()].d} stroke="#111" strokeWidth="1.2" strokeDasharray="3 2" fill="none" vectorEffect="non-scaling-stroke" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={play(still, 0.2 + i * 0.35, 0.6)} />
          ))}
        </svg>
        {shown.map(([k, cm], i) => {
          const [x, y] = lines[k.toLowerCase()].at;
          return (
            <motion.span key={k} className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-white/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ left: `${x}%`, top: `${y}%` }} initial={still ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={play(still, 0.6 + i * 0.35, 0.5)}>
              {k} {cm} cm
            </motion.span>
          );
        })}
      </div>
    </div>
  );
}

/** The Vault: the case lights up out of the dark. */
function Vault({ still }: { still: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0a]">
      <motion.div className="absolute inset-0" initial={still ? false : { filter: "brightness(0.15)", scale: 1.08 }} animate={{ filter: "brightness(1)", scale: 1 }} transition={play(still, 0.1, 1.6)}>
        <Photo src="/story/vault.webp" />
      </motion.div>
      {/* A soft light passing over it */}
      {!still && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 block mix-blend-screen"
          style={{ background: "radial-gradient(40% 60% at 50% 40%, rgba(255,255,255,0.35), transparent 70%)" }}
          initial={{ x: "-60%", opacity: 0 }}
          animate={{ x: "40%", opacity: [0, 1, 0] }}
          transition={{ delay: T0 + 0.3, duration: 1.8, ease: "easeInOut" }}
        />
      )}
      <motion.span className="absolute bottom-[7%] left-[8%] block h-px w-[40%] origin-left bg-white/70" initial={still ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={play(still, 1.4, 0.7)} />
    </div>
  );
}

/** To your door: the pieces drop into the box on the step. */
function Door({ still }: { still: boolean }) {
  const pieces = [
    { src: "/rack/oversized-heavy-tee.webp", w: 756, h: 740, x: "-42%" },
    { src: "/rack/relaxed-straight-jean.webp", w: 449, h: 975, x: "0%" },
    { src: "/rack/acc/sneakers-clear.webp", w: 520, h: 228, x: "42%" },
  ];
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#ececea]">
      <Photo src="/story/door-box.webp" pos="50% 70%" />
      {!still &&
        pieces.map((p, i) => (
          <motion.div key={p.src} className="absolute left-[38%] top-[8%] w-[24%]" initial={{ x: p.x, y: "-10%", scale: 1, opacity: 1 }} animate={{ x: "0%", y: "160%", scale: 0.3, opacity: 0 }} transition={{ delay: T0 + 0.1 + i * 0.15, duration: 1.1, ease: [0.55, 0, 0.75, 0.2] }}>
            <Image src={p.src} alt="" width={p.w} height={p.h} sizes="20vw" className="h-auto w-full grayscale [filter:drop-shadow(0_10px_10px_rgba(0,0,0,0.25))]" />
          </motion.div>
        ))}
      <motion.span className="absolute bottom-3 left-3 bg-white px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em]" initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={play(still, 1.5, 0.5)}>
        At your door ✓
      </motion.span>
    </div>
  );
}

/** The end: the story's pictures gather into one fanned deck. */
function Close({ still }: { still: boolean }) {
  const deck = ["/story/storefront.webp", "/story/man-hoodie.webp", "/story/flatlay.webp", "/story/bag.webp"];
  const fan = [-10, -3.5, 3.5, 10];
  const spread = [
    { x: "-60%", y: "-40%" },
    { x: "60%", y: "-40%" },
    { x: "-60%", y: "40%" },
    { x: "60%", y: "40%" },
  ];
  return (
    <div className="relative grid h-full w-full place-items-center overflow-hidden">
      {deck.map((src, i) => (
        <motion.span key={src} className="absolute block aspect-[3/5] h-[78%] overflow-hidden bg-[#ececea] shadow-[0_24px_40px_-24px_rgba(0,0,0,0.5)]" initial={still ? false : { ...spread[i], rotate: 0, opacity: 0 }} animate={{ x: `${(i - 1.5) * 16}%`, y: 0, rotate: fan[i], opacity: 1 }} transition={play(still, 0.05 + i * 0.1, 1.1)}>
          <Photo src={src} />
        </motion.span>
      ))}
    </div>
  );
}
