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
 * with one line set large in the middle, then a row of rounded cards that are shortcuts, practical
 * first (owner: "practical"): how buying here works, then what's still available, what's under a
 * price, what's down to its last one, each opening the pieces already filtered, and trying it on in
 * the store. Only true numbers; nothing invented.
 */
/** About the Vault, on black: right under the opening, above the brands (owner, 27 Oct 2026). */
export function VaultStatement({ statement, sub }: { statement: string; sub: string }) {
  return (
    <section aria-label="The Vault" className="overflow-hidden rounded-[28px] bg-[#0d0d0d] px-6 py-20 text-center text-white md:py-28">
      <Rise>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/60">About the Vault</p>
        <h2 className="mx-auto mt-5 max-w-[18ch] text-balance text-[clamp(2.2rem,1.4rem+3.4vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.035em]">{statement}</h2>
        <p className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/65">{sub}</p>
        <span aria-hidden className="mx-auto mt-10 block h-px w-10 rotate-[25deg] bg-white/70" />
      </Rise>
    </section>
  );
}

export function VaultBento({ available, under, last, base, figure }: {
  /** Pieces that can still be bought. */
  available: number;
  /** A price step and how many are under it, when there are enough pieces for one. */
  under: { cap: number; n: number } | null;
  /** Pieces down to their last one. */
  last: number;
  /** The page these shortcuts filter: "/vault" or a brand's page. */
  base: string;
  figure?: { src: string; width: number; height: number };
}) {
  const two = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="space-y-3 px-3 md:space-y-4 md:px-4">
      {/* The cards: how buying works, then shortcuts into the pieces, then the store */}
      <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <Rise className="flex flex-col justify-between rounded-[28px] bg-white p-7 md:min-h-[300px]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#666]">Buying from the Vault</p>
          <ul className="mt-8 space-y-3.5 text-[#111]">
            {[
              ["Checked by hand", "Looked over inside and out; the invoice is kept."],
              ["One of each", "Most pieces come in once and are never restocked."],
              ["7-day size exchange", "Unworn, with the tags on."],
            ].map(([t, d]) => (
              <li key={t} className="border-t border-black/10 pt-3.5">
                <span className="block text-[17px] font-semibold tracking-[-0.02em]">{t}</span>
                <span className="mt-0.5 block text-[13px] text-[#666]">{d}</span>
              </li>
            ))}
          </ul>
        </Rise>

        <Rise delay={0.08}>
          <Link href={`${base}${base.includes("?") ? "&" : "?"}left=1#inventory`} className="group relative flex h-full min-h-[260px] flex-col justify-between overflow-hidden rounded-[28px] bg-[#111] p-7 text-white">
            <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.28),rgba(255,255,255,0.04)_45%,transparent_70%)]" />
            <span className="relative">
              <span className="block text-[clamp(3rem,2.4rem+2vw,4.4rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums">{two(available)}</span>
              <span className="mt-2 block text-[15px] text-white/80">Still available</span>
            </span>
            <span className="relative flex items-end justify-between gap-4">
              <span className="max-w-[22ch] text-[12.5px] leading-snug text-white/60">See only what you can buy today.</span>
              <ArrowDot dark />
            </span>
          </Link>
        </Rise>

        <Rise delay={0.16}>
          {under ? (
            <Link href={`${base}${base.includes("?") ? "&" : "?"}under=${under.cap}#inventory`} className="group flex h-full min-h-[260px] flex-col justify-between rounded-[28px] bg-white p-7 text-[#111]">
              <span>
                <span className="block text-[clamp(3rem,2.4rem+2vw,4.4rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums">{two(under.n)}</span>
                <span className="mt-2 block text-[15px] text-[#444]">Under Rs {new Intl.NumberFormat("en-IN").format(under.cap)}</span>
              </span>
              <span className="flex items-end justify-between gap-4">
                <span className="max-w-[22ch] text-[12.5px] leading-snug text-[#666]">{last ? `${last} down to the last one.` : "Original pieces, fixed prices."}</span>
                <ArrowDot />
              </span>
            </Link>
          ) : (
            <Link href={`${base}${base.includes("?") ? "&" : "?"}last=1#inventory`} className="group flex h-full min-h-[260px] flex-col justify-between rounded-[28px] bg-white p-7 text-[#111]">
              <span>
                <span className="block text-[clamp(3rem,2.4rem+2vw,4.4rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums">{two(last)}</span>
                <span className="mt-2 block text-[15px] text-[#444]">Last ones</span>
              </span>
              <span className="flex items-end justify-between gap-4">
                <span className="max-w-[22ch] text-[12.5px] leading-snug text-[#666]">One left in its size, then gone.</span>
                <ArrowDot />
              </span>
            </Link>
          )}
        </Rise>

        <Rise delay={0.24}>
          <Link href="/visit" className="group relative flex h-full min-h-[260px] flex-col justify-between overflow-hidden rounded-[28px] bg-[#e2e1dd] p-7 text-[#111]">
            {figure && (
              <Image src={figure.src} alt="" width={figure.width} height={figure.height} sizes="300px" className="pointer-events-none absolute -bottom-24 right-[-10%] h-[150%] w-auto max-w-none object-contain opacity-95 transition-transform duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]" />
            )}
            <span className="relative max-w-[12ch]">
              <span className="block text-[clamp(1.6rem,1.3rem+1vw,2.2rem)] font-semibold leading-[1.02] tracking-[-0.03em]">Try it on first</span>
              <span className="mt-2 block text-[13px] text-[#444]">Every Vault piece, in our Kathmandu store.</span>
            </span>
            <span className="relative flex items-end justify-between gap-4">
              <span className="max-w-[16ch] text-[12.5px] leading-snug text-[#555]">Plan a visit</span>
              <ArrowDot />
            </span>
          </Link>
        </Rise>
      </div>
    </div>
  );
}
