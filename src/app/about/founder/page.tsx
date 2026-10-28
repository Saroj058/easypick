import type { Metadata } from "next";
import { Instrument_Serif, Newsreader } from "next/font/google";
import Image from "next/image";

import { siteSetting } from "@/lib/settings/site";

import "./founder.css";

// A tall, elegant serif for the title and the quote; a serif made for reading for the statement (owner, 28 Oct 2026:
// "make it better, the fonts, the style").
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-founder", display: "swap" });
const text = Newsreader({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], variable: "--font-statement", display: "swap" });

export const metadata: Metadata = {
  title: "A statement from the founder",
  description: "Saroj Devkota on why he started Easypick: clear fixed prices, no bargaining, and the freedom to shop your way.",
  alternates: { canonical: "/about/founder" },
};

/** "@handle" from the store's Instagram link (Admin → Site settings), when there is one. */
function handle(url: string) {
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  return m ? `@${m[1]}` : null;
}

/**
 * The founder's page (owner, 28 Oct 2026): a signed statement on one long dark sheet, like a printed page. On top, the
 * title beside his portrait in colour with the Easypick monogram; then his statement in full, his own words; at the end
 * "Sincerely", his signature, his name and the place and date; along the foot the Nepali line and the store's handle.
 */
export default async function FounderPage() {
  const ig = handle((await siteSetting.get()).social.instagram);
  return (
    <article className={`fd ${display.variable} ${text.variable}`}>
      <div className="fd-paper">
        {/* The top of the sheet */}
        <header className="fd-head">
          <p className="fd-top">A statement from the founder</p>
          <div className="fd-hero">
            <h1 className="fd-title">
              <span>A little</span>
              <span>about</span>
              <em>myself</em>
            </h1>
            <div className="fd-photo">
              <Image src="/founder/saroj-color.webp" alt="Saroj Devkota, founder of Easypick" fill priority sizes="(min-width: 820px) 480px, 90vw" className="object-contain object-bottom" />
            </div>
            <div className="fd-mark">
              <span className="fd-rule" aria-hidden />
              <p className="fd-mono" aria-hidden>
                E<i>P</i>
              </p>
              <p className="fd-small">
                Easypick
                <br />
                Men&apos;s clothing store
                <br />
                Fixed prices, no bargaining
                <br />
                Kathmandu, Nepal
              </p>
            </div>
            <p className="fd-dots">
              Fashion • fixed prices • self-checkout • quality • style
              <b>Pick it. Pay it. Wear it.</b>
            </p>
          </div>
        </header>

        {/* The statement, in his words */}
        <section className="fd-body" aria-label="The statement">
          <p lang="ne" className="fd-ne-open">
            लुगा किन्न मोलमोलाइ किन? मन परेको छान्नुहोस्, मूल्य स्पष्ट छ।
          </p>
          <div className="fd-letter">
            <p>
              <span className="fd-lead">I&apos;m Saroj Devkota,</span> and Easypick started with a simple question: why can&apos;t shopping for clothes be easier? Buying clothes should
              be about finding your style, discovering something you love, and enjoying the experience. But sometimes, it means asking for prices,
              bargaining for discounts, and wondering whether you are paying the right amount. I felt there had to be a better way.
            </p>
            <p>
              That&apos;s when I came up with the idea of Easypick: a clothing store built around simplicity, fair pricing, and freedom of choice. I
              imagined a place where every product has a clear, fixed price, so you never have to bargain or feel uncomfortable asking for a
              discount. You can walk in, explore the collection at your own pace, choose what you love, scan your items, pay by yourself, and leave
              whenever you&apos;re ready.
            </p>
            <blockquote className="fd-quote">Buying clothes should never feel like a negotiation.</blockquote>
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

          {/* The sign-off, with his signature at the end */}
          <footer className="fd-sign">
            <p className="fd-sincerely">Sincerely,</p>
            <Image src="/founder/signature.png" alt="Saroj Devkota's signature" width={600} height={307} className="fd-sig" />
            <p className="fd-name">Saroj Devkota</p>
            <p className="fd-role">Founder, Easypick</p>
            <p className="fd-date">Kathmandu, October 2026</p>
          </footer>
        </section>

        <div className="fd-foot">
          <p lang="ne" className="fd-ne">
            न बार्गेनिङ, न झन्झट — बस आफ्नो स्टाइल, आफ्नै रोजाइ।
          </p>
          <p className="fd-handle">{ig ?? "Easypick · Kathmandu"}</p>
        </div>
      </div>
    </article>
  );
}
