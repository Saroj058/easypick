"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const EASE = [0.16, 1, 0.3, 1] as const;

/** A round arrow button, as on every card in the reference. */
export function ArrowDot({ dark = false }: { dark?: boolean }) {
  return (
    <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-45 ${dark ? "bg-white text-[#111]" : "bg-[#111] text-white"}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

/** Rises in once, the first time it's seen. */
function Rise({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const still = useReducedMotion();
  return (
    <motion.div className={className} initial={still ? false : { opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.9, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

/**
 * Under the Vault's opening, after the "FWD" reference (owner, 26 Oct 2026): a rounded black panel
 * with one line set large in the middle, then a row of rounded cards: a few words, the real numbers
 * (brands, pieces, one of each) each with its round arrow, and a card with the person from the
 * opening. Only true numbers; nothing invented.
 */
export function VaultBento({ statement, sub, brands, pieces, sold, figure }: { statement: string; sub: string; brands: number; pieces: number; sold: number; figure?: { src: string; width: number; height: number } }) {
  const two = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="space-y-3 px-3 md:space-y-4 md:px-4">
      {/* The statement, on black */}
      <section aria-label="The Vault" className="overflow-hidden rounded-[28px] bg-[#0d0d0d] px-6 py-20 text-center text-white md:py-28">
        <Rise>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/60">About the Vault</p>
          <h2 className="mx-auto mt-5 max-w-[18ch] text-balance text-[clamp(2.2rem,1.4rem+3.4vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.035em]">{statement}</h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/65">{sub}</p>
          <span aria-hidden className="mx-auto mt-10 block h-px w-10 rotate-[25deg] bg-white/70" />
        </Rise>
      </section>

      {/* The cards: a few words, the numbers, the person */}
      <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <Rise className="flex flex-col justify-between rounded-[28px] bg-white p-7 md:min-h-[300px]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#666]">Easypick · The Vault</p>
          <div>
            <p className="mt-10 text-[clamp(1.6rem,1.2rem+1.2vw,2.3rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-[#111]">
              Built to stand out.
              <br />
              Kept to be remembered.
            </p>
            <p className="mt-4 max-w-[38ch] text-[13px] leading-relaxed text-[#666]">Brand names describe the pieces. Easypick is an independent store, not an official seller of these brands.</p>
          </div>
        </Rise>

        <Rise delay={0.08}>
          <Link href="#inventory" className="group relative flex h-full min-h-[260px] flex-col justify-between overflow-hidden rounded-[28px] bg-[#111] p-7 text-white">
            <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.28),rgba(255,255,255,0.04)_45%,transparent_70%)]" />
            <span className="relative">
              <span className="block text-[clamp(3rem,2.4rem+2vw,4.4rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums">{two(pieces)}</span>
              <span className="mt-2 block text-[15px] text-white/80">Pieces in the Vault</span>
            </span>
            <span className="relative flex items-end justify-between gap-4">
              <span className="max-w-[22ch] text-[12.5px] leading-snug text-white/60">{sold ? `${sold} already gone. ` : ""}Every one checked by hand.</span>
              <ArrowDot dark />
            </span>
          </Link>
        </Rise>

        <Rise delay={0.16}>
          <Link href="#vault-brands" className="group flex h-full min-h-[260px] flex-col justify-between rounded-[28px] bg-white p-7 text-[#111]">
            <span>
              <span className="block text-[clamp(3rem,2.4rem+2vw,4.4rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums">{two(brands)}</span>
              <span className="mt-2 block text-[15px] text-[#444]">Original brands</span>
            </span>
            <span className="flex items-end justify-between gap-4">
              <span className="max-w-[22ch] text-[12.5px] leading-snug text-[#666]">Each with its own story and its own page.</span>
              <ArrowDot />
            </span>
          </Link>
        </Rise>

        <Rise delay={0.24}>
          <Link href="/visit" className="group relative flex h-full min-h-[260px] flex-col justify-between overflow-hidden rounded-[28px] bg-[#e2e1dd] p-7 text-[#111]">
            {figure && (
              <Image src={figure.src} alt="" width={figure.width} height={figure.height} sizes="300px" className="pointer-events-none absolute -bottom-24 right-[-10%] h-[150%] w-auto max-w-none object-contain opacity-95 transition-transform duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]" />
            )}
            <span className="relative">
              <span className="block text-[clamp(3rem,2.4rem+2vw,4.4rem)] font-semibold leading-none tracking-[-0.04em]">01</span>
              <span className="mt-2 block text-[15px] text-[#444]">Of each. Never restocked.</span>
            </span>
            <span className="relative flex items-end justify-between gap-4">
              <span className="max-w-[16ch] text-[12.5px] leading-snug text-[#555]">Try it on in our store.</span>
              <ArrowDot />
            </span>
          </Link>
        </Rise>
      </div>
    </div>
  );
}
