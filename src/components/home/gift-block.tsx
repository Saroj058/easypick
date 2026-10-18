import Link from "next/link";

import { GiftCardPicture } from "@/components/gift-card-art";
import { ArrowIcon } from "@/components/icons";

/**
 * Buying for someone (owner, 18 Oct 2026: "small, thin, more creative"): one slim black strip
 * wrapped like a present: a faint diagonal wrap pattern, a white ribbon running down it with a bow
 * on top, the line, and the two ways in. Three gift cards peek out of the top edge and rise when
 * the strip is pointed at.
 */
export function GiftBlock() {
  const door = "inline-flex h-11 items-center gap-2 rounded-full px-5 text-[12.5px] font-semibold uppercase tracking-[0.08em] transition-[background-color,color,scale] duration-200 active:scale-[0.97]";
  return (
    <div className="group relative pt-6">
      {/* The cards, tucked behind the strip's top edge */}
      <span aria-hidden className="pointer-events-none absolute right-[6%] top-0 hidden h-[70px] w-[120px] md:block">
        {[
          { a: 20000, r: "-rotate-[14deg] group-hover:-rotate-[22deg]", y: "translate-y-6 group-hover:-translate-y-1" },
          { a: 5000, r: "-rotate-[3deg] group-hover:-rotate-[6deg]", y: "translate-y-7 group-hover:translate-y-0" },
          { a: 2000, r: "rotate-[8deg] group-hover:rotate-[14deg]", y: "translate-y-8 group-hover:translate-y-1" },
        ].map((c) => (
          <span key={c.a} className={`absolute inset-x-0 top-0 block origin-bottom transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${c.r} ${c.y}`}>
            <GiftCardPicture amount={c.a} className="shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)]" />
          </span>
        ))}
      </span>

      {/* The bow, sitting on the strip's top edge where the ribbon starts */}
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-[4px] z-10 hidden -translate-x-1/2 md:block">
        <svg width="76" height="36" viewBox="0 0 56 26" className="transition-transform duration-500 group-hover:scale-110">
          <path d="M28 12C22 2 8 0 6 8s14 8 22 4Z" fill="#f5f5f2" stroke="#0a0a0a" strokeWidth="1.4" />
          <path d="M28 12C34 2 48 0 50 8s-14 8-22 4Z" fill="#f5f5f2" stroke="#0a0a0a" strokeWidth="1.4" />
          <path d="M26 13l-5 11M30 13l5 11" stroke="#f5f5f2" strokeWidth="3" strokeLinecap="round" />
          <circle cx="28" cy="12" r="4.5" fill="#f5f5f2" stroke="#0a0a0a" strokeWidth="1.4" />
        </svg>
      </span>
      <div className="on-dark relative isolate flex flex-col gap-4 overflow-hidden rounded-2xl bg-ink px-5 py-5 text-paper md:flex-row md:items-center md:gap-8 md:py-4 md:pl-8 md:pr-5">
        {/* The wrap: faint diagonal lines */}
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.035)_0_2px,transparent_2px_14px)]" />
        {/* The ribbon, down the strip, with its bow at the top */}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 hidden w-[10px] -translate-x-1/2 bg-paper/90 md:block" />

        <div className="min-w-0">
          <h2 id="gift-title" className="display text-[26px] leading-none md:text-[30px]">
            Buying for someone?
          </h2>
          <p className="mt-1.5 text-[14px] text-paper/70">
            You pick the piece. <span className="text-paper">They pick the size.</span> We wrap it and bring it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <Link href="/gift" className={`${door} bg-paper text-ink hover:bg-white`}>
            Send a gift <ArrowIcon className="h-4 w-4" />
          </Link>
          <Link href="/gift#buy" className={`${door} border border-paper/40 text-paper hover:border-paper hover:bg-paper hover:text-ink`}>
            Gift cards
          </Link>
        </div>
      </div>
    </div>
  );
}
