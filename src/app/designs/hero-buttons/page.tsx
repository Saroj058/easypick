import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Hero button designs", robots: { index: false, follow: false } };

// Five designs for the hero's two buttons, Visit store and Shop Drop (owner, 25 Oct 2026: "give me
// 5 options of design for this"). Not linked from the site; the chosen one replaces the current.

const DROP = "03";
const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
    <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const Dot = () => (
  <span className="relative flex h-2 w-2" aria-hidden>
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22c55e]" />
  </span>
);

function Frame({ n, name, note, children }: { n: number; name: string; note: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink/10 py-12">
      <div className="container-ep">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-mono text-[12px] text-steel-dark">Design {String(n).padStart(2, "0")}</span>
          <h2 className="text-[22px] font-semibold">{name}</h2>
          <p className="text-[14px] text-steel-dark">{note}</p>
        </div>
        <div className="mt-8 max-w-[460px]">
          <p className="text-[15px] leading-relaxed text-ink/75 sm:text-[16px]">
            Fixed prices. Automated checkout.
            <br />
            Same price online and in-store.
          </p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </section>
  );
}

// 1. One strong button, one quiet link.
function D1() {
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
      <Link href={`/drop/${DROP}`} className="group flex h-12 items-center gap-3 rounded-full bg-ink px-7 text-[13px] font-semibold uppercase tracking-[0.08em] text-paper hover:bg-ink/85">
        Shop Drop {DROP} <Arrow />
      </Link>
      <Link href="/visit" className="group flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink underline decoration-ink/30 underline-offset-[6px] hover:decoration-ink">
        <Dot /> Visit store
      </Link>
    </div>
  );
}

// 2. One bar, split in two.
function D2() {
  return (
    <div className="flex h-14 w-full divide-x divide-ink border border-ink text-[13px] font-semibold uppercase tracking-[0.08em]">
      <Link href="/visit" className="group flex flex-1 items-center justify-center gap-2.5 hover:bg-ink/5">
        <Dot /> Visit store
      </Link>
      <Link href={`/drop/${DROP}`} className="group flex flex-1 items-center justify-center gap-3 bg-ink text-paper hover:bg-ink/85">
        Shop Drop {DROP} <Arrow />
      </Link>
    </div>
  );
}

// 3. Two equal pills side by side: filled for the drop, outlined for the store.
function D3() {
  return (
    <div className="grid grid-cols-2 gap-3 text-[13px] font-semibold uppercase tracking-[0.08em]">
      <Link href={`/drop/${DROP}`} className="group flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-paper hover:bg-ink/85">
        Shop Drop {DROP} <Arrow />
      </Link>
      <Link href="/visit" className="group flex h-12 items-center justify-center gap-2.5 rounded-full border border-ink/40 hover:border-ink">
        <Dot /> Visit store
      </Link>
    </div>
  );
}

// 4. An index: two rows with hairlines, like a menu.
function D4() {
  const rows = [
    { n: "01", href: `/drop/${DROP}`, label: `Shop Drop ${DROP}`, sub: "Out now" },
    { n: "02", href: "/visit", label: "Visit store", sub: "In person or virtual tour" },
  ];
  return (
    <ul className="border-t border-ink">
      {rows.map((r) => (
        <li key={r.n} className="border-b border-ink/20">
          <Link href={r.href} className="group flex items-center gap-4 py-4 hover:pl-2 transition-[padding] duration-300">
            <span className="font-mono text-[11px] text-steel-dark">{r.n}</span>
            <span className="text-[17px] font-semibold tracking-[-0.01em]">{r.label}</span>
            <span className="hidden text-[13px] text-steel-dark sm:inline">{r.sub}</span>
            <span className="ml-auto">
              <Arrow />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// 5. Two small cards, each saying what you get.
function D5() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href={`/drop/${DROP}`} className="group flex flex-col justify-between gap-6 rounded-[4px] bg-ink p-4 text-paper hover:bg-ink/85">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper/60">Online</span>
        <span className="flex items-center justify-between text-[15px] font-semibold">
          Shop Drop {DROP} <Arrow />
        </span>
      </Link>
      <Link href="/visit" className="group flex flex-col justify-between gap-6 rounded-[4px] border border-ink/25 p-4 hover:border-ink">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">
          <Dot /> Open now
        </span>
        <span className="flex items-center justify-between text-[15px] font-semibold">
          Visit store <Arrow />
        </span>
      </Link>
    </div>
  );
}

export default function HeroButtonDesigns() {
  return (
    <main className="pb-24">
      <div className="container-ep pt-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel-dark">Home · hero buttons</p>
        <h1 className="mt-2 text-[clamp(2rem,1.6rem+2vw,3rem)] font-semibold tracking-[-0.02em]">Five designs</h1>
        <p className="mt-2 max-w-[560px] text-[15px] text-steel-dark">Pick a number and it replaces the two buttons under the hero words. The hover links (In person, Virtual tour) stay with any of them.</p>
      </div>
      <Frame n={1} name="Button and link" note="One strong button for the drop; the store as a quiet underlined link.">
        <D1 />
      </Frame>
      <Frame n={2} name="Split bar" note="One square bar cut in two. Sharp, very streetwear.">
        <D2 />
      </Frame>
      <Frame n={3} name="Twin pills" note="Same size, side by side. Filled for the drop, outlined for the store.">
        <D3 />
      </Frame>
      <Frame n={4} name="Index rows" note="Two numbered rows with hairlines, like a menu. Calm and editorial.">
        <D4 />
      </Frame>
      <Frame n={5} name="Mini cards" note="Two small tiles that say what each one is: online, or open now.">
        <D5 />
      </Frame>
    </main>
  );
}
