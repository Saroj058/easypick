import type { Metadata } from "next";
import { Oranienbaum } from "next/font/google";
import Image from "next/image";

import { siteSetting } from "@/lib/settings/site";

import "./founder.css";

// The tall, condensed serif of the owner's reference (28 Oct 2026), for the title and the monogram.
const display = Oranienbaum({ subsets: ["latin"], weight: "400", variable: "--font-founder", display: "swap" });

export const metadata: Metadata = {
  title: "About the founder",
  description: "Saroj Devkota on why he started Easypick: clear fixed prices, no bargaining, and the freedom to shop your way.",
  alternates: { canonical: "/about/founder" },
};

/** "@handle" from the store's Instagram link (Admin → Site settings), when there is one. */
function handle(url: string) {
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  return m ? `@${m[1]}` : null;
}

/**
 * The founder's page (owner, 28 Oct 2026), after his reference: a dark magazine page. A spaced line across the top,
 * "A LITTLE ABOUT MYSELF" in a tall condensed serif beside his portrait, the Easypick monogram with a rule and small
 * lines, his signature in white, a dotted line of words with one in bold, his story at the foot with the store's
 * handle. It is one tall sheet, like a printed page; on a phone the sheet reads top to bottom.
 */
export default async function FounderPage() {
  const ig = handle((await siteSetting.get()).social.instagram);
  return (
    <article className={`fd ${display.variable}`}>
      <div className="fd-paper">
        <p className="fd-top">The story behind Easypick, a new way to shop for clothes in Kathmandu</p>

        <div className="fd-photo">
          <Image src="/founder/saroj.webp" alt="Saroj Devkota, founder of Easypick" fill priority sizes="(min-width: 820px) 560px, 100vw" className="object-cover object-top" />
        </div>

        <h1 className="fd-title">
          A little
          <br />
          about
          <br />
          myself
        </h1>

        {/* The monogram, the rule and the small lines */}
        <div className="fd-mark">
          <span className="fd-rule" aria-hidden />
          <div className="fd-mono" aria-hidden>
            <span>E</span>
            <span>P</span>
          </div>
          <p className="fd-small">
            Easypick
            <br />
            Men&apos;s clothing store
            <br />
            Fixed prices, no bargaining
            <br />
            Self-checkout
          </p>
          <p className="fd-place">
            Easypick Kathmandu
            <span>Clothing · Kathmandu, Nepal</span>
          </p>
        </div>

        <div className="fd-sign">
          <Image src="/founder/signature.png" alt="Saroj Devkota's signature" width={600} height={307} className="fd-sig" />
          <p className="fd-name">Saroj Devkota · Founder</p>
          <p className="fd-dots">Fashion • fixed prices • self-checkout • quality • style</p>
          <p className="fd-bold">Pick it. Pay it. Wear it.</p>
        </div>

        {/* His story */}
        <div className="fd-text">
          <p>
            I&apos;m Saroj Devkota, and Easypick started with a simple question: why can&apos;t shopping for clothes be easier? Buying clothes should
            be about finding your style and discovering something you love, not bargaining and wondering whether you are paying the right amount.
          </p>
          <p>
            So I built Easypick: a clothing store where every product has a clear, fixed price. You can walk in, explore at your own pace, choose
            what you love, scan your items, pay by yourself, and leave whenever you&apos;re ready. Your time is valuable, your style is personal, and
            buying clothes should never feel like a negotiation.
          </p>
          <p lang="ne" className="fd-ne">
            न बार्गेनिङ, न झन्झट — बस आफ्नो स्टाइल, आफ्नै रोजाइ।
          </p>
        </div>
        <p className="fd-handle">{ig ?? "Easypick · Kathmandu"}</p>
      </div>
    </article>
  );
}
