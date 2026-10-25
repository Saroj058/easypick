"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";

import { formatPrice } from "@/lib/format";
import type { Category, ProductImage as Img } from "@/lib/types";
import { ProductImage } from "./product-image";
import { EASE, L, luxVars, two } from "./vault/lux/tokens";
import { ClipReveal, FadeUp, MaskLines } from "./vault/lux/reveal";

// The first screen of a Vault piece's page, in the Vault's own dark world (owner, 25 Oct 2026:
// "revamp it full page like a luxury website"). The name set in the serif with its price, a line
// about it and the buying panel on an ivory card; the piece large beside it, opening from a clip
// and drifting a little as the page scrolls; under both, a hairline row of the brand's other
// pieces. No brand logos (blueprint): the brand is named in mono. Nothing moves for people who ask
// for less motion.

export interface VaultSibling {
  slug: string;
  name: string;
  image: Img;
  category: Category;
  hex: string;
}

/** The focus ring every link here uses. */
const RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df]";

export function VaultStage({
  slug,
  name,
  brand,
  label,
  price,
  was,
  description,
  image,
  category,
  hex,
  siblings,
  children,
}: {
  slug: string;
  name: string;
  /** The brand: named over the picture, and it names the row of its other pieces. */
  brand: string;
  /** The small line over the name: brand, Original, the edition number. */
  label: React.ReactNode;
  price: number;
  was?: number;
  description: string;
  image: Img;
  category: Category;
  hex: string;
  /** The brand's pieces in the Vault, this one among them, in order. */
  siblings: VaultSibling[];
  /** The buying panel. */
  children: React.ReactNode;
}) {
  const still = useReducedMotion();
  const at = Math.max(0, siblings.findIndex((s) => s.slug === slug));
  const n = siblings.length;
  const prev = n > 1 ? siblings[(at - 1 + n) % n] : null;
  const next = n > 1 ? siblings[(at + 1) % n] : null;

  // A gentle drift of the picture inside its frame while the page scrolls: 6% in all, under the 8% cap.
  const frame = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: frame, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], ["-3%", "3%"]);

  return (
    <section style={luxVars()} className={`relative border-b ${L.hair} ${L.ground} ${L.ivory}`}>
      <div className={`${L.wrap} grid gap-10 pb-[72px] pt-6 md:pt-10 lg:min-h-[calc(100svh-88px)] lg:grid-cols-12 lg:items-center lg:gap-x-10 lg:pb-[96px] lg:pt-14`}>
        {/* The piece: first on a phone, on the right on a desktop */}
        <div className="w-full lg:order-2 lg:col-span-7 lg:col-start-6 lg:mx-auto lg:max-w-[calc((100svh-200px)*0.8)]">
          <ClipReveal key={`piece-${slug}`} delay={0.05} className="rounded-[2px]">
            <div ref={frame} className="relative aspect-[4/5] overflow-hidden bg-[var(--lx-raised)]">
              <motion.div style={still ? undefined : { y: drift, scale: 1.08 }} className="h-full w-full">
                <ProductImage image={image} category={category} colourHex={hex} priority ground="bg-[var(--lx-raised)]" sizes="(min-width: 1024px) 52vw, 100vw" className="h-full" />
              </motion.div>
            </div>
          </ClipReveal>
          {/* The brand named in mono (no logos), and where this piece sits among its brand's */}
          <div className={`mt-3 flex items-center justify-between ${L.label} ${L.dim}`}>
            <span>{brand}</span>
            {n > 1 && (
              <span className="tabular-nums">
                {two(at + 1)} / {two(n)}
              </span>
            )}
          </div>
        </div>

        {/* The words and the buying panel */}
        <div className="min-w-0 lg:order-1 lg:col-span-5 lg:col-start-1">
          {/* The page passes dark-on-light chips; here they take the ivory */}
          <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${L.label} ${L.dim} [&_span]:border-[#ede8df]/40 [&_span]:text-[#ede8df]`}>{label}</p>
          <MaskLines
            key={`name-${slug}`}
            as="h1"
            lines={[name]}
            delay={0.15}
            className={`mt-5 ${L.serif} text-[clamp(2.75rem,1.9rem+3.4vw,5.25rem)] leading-[0.92]`}
          />
          <FadeUp key={`words-${slug}`} delay={0.3}>
            <p className="mt-6 font-mono text-[17px] tabular-nums">
              {formatPrice(price)}
              {was && <s className={`ml-3 text-[13px] ${L.dim}`}>{formatPrice(was)}</s>}
            </p>
            <p className={`mt-4 max-w-[52ch] text-[15px] leading-[1.5] ${L.dim}`}>{description}</p>
            {/* The one brass mark on this screen */}
            <p className={`mt-6 flex items-center gap-2.5 ${L.label} ${L.brass}`}>
              <span aria-hidden className="h-px w-6 bg-current" />
              Checked by hand
            </p>
            {/* The buying panel is drawn for a light page, so it sits on its own ivory card */}
            <div className="mt-8 max-w-[480px] rounded-[2px] bg-[#f6f3ed] p-5 text-ink md:p-6">{children}</div>
          </FadeUp>
        </div>
      </div>

      {/* The brand's other pieces */}
      {n > 1 && (
        <nav aria-label={`More from ${brand}`} className={`border-t ${L.hair}`}>
          <FadeUp className={`${L.wrap} py-10 md:py-14`}>
            <div className="flex items-center justify-between gap-4">
              <p className={`${L.label} ${L.dim}`}>More from {brand}</p>
              <div className={`flex items-center gap-6 ${L.label}`}>
                <Link href={`/product/${prev!.slug}`} aria-label={`Previous: ${prev!.name}`} className={`group flex min-h-11 items-center gap-2 ${RING}`}>
                  <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-0.5">←</span>
                  <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 group-hover:bg-[length:100%_1px]">Prev</span>
                </Link>
                <Link href={`/product/${next!.slug}`} aria-label={`Next: ${next!.name}`} className={`group flex min-h-11 items-center gap-2 ${RING}`}>
                  <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 group-hover:bg-[length:100%_1px]">Next</span>
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                </Link>
              </div>
            </div>
            {/* A native swipe on a phone; it scrolls inside itself, never the page */}
            <ul className="-mx-4 mt-6 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 [scrollbar-width:none]">
              {siblings.map((s, i) => {
                const on = s.slug === slug;
                return (
                  <li key={s.slug} className="w-[38vw] max-w-[180px] shrink-0 snap-start md:w-[160px]">
                    <Link href={`/product/${s.slug}`} aria-current={on ? "page" : undefined} className={`group block ${RING}`}>
                      <div className={`overflow-hidden rounded-[2px] transition-opacity duration-500 ${on ? "" : "opacity-70 group-hover:opacity-100"}`}>
                        <motion.div
                          className="h-full w-full"
                          whileHover={still ? undefined : { scale: 1.03 }}
                          transition={{ duration: 0.8, ease: EASE }}
                        >
                          <ProductImage image={s.image} category={s.category} colourHex={s.hex} decorative ground="bg-[var(--lx-raised)]" sizes="180px" />
                        </motion.div>
                      </div>
                      <span className={`mt-2.5 flex items-baseline gap-2 border-t pt-2.5 text-[13px] leading-snug ${on ? "border-[#ede8df]" : L.hair}`}>
                        <span className={`font-mono text-[10.5px] tabular-nums ${L.dim}`}>{two(i + 1)}</span>
                        <span className={`line-clamp-2 ${on ? L.ivory : L.dim}`}>{s.name}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </FadeUp>
        </nav>
      )}
    </section>
  );
}
