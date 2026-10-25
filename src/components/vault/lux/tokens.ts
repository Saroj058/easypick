import type { CSSProperties } from "react";

import type { Theme } from "@/components/vault/look";

// The Vault, luxury (owner, 25 Oct 2026: "revamp it full page like a luxury website"). One dark
// ground, warm ivory text, hairlines and one quiet brass accent; a serif for display, Inter for
// reading, mono for numbers and labels. A brand's page swaps the ground for that brand's own dark
// colour (its "slate" from Admin → The Vault), so the brand worlds still show. Every pair here
// keeps ivory text at WCAG AA or better on any of those grounds.

/** CSS variables for the page wrapper. With a brand theme, the ground is its slate. */
export function luxVars(brand?: Theme | null): CSSProperties {
  return {
    "--lx-ground": brand?.slate ?? "#0e0d0c",
    "--lx-raised": brand ? `color-mix(in srgb, ${brand.slate} 82%, white 6%)` : "#171614",
    "--lx-accent-tint": brand?.tile ?? "#b08d57",
  } as CSSProperties;
}

/** Class names. Use these, not raw colours, so every section matches. */
export const L = {
  ground: "bg-[var(--lx-ground)]",
  raised: "bg-[var(--lx-raised)]",
  /** Main text. */
  ivory: "text-[#ede8df]",
  /** Secondary text (about 11:1 on the black ground, still AA on the lightest brand ground). */
  dim: "text-[#ede8df]/80",
  /** Hairline borders. */
  hair: "border-[#ede8df]/[0.12]",
  /** The one accent: verified marks and the main call to action only. */
  brass: "text-[#c9a46a]",
  brassBg: "bg-[#c9a46a]",
  /** Small caps labels. */
  label: "font-mono text-[10.5px] uppercase tracking-[0.22em]",
  /** Display serif, sentence case. */
  serif: "font-serif font-normal tracking-[-0.02em]",
  /** Section rhythm. */
  section: "py-[72px] md:py-[140px]",
  /** The page's width. */
  wrap: "mx-auto w-full max-w-[1360px] px-4 md:px-10",
} as const;

/** Expo-out: the default for every reveal. */
export const EASE = [0.16, 1, 0.3, 1] as const;
/** Between two states. */
export const EASE_IO = [0.65, 0, 0.35, 1] as const;

export const two = (n: number) => String(n).padStart(2, "0");
