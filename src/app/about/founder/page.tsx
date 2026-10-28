import type { Metadata } from "next";
import { Montserrat } from "next/font/google";

import { FounderCard } from "./founder-card";
import "./founder.css";

// The clean geometric sans of the owner's reference (28 Oct 2026: "make the founder page exactly like this").
const sans = Montserrat({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-founder", display: "swap" });

export const metadata: Metadata = {
  title: "About the founder",
  description: "Saroj Devkota, founder of Easypick: clear fixed prices, no bargaining, and the freedom to shop your way.",
  alternates: { canonical: "/about/founder" },
};

/**
 * The founder's page, after the owner's reference: one dark card on a dark, blurred backdrop. The Easypick logo, a
 * side menu written up the left edge, his portrait in a light panel that hangs below the card, and on the right a
 * short lime line, his name, "Founder / Easypick", his story a paragraph at a time (the square arrows step through
 * it), his signature, and his Instagram and website.
 */
export default function FounderPage() {
  return (
    <article className={`fc ${sans.variable}`}>
      <FounderCard />
    </article>
  );
}
