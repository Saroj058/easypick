import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check, Clock, ScanLine, Shirt, Smartphone, Tag } from "lucide-react";

export const metadata: Metadata = {
  title: "About the founder",
  description: "Saroj Devkota on why he started Easypick: clear fixed prices, no bargaining, and the freedom to shop your way.",
  alternates: { canonical: "/about/founder" },
};

// What he built, in his own words (owner, 28 Oct 2026).
const BUILT = [
  { icon: Tag, title: "Clear, fixed prices", line: "Every product has a clear, fixed price, so you never have to bargain or feel uncomfortable asking for a discount." },
  { icon: Clock, title: "Shop at your own pace", line: "Walk in, explore the collection at your own pace, and choose what you love. No pressure to buy." },
  { icon: ScanLine, title: "Scan it, pay it yourself", line: "Scan your items, pay by yourself, and leave whenever you're ready. No unnecessary waiting." },
  { icon: Smartphone, title: "Fashion meets technology", line: "A shopping experience that feels modern, effortless and personal." },
];
const PROMISE = ["No unnecessary waiting", "No confusing prices", "No pressure to buy", "Good clothes, transparent pricing"];
const STRIP = [
  { icon: Tag, label: "Fixed prices" },
  { icon: ScanLine, label: "Self-checkout" },
  { icon: Shirt, label: "Your style" },
];

/**
 * The founder's page (owner, 28 Oct 2026): his note laid out like a newspaper profile, after his reference. A
 * masthead, a big serif headline in his voice, his name, the Nepali line he opens with, what he built, his words as a
 * pull quote with his signature, his mission and promise, then the whole note. Black and white.
 * The photo is a stand-in until he sends a portrait: replace public/founder/photo.webp.
 */
