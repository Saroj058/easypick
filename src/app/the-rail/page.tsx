import type { Metadata } from "next";
import Link from "next/link";

import { Rail } from "@/components/home/rail";
import { RailDemo } from "@/components/landing/rail-demo";
import { railReel } from "@/lib/rail-reel";
import { kindsSetting } from "@/lib/settings/categories";
import { kindView } from "@/lib/settings/categories-rules";
import { homeSetting } from "@/lib/settings/home";
import { getProducts } from "@/lib/store";

export const metadata: Metadata = {
  title: "The rail",
  description: "Scroll the rail, stop on a piece, choose your size and take it. How shopping on Easypick works.",
  alternates: { canonical: "/the-rail" },
};

export const revalidate = 60;

const steps = [
  { n: "01", t: "Scroll.", d: "One rail for each kind of piece, tops first and then the rest of the fit. Swipe it on a phone, drag it or use the arrows on a computer." },
  { n: "02", t: "Stop.", d: "The piece in front shows its name, the price under it, its colours and whether it comes in your size. Tell us your size once; we remember it." },
  { n: "03", t: "Choose.", d: "Buy now pays right there, without leaving the rail. Or tap the bag on the card to take more than one. Tap the card to see the whole piece." },
];

/**
 * How the rail works (owner, 26 Oct 2026: "add one page for it: you can scroll and simply choose";
 * planned with agents): the rail playing by itself next to three words, Scroll, Stop, Choose; the three
 * steps in plain words; then the real rail, the same as the home page's, to try it right here.
 */
export default async function TheRailPage() {
  const [products, home, kindList] = await Promise.all([getProducts(), homeSetting.get(), kindsSetting.get()]);
  const kv = kindView(kindList);
  const range = products.filter((p) => !p.vault);
  const reel = railReel(products);

  return (
    <div className="bg-white text-[#111]">
      {/* The rail, playing, next to its three words */}
      <section className="container-ep grid items-center gap-8 pb-10 pt-12 md:min-h-[78svh] md:grid-cols-[1fr_1.1fr] md:gap-12 md:pt-16">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.3em] text-[#555]">The rail</p>
          <h1 className="mt-4 font-[family-name:var(--font-didone)] text-[clamp(3.2rem,14vw,8.5rem)] font-normal uppercase leading-[0.86] tracking-[-0.03em]">
            Scroll.
            <br />
            <em className="italic text-[#111]/60">Stop.</em>
            <br />
            Choose.
          </h1>
          <p className="mt-6 max-w-[38ch] text-[15px] leading-relaxed text-[#111]/75 md:text-[16px]">Every piece hangs on a rail with its price under the name. Slide along, stop on the one you like, and take it. Nothing to ask.</p>
          <a href="#try" className="group mt-6 inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em]">
            <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:100%_1px] bg-bottom bg-no-repeat pb-1 transition-[background-size] duration-500 group-hover:bg-[length:0%_1px]">Try it here</span>
            <span aria-hidden className="transition-transform duration-500 group-hover:translate-y-0.5">↓</span>
          </a>
        </div>
        {reel.length > 1 && (
          <div className="h-[48svh] md:h-[64svh]">
            <RailDemo reel={reel} />
          </div>
        )}
      </section>

      {/* The three steps */}
      <section aria-label="How it works" className="border-y border-[#111]/10">
        <ol className="container-ep grid gap-px md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="py-8 md:px-8 md:py-12 md:first:pl-0">
              <span className="font-mono text-[11px] tracking-[0.2em] text-[#111]/60">{s.n}</span>
              <h2 className="mt-3 font-[family-name:var(--font-didone)] text-[clamp(2.2rem,6vw,3.4rem)] font-normal uppercase leading-none tracking-[-0.02em]">{s.t}</h2>
              <p className="mt-4 max-w-[36ch] text-[14.5px] leading-relaxed text-[#111]/75">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The real rail, to try right here */}
      <div id="try" className="scroll-mt-20">
        <Rail products={range} settings={home.rail} kinds={{ order: kv.order, names: Object.fromEntries(kv.all.map((k) => [k, kv.name(k)])) }} />
      </div>

      <section className="container-ep flex flex-col items-start gap-4 py-16 md:flex-row md:items-center md:justify-between md:py-24">
        <p className="font-[family-name:var(--font-didone)] text-[clamp(1.8rem,5vw,3rem)] uppercase leading-none tracking-[-0.02em]">
          That&apos;s <em className="italic text-[#111]/60">all.</em>
        </p>
        <Link href="/shop" className="inline-flex h-12 items-center rounded-full bg-[#111] px-7 text-[13px] font-semibold uppercase tracking-[0.14em] text-white">
          See everything
        </Link>
      </section>
    </div>
  );
}
