"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { ProductImage } from "@/components/product-image";
import { V } from "./look";
import type { TileData } from "./vault-tile";

const EASE = [0.16, 1, 0.3, 1] as const;
/** One full turn of the orbit, in seconds. */
const TURN = 46;

/**
 * The Vault's opening, after the "Orra" reference (owner, 25 Oct 2026): black and white, a person
 * large in the middle running off the foot of the screen, a faint huge word behind, the name top
 * left in a serif with an italic line under it, the way in top right, and the featured pieces
 * orbiting the head on a thin ellipse: behind it on the far side, in front on the near side. The
 * orbit pauses while pointed at, and stands still for people who ask for less motion.
 */
export function VaultHero({ title, line, note, pieces, count, side, figure }: { title: string; /** The italic line under the name. */ line: string; note: string; pieces: TileData[]; count: string; side: string; figure?: { src: string; width: number; height: number } }) {
  const still = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const chips = useRef<(HTMLAnchorElement | null)[]>([]);
  const ring = useRef<HTMLSpanElement>(null);
  const held = useRef(false);
  const orbit = pieces.slice(0, 6);
  const n = orbit.length;

  // The orbit: each chip's place on the ellipse, worked out every frame and written straight to it.
  useEffect(() => {
    if (!n) return;
    let raf = 0;
    let angle = 0;
    let last = performance.now();
    const place = () => {
      const box = ref.current;
      if (!box) return;
      const w = box.clientWidth;
      // Half the ellipse's width and height: narrower on a phone, so the cards stay clear of the words.
      const a = w < 768 ? w * 0.4 : Math.min(w * 0.3, 420);
      const b = w < 768 ? 44 : Math.min(w * 0.05, 60) + 20;
      if (ring.current) {
        ring.current.style.width = `${a * 2}px`;
        ring.current.style.height = `${b * 2}px`;
      }
      chips.current.forEach((el, i) => {
        if (!el) return;
        const t = angle + (i / n) * Math.PI * 2;
        const depth = (Math.sin(t) + 1) / 2; // 0 on the far side, 1 on the near side
        el.style.transform = `translate(-50%, -50%) translate(${(Math.cos(t) * a).toFixed(1)}px, ${(Math.sin(t) * b).toFixed(1)}px) scale(${(0.82 + depth * 0.22).toFixed(3)})`;
        el.style.opacity = (0.55 + depth * 0.45).toFixed(3);
        el.style.zIndex = Math.sin(t) > 0 ? "30" : "5";
      });
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!held.current) angle += (dt / TURN) * Math.PI * 2;
      place();
      raf = requestAnimationFrame(tick);
    };
    if (still) place();
    else raf = requestAnimationFrame(tick);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
    };
  }, [n, still]);

  // The figure and the faint word drift apart a little with the scroll, through a soft spring.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const glide = useSpring(scrollYProgress, { stiffness: 70, damping: 26, mass: 0.6 });
  const figY = useTransform(glide, [0, 1], still ? [0, 0] : [0, -60]);
  const wordY = useTransform(glide, [0, 1], still ? [0, 0] : [0, 120]);
  const rise = (delay: number) => ({ initial: still ? false : { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.1, ease: EASE, delay } }) as const;
  const hold = (on: boolean) => () => {
    held.current = on;
  };

  return (
    <section ref={ref} aria-labelledby="vault-title" className="relative isolate min-h-[100svh] overflow-hidden">
      {/* The faint huge word, behind everything */}
      <motion.p aria-hidden style={{ y: wordY }} className="pointer-events-none absolute inset-x-0 top-[44%] -z-10 select-none whitespace-nowrap text-center font-serif text-[clamp(8rem,26vw,26rem)] italic leading-none text-[var(--v-deep)] opacity-[0.06]">
        {title}
      </motion.p>

      {/* The person, large, running off the foot of the screen */}
      {figure && (
        <motion.div style={{ y: figY }} className="pointer-events-none absolute inset-x-0 top-[22svh] z-10 flex justify-center md:top-[14svh]">
          <motion.div initial={still ? false : { opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.5, ease: EASE, delay: 0.2 }}>
            <Image src={figure.src} alt="" width={figure.width} height={figure.height} priority sizes="(min-width: 768px) 560px, 90vw" className="h-[118svh] w-auto max-w-none object-contain [filter:drop-shadow(0_30px_40px_rgba(0,0,0,0.16))] md:h-[150svh]" />
          </motion.div>
        </motion.div>
      )}

      {/* The orbit round the head: a thin ellipse, and the pieces riding it */}
      {n > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-[62svh] z-20 md:top-[42svh]">
          <motion.span ref={ring} aria-hidden initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: EASE, delay: 0.7 }} className="absolute left-0 top-0 block -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[var(--v-deep)]/20" />
          <ul aria-label="Featured pieces">
            {orbit.map((p, i) => (
              <li key={p.id}>
                <Link
                  ref={(el) => {
                    chips.current[i] = el;
                  }}
                  href={`/product/${p.slug}`}
                  aria-label={`${p.name}, ${p.sold ? "sold" : p.priceText}`}
                  onFocus={hold(true)}
                  onBlur={hold(false)}
                  onPointerEnter={hold(true)}
                  onPointerLeave={hold(false)}
                  className="pointer-events-auto absolute left-0 top-0 flex w-max items-center gap-2.5 rounded-[10px] bg-white/85 py-1.5 pl-1.5 pr-3.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/5 backdrop-blur-md transition-[background-color] duration-300 will-change-transform hover:bg-white"
                  style={{ transform: "translate(-50%, -50%)" }}
                >
                  <span className="block w-9 overflow-hidden rounded-[6px] bg-[var(--v-tile)]">
                    <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative ground="bg-transparent" sizes="36px" />
                  </span>
                  <span className="leading-tight">
                    <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#666]">{p.brand}</span>
                    <span className="block text-[12.5px] font-semibold text-[#111]">{p.sold ? "Sold" : p.priceText}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The words: the name top left, the way in top right, the count and the scroll cue at the foot */}
      <div className="container-ep pointer-events-none relative z-30 flex min-h-[100svh] flex-col justify-between pb-8 pt-24 md:pt-[124px]">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <motion.div {...rise(0.1)} className="pointer-events-auto max-w-[78%] md:max-w-[min(36vw,560px)]">
            <h1 id="vault-title" className={`font-serif text-[clamp(3rem,1.8rem+4.6vw,6.6rem)] font-normal leading-[0.92] tracking-[-0.02em] ${V.deep}`}>
              {title}
            </h1>
            <p className="font-serif text-[clamp(3rem,1.8rem+4.6vw,6.6rem)] italic leading-[0.92] tracking-[-0.02em] text-[var(--v-deep)]/40">{line}</p>
          </motion.div>
          <motion.div {...rise(0.3)} className="pointer-events-auto max-w-[34ch] md:pt-3 md:text-right">
            <p className={`text-[14px] leading-relaxed ${V.ink} opacity-75`}>{note}</p>
            <div className="mt-4 flex items-center gap-3 md:justify-end">
              <Link href="#inventory" className="group inline-flex h-11 items-center gap-3 rounded-full bg-[var(--v-deep)] pl-5 pr-1.5 text-[13px] font-semibold text-[var(--v-frost)] transition-opacity hover:opacity-90">
                {side}
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--v-frost)] text-[var(--v-deep)] transition-transform duration-500 group-hover:rotate-45">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </span>
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="flex items-end justify-between gap-6">
          <motion.p {...rise(0.6)} className={`${V.mono} ${V.ink}`}>
            {count}
          </motion.p>
          <motion.a {...rise(0.7)} href="#inventory" className={`pointer-events-auto flex min-h-11 items-center gap-3 ${V.mono} ${V.ink}`}>
            Scroll
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--v-deep)]/30">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 5v14M6 13l6 6 6-6" />
              </svg>
            </span>
          </motion.a>
        </div>
      </div>
    </section>
  );
}
