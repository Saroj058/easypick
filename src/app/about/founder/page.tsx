import type { Metadata } from "next";
import Image from "next/image";
import { Check, Clock, ScanLine, Shirt, Smartphone, Tag } from "lucide-react";

export const metadata: Metadata = {
  title: "About the founder",
  description: "Saroj Devkota on why he started Easypick: clear fixed prices, no bargaining, and the freedom to shop your way.",
  alternates: { canonical: "/about/founder" },
};

// What he built, in his own words (owner, 28 Oct 2026).
const BUILT = [
  { icon: Tag, title: "Clear, fixed prices", line: "Every product has a clear, fixed price. You never have to bargain." },
  { icon: Clock, title: "Your own pace", line: "Walk in, explore the collection and choose what you love. No pressure." },
  { icon: ScanLine, title: "Scan it, pay yourself", line: "Scan your items, pay by yourself, leave whenever you're ready." },
  { icon: Smartphone, title: "Fashion meets technology", line: "Shopping that feels modern, effortless and personal." },
];
const PROMISE = ["No unnecessary waiting", "No confusing prices", "No pressure to buy", "Transparent pricing"];
const STRIP = [
  { icon: Tag, label: "Fixed prices" },
  { icon: ScanLine, label: "Self-checkout" },
  { icon: Shirt, label: "Your style" },
];

/**
 * The founder's page (owner, 28 Oct 2026: "make a single page"): his note as one newspaper-style page, after his
 * reference. On a computer it fits one screen under the header: the masthead; on the left the headline in his voice,
 * his name, the Nepali line he opens with, what he built and his words signed; on the right his photo with his mission
 * and promise; along the foot, Easypick in one line. Black and white. On a phone it reads top to bottom.
 * The photo is a stand-in until his portrait is in: replace public/founder/photo.webp.
 */