export default function FounderPage() {
  return (
    <article className="bg-paper pb-16 pt-6 md:pb-24 md:pt-10">
      <div className="container-ep max-w-[1180px]">
        {/* The masthead */}
        <header className="flex items-end justify-between gap-4 border-b-2 border-ink pb-2">
          <p className="whitespace-nowrap font-didone text-[16px] font-bold uppercase tracking-[0.04em] sm:text-[19px] md:text-[24px]">The Easypick Journal</p>
          <p className="whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.12em] text-steel-dark md:text-[11px]">
            <span className="hidden sm:inline">Oct 2026 &nbsp;|&nbsp; </span>Kathmandu
          </p>
        </header>

        <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:gap-12">
          <div className="min-w-0">
            <h1 className="font-didone text-[clamp(2.5rem,1.1rem+3.4vw,4.2rem)] font-bold leading-[1.06] tracking-[-0.015em]">
              I Fixed the Price.
              <br />No Bargaining.
              <br />I Built Easypick.
            </h1>

            <div className="mt-7">
              <p className="font-didone text-[28px] font-bold leading-tight md:text-[32px]">Saroj Devkota</p>
              <p className="mt-1 font-didone text-[19px] leading-snug md:text-[21px]">
                Founder, <b>Easypick</b> Kathmandu
              </p>
            </div>
            <hr className="mt-6 max-w-md border-ink/25" />

            <p lang="ne" className="mt-6 max-w-[34ch] font-nepali text-[19px] font-semibold leading-relaxed">
              लुगा किन्न मोलमोलाइ किन? मन परेको छान्नुहोस्, मूल्य स्पष्ट छ।
            </p>
            <p className="mt-4 max-w-[52ch] font-didone text-[17px] leading-[1.6] md:text-[18px]">
              Easypick started with a simple question: why can&apos;t shopping for clothes be easier? Buying clothes should be about finding your
              style, discovering something you love, and enjoying the experience. I felt there had to be a better way.
            </p>

            {/* What he built */}
            <section aria-labelledby="built-title" className="mt-10 border-l-2 border-ink pl-5 md:pl-6">
              <h2 id="built-title" className="text-[13px] font-bold uppercase tracking-[0.08em]">
                What I built
              </h2>
              <ul className="mt-4 space-y-5">
                {BUILT.map(({ icon: Icon, title, line }) => (
                  <li key={title} className="flex gap-4">
                    <Icon aria-hidden strokeWidth={1.5} className="mt-0.5 h-7 w-7 shrink-0" />
                    <div>
                      <p className="text-[13px] font-bold uppercase tracking-[0.05em]">{title}</p>
                      <p className="mt-1 max-w-[46ch] text-[14px] leading-relaxed text-steel-dark">{line}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* His words, signed */}
            <figure className="mt-10 border-l-2 border-ink pl-5 md:pl-6">
              <span aria-hidden className="block font-didone text-[56px] leading-[0.6]">
                &ldquo;
              </span>
              <blockquote className="mt-1 max-w-[30ch] font-didone text-[22px] italic leading-snug md:text-[25px]">
                Your time is valuable, your style is personal, and buying clothes should never feel like a negotiation.
              </blockquote>
              <figcaption className="mt-4 flex items-end gap-5">
                <div className="text-[14px] leading-snug">
                  <p className="font-semibold">– Saroj Devkota</p>
                  <p className="text-steel-dark">Founder, Easypick</p>
                </div>
                <Image src="/founder/signature.png" alt="Saroj Devkota's signature" width={600} height={307} className="h-14 w-auto md:h-16" />
              </figcaption>
            </figure>
          </div>

          {/* The picture, then his mission and promise */}
          <div className="min-w-0 lg:pt-2">
            <div className="relative aspect-[4/5] overflow-hidden bg-mist">
              <Image src="/founder/photo.webp" alt="Folded Easypick hoodie and tee, close up on the cotton" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" priority />
            </div>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-1">
              <section aria-labelledby="mission-title" className="border-l-2 border-ink pl-5">
                <h2 id="mission-title" className="text-[13px] font-bold uppercase tracking-[0.08em]">
                  My mission
                </h2>
                <p className="mt-3 max-w-[44ch] font-didone text-[17px] leading-relaxed">
                  To combine fashion and technology and make everyday shopping simpler and better for everyone.
                </p>
              </section>
              <section aria-labelledby="promise-title" className="border-l-2 border-ink pl-5">
                <h2 id="promise-title" className="text-[13px] font-bold uppercase tracking-[0.08em]">
                  My promise
                </h2>
                <ul className="mt-3 space-y-2">
                  {PROMISE.map((p) => (
                    <li key={p} className="flex items-center gap-3 font-didone text-[16px]">
                      <Check aria-hidden strokeWidth={1.75} className="h-4 w-4 shrink-0 rounded-full border border-ink p-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>

        {/* About Easypick */}
        <section aria-labelledby="about-ep" className="mt-14 grid gap-6 rounded-[4px] bg-mist/70 p-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center md:p-8">
          <div>
            <h2 id="about-ep" className="text-[14px] font-bold uppercase tracking-[0.06em]">
              About Easypick
            </h2>
            <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-steel-dark">
              Easypick is more than a clothing store. It is a new way to shop, where convenience meets confidence and every customer knows exactly
              what they are paying for.
            </p>
          </div>
          <ul className="grid grid-cols-3 divide-x divide-ink/20">
            {STRIP.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col items-center gap-2 px-2 text-center font-didone text-[15px] sm:flex-row sm:justify-center sm:text-left">
                <Icon aria-hidden strokeWidth={1.5} className="h-7 w-7 shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* The whole note */}
        <section aria-labelledby="note-title" className="mx-auto mt-16 max-w-[68ch]">
          <h2 id="note-title" className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-steel-dark">
            The founder&apos;s note
          </h2>
          <div className="mt-6 space-y-5 font-didone text-[18px] leading-[1.7]">
            <p>
              I&apos;m Saroj Devkota, and Easypick started with a simple question: why can&apos;t shopping for clothes be easier? Buying clothes should
              be about finding your style, discovering something you love, and enjoying the experience. But sometimes, it means asking for prices,
              bargaining for discounts, and wondering whether you are paying the right amount. I felt there had to be a better way.
            </p>
            <p>
              That&apos;s when I came up with the idea of Easypick: a clothing store built around simplicity, fair pricing, and freedom of choice. I
              imagined a place where every product has a clear, fixed price, so you never have to bargain or feel uncomfortable asking for a
              discount. You can walk in, explore the collection at your own pace, choose what you love, scan your items, pay by yourself, and leave
              whenever you&apos;re ready.
            </p>
            <p>
              My goal is to combine fashion and technology to create a shopping experience that feels modern, effortless, and personal. No
              unnecessary waiting, no confusing prices, and no pressure to buy. Just good clothes, transparent pricing, and the freedom to shop your
              way.
            </p>
            <p>
              Easypick is more than a clothing store. It is my vision of making everyday shopping simpler and better for everyone. I believe your time
              is valuable, your style is personal, and buying clothes should never feel like a negotiation. This is the beginning of a new way to
              shop, one where convenience meets confidence and every customer knows exactly what they are paying for.
            </p>
          </div>
          <div className="mt-10 border-t border-ink/20 pt-8 text-center">
            <p lang="ne" className="font-nepali text-[20px] font-semibold leading-relaxed">
              न बार्गेनिङ, न झन्झट — बस आफ्नो स्टाइल, आफ्नै रोजाइ।
            </p>
            <p className="mt-3 font-didone text-[22px] font-bold">Easypick: Pick it. Pay it. Wear it.</p>
            <Image src="/founder/signature.png" alt="" width={600} height={307} className="mx-auto mt-5 h-16 w-auto" />
          </div>
          <p className="mt-10 text-center text-[14px]">
            <Link href="/about" className="underline underline-offset-4">
              Back to our story
            </Link>
          </p>
        </section>
      </div>
    </article>
  );
}
