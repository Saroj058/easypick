"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon, InstagramIcon, Mail01Icon } from "@hugeicons/core-free-icons";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// His story, a paragraph at a time; the arrows step through it (from his own note, owner 28 Oct 2026).
const STORY = [
  "I'm Saroj Devkota. Easypick started with a simple question: why can't shopping for clothes be easier? Buying clothes should be about finding your style and discovering something you love, not bargaining and wondering whether you are paying the right amount.",
  "So I built Easypick: a clothing store built around simplicity, fair pricing and freedom of choice. Every product has a clear, fixed price. Walk in, explore at your own pace, choose what you love, scan your items, pay by yourself and leave whenever you're ready.",
  "My goal is to combine fashion and technology to make shopping feel modern, effortless and personal. No unnecessary waiting, no confusing prices, no pressure to buy. Just good clothes, transparent pricing and the freedom to shop your way.",
  "Easypick is more than a clothing store. I believe your time is valuable, your style is personal, and buying clothes should never feel like a negotiation. This is the beginning of a new way to shop.",
];
// His own links (owner, 28 Oct 2026).
const LINKS = [
  { name: "Instagram", href: "https://www.instagram.com/__saroj_058__/", icon: InstagramIcon, label: "Saroj on Instagram" },
  { name: "Website", href: "https://www.saroj-devkota.com.np", icon: Globe02Icon, label: "Saroj's website, saroj-devkota.com.np" },
  { name: "Email", href: "mailto:saroj.devkota058@gmail.com", icon: Mail01Icon, label: "Email Saroj, saroj.devkota058@gmail.com" },
];
// The side menu, as in his reference: bottom to top, the founder page marked.
const SIDE = [
  { href: "/about", label: "about" },
  { href: "/about/founder", label: "founder" },
  { href: "/visit", label: "visit" },
  { href: "/shop", label: "shop" },
];

/** The founder card: the logo, the side menu, his portrait, his name, his story one paragraph at a time, his signature. */
export function FounderCard() {
  const [i, setI] = useState(0);
  const go = (d: number) => setI((n) => (n + d + STORY.length) % STORY.length);
  return (
    <div className="fc-card">
      <Image src="/brand/logo-white.png" alt="Easypick" width={611} height={161} className="fc-logo" priority />

      <nav className="fc-side" aria-label="About Easypick">
        {SIDE.map((s) => (
          <Link key={s.href} href={s.href} aria-current={s.href === "/about/founder" ? "page" : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>

      <div className="fc-photo">
        <Image src="/founder/saroj-color.webp" alt="Saroj Devkota, founder of Easypick" fill priority sizes="(min-width: 900px) 640px, 100vw" className="fc-img" />
      </div>

      <div className="fc-info">
        <span className="fc-accent" aria-hidden />
        <h1 className="fc-name">Saroj Devkota</h1>
        <p className="fc-role">Founder / Easypick</p>
        <p className="fc-text" aria-live="polite">
          {STORY[i]}
        </p>
        <p className="fc-count" aria-hidden>
          {String(i + 1).padStart(2, "0")} / {String(STORY.length).padStart(2, "0")}
        </p>
        <Image src="/founder/signature.png" alt="Saroj Devkota's signature" width={600} height={307} className="fc-sig" />
        <ul className="fc-social">
          {LINKS.map((s) => (
            <li key={s.name}>
              <a href={s.href} target="_blank" rel="noopener" aria-label={s.label}>
                <HugeiconsIcon icon={s.icon} className="h-[18px] w-[18px]" />
              </a>
            </li>
          ))}
          <li className="fc-web">
            <a href="https://www.saroj-devkota.com.np" target="_blank" rel="noopener">
              saroj-devkota.com.np
            </a>
          </li>
        </ul>
      </div>

      <div className="fc-arrows">
        <button type="button" onClick={() => go(1)} aria-label="Next part of his story">
          <ArrowRight aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <button type="button" onClick={() => go(-1)} aria-label="Previous part of his story">
          <ArrowLeft aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