export default function FounderPage() {
  return (
    <article className="bg-paper">
      <div className="container-ep flex max-w-[1240px] flex-col py-5 lg:min-h-[calc(100svh-88px)] lg:py-[1.5vh]">
        {/* The masthead */}
        <header className="flex items-end justify-between gap-4 border-b-2 border-ink pb-1.5">
          <p className="whitespace-nowrap font-didone text-[16px] font-bold uppercase tracking-[0.04em] sm:text-[19px] lg:text-[22px]">The Easypick Journal</p>
          <p className="whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.12em] text-steel-dark md:text-[11px]">
            <span className="hidden sm:inline">Oct 2026 &nbsp;|&nbsp; </span>Kathmandu
          </p>
        </header>

        <div className="mt-5 grid min-h-0 flex-1 gap-8 lg:mt-[2vh] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-10">
          {/* Left: his words */}
          <div className="flex min-h-0 min-w-0 flex-col">
            <h1 className="font-didone text-[clamp(2.3rem,1rem+3.6vw,3.9rem)] font-bold leading-[1.04] tracking-[-0.015em] lg:text-[min(3.6rem,5.7vh)]">
              I Fixed the Price.
              <br />
              No Bargaining.
              <br />I Built Easypick.
            </h1>

            <div className="mt-[1.6vh] flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="font-didone text-[26px] font-bold leading-tight lg:text-[min(30px,3.6vh)]">Saroj Devkota</p>
              <p className="font-didone text-[17px] leading-snug lg:text-[min(19px,2.3vh)]">
                Founder, <b>Easypick</b> Kathmandu
              </p>
            </div>
            <p lang="ne" className="mt-[1.6vh] border-t border-ink/20 pt-[1.6vh] font-nepali text-[17px] font-semibold leading-snug lg:text-[min(18px,2.2vh)]">
              लुगा किन्न मोलमोलाइ किन? मन परेको छान्नुहोस्, मूल्य स्पष्ट छ।
            </p>
            <p className="mt-[1.2vh] max-w-[60ch] font-didone text-[16px] leading-[1.55] lg:text-[min(16.5px,2vh)]">
              Easypick started with a simple question: why can&apos;t shopping for clothes be easier? Buying clothes should be about finding your
              style, not bargaining for discounts.
            </p>

            {/* What he built */}
            <section aria-labelledby="built-title" className="mt-[1.9vh] border-l-2 border-ink pl-4">
              <h2 id="built-title" className="text-[12px] font-bold uppercase tracking-[0.08em]">
                What I built
              </h2>
              <ul className="mt-[1.2vh] grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                {BUILT.map(({ icon: Icon, title, line }) => (
                  <li key={title} className="flex gap-3 xl:flex-col xl:gap-1.5">
                    <Icon aria-hidden strokeWidth={1.5} className="mt-0.5 h-6 w-6 shrink-0 xl:h-5 xl:w-5" />
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.05em]">{title}</p>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-steel-dark">{line}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* His words, signed */}
            <figure className="mt-[2vh] flex flex-wrap items-end gap-x-6 gap-y-3 border-l-2 border-ink pl-4 xl:flex-nowrap">
              <blockquote className="max-w-[34ch] font-didone xl:max-w-[29ch] text-[20px] italic leading-snug lg:text-[min(21px,2.35vh)]">
                <span aria-hidden className="mr-1 font-bold not-italic">
                  &ldquo;
                </span>
                Your time is valuable, your style is personal, and buying clothes should never feel like a negotiation.
              </blockquote>
              <figcaption className="flex shrink-0 items-end gap-4">
                <div className="text-[13px] leading-snug">
                  <p className="font-semibold">– Saroj Devkota</p>
                  <p className="text-steel-dark">Founder, Easypick</p>
                </div>
                <Image src="/founder/signature.png" alt="Saroj Devkota's signature" width={600} height={307} className="h-12 w-auto lg:h-[min(56px,6.4vh)]" />
              </figcaption>
            </figure>
          </div>

          {/* Right: the photo, his mission and promise over its foot */}
          <div className="relative min-h-[460px] min-w-0 lg:min-h-0">
            <div className="absolute inset-0 overflow-hidden bg-mist">
              <Image src="/founder/photo.webp" alt="Saroj Devkota, founder of Easypick" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover object-top" priority />
            </div>
            <div className="absolute inset-x-3 bottom-3 grid gap-4 bg-paper/95 p-4 backdrop-blur-sm sm:grid-cols-2 lg:inset-x-auto lg:bottom-4 lg:right-4 lg:w-[min(100%-2rem,420px)]">
              <section aria-labelledby="mission-title" className="border-l-2 border-ink pl-3">
                <h2 id="mission-title" className="text-[11.5px] font-bold uppercase tracking-[0.08em]">
                  My mission
                </h2>
                <p className="mt-1.5 font-didone text-[14.5px] leading-snug">To combine fashion and technology and make everyday shopping simpler for everyone.</p>
              </section>
              <section aria-labelledby="promise-title" className="border-l-2 border-ink pl-3">
                <h2 id="promise-title" className="text-[11.5px] font-bold uppercase tracking-[0.08em]">
                  My promise
                </h2>
                <ul className="mt-1.5 space-y-1">
                  {PROMISE.map((p) => (
                    <li key={p} className="flex items-center gap-2 font-didone text-[13.5px]">
                      <Check aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5 shrink-0 rounded-full border border-ink p-px" />
                      {p}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>

        {/* Easypick, in one line */}
        <section aria-labelledby="about-ep" className="mt-5 grid gap-4 rounded-[3px] bg-mist/70 px-5 py-4 lg:mt-[1.6vh] lg:py-2.5 lg:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-8">
          <div>
            <h2 id="about-ep" className="text-[12.5px] font-bold uppercase tracking-[0.06em]">
              About Easypick
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-steel-dark lg:hidden">
              More than a clothing store: a new way to shop, where every customer knows exactly what they are paying for.
            </p>
          </div>
          <ul className="grid grid-cols-3 divide-x divide-ink/20">
            {STRIP.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center justify-center gap-2 px-3 font-didone text-[14px] whitespace-nowrap">
                <Icon aria-hidden strokeWidth={1.5} className="h-5 w-5 shrink-0" />
                {label}
              </li>
            ))}
          </ul>
          <div className="lg:text-right">
            <p lang="ne" className="font-nepali text-[14.5px] font-semibold leading-snug">
              न बार्गेनिङ, न झन्झट — बस आफ्नो स्टाइल, आफ्नै रोजाइ।
            </p>
            <p className="mt-0.5 font-didone text-[15px] font-bold">Easypick: Pick it. Pay it. Wear it.</p>
          </div>
        </section>
      </div>
    </article>
  );
}
