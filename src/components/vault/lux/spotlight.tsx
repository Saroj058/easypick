"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { ProductImage } from "@/components/product-image";
import type { TileData } from "@/components/vault/vault-tile";

import { FadeUp, ClipReveal, MaskLines } from "./reveal";
import { L } from "./tokens";

// The Vault, section 5 (owner, 25 Oct 2026: luxury revamp). One piece, large, with its facts set out
// like a spec sheet on hairlines. The picture drifts a touch as the page scrolls (never with less
// motion asked for); the one way in is a quiet link with a brass underline, not a filled button.

const sizeName = (s: string) => (s === "ONE" ? "One size" : s);

export function LuxSpotlight({ piece }: { piece: TileData }) {
  const still = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // Gentle parallax: 4% each way, covered by a slight oversize so no edge ever shows.
  const y = useTransform(scrollYProgress, [0, 1], still ? ["0%", "0%"] : ["-4%", "4%"]);
  const row = `grid grid-cols-[7.5rem_1fr] gap-4 border-t ${L.hair} py-3.5`;

  return (
    <section ref={ref} aria-label="The piece" className={`${L.ground} ${L.ivory} ${L.section}`}>
      <div className={`${L.wrap} grid grid-cols-1 gap-10 md:grid-cols-12 md:items-center md:gap-10`}>
        {/* The picture */}
        <ClipReveal className={`${L.raised} rounded-[2px] md:col-span-7`}>
          <Link href={`/product/${piece.slug}`} tabIndex={-1} aria-hidden className="block overflow-hidden">
            <motion.div style={{ y, scale: still ? 1 : 1.08 }} className="will-change-transform">
              <ProductImage image={piece.image} category={piece.category} colourHex={piece.hex} decorative ground="bg-transparent" sizes="(min-width: 768px) 58vw, 100vw" />
            </motion.div>
          </Link>
        </ClipReveal>

        {/* The sheet */}
        <div className="md:col-span-5 md:pl-6 lg:pl-12">
          <p className={`${L.label} ${L.dim}`}>[ The piece ]</p>
          <MaskLines
            lines={[
              "When it’s gone,",
              <span key="b">
                it’s <em className="italic">gone.</em>
              </span>,
            ]}
            className={`${L.serif} mt-6 text-[clamp(2.6rem,1.6rem+3.6vw,4.75rem)] leading-[0.92]`}
          />

          <FadeUp delay={0.15}>
            <dl className="mt-10 border-b border-[#ede8df]/[0.12] text-[15px] leading-[1.5]">
              <div className={row}>
                <dt className={`${L.label} ${L.dim} pt-[3px]`}>Brand</dt>
                <dd>{piece.brand}</dd>
              </div>
              <div className={row}>
                <dt className={`${L.label} ${L.dim} pt-[3px]`}>Piece</dt>
                <dd>{piece.model}</dd>
              </div>
              <div className={row}>
                <dt className={`${L.label} ${L.dim} pt-[3px]`}>Colour</dt>
                <dd>{piece.colour}</dd>
              </div>
              {piece.edition && (
                <div className={row}>
                  <dt className={`${L.label} ${L.dim} pt-[3px]`}>Number</dt>
                  <dd className="font-mono text-[13px] tabular-nums tracking-[0.08em]">{piece.edition}</dd>
                </div>
              )}
              {piece.sizes.length > 0 && (
                <div className={row}>
                  <dt className={`${L.label} ${L.dim} pt-[3px]`}>Sizes</dt>
                  <dd>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {piece.sizes.map((s) =>
                        s.left ? (
                          <li key={s.size}>{sizeName(s.size)}</li>
                        ) : (
                          <li key={s.size} className={L.dim}>
                            <s>{sizeName(s.size)}</s>
                            <span className="sr-only"> sold out</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </dd>
                </div>
              )}
              <div className={row}>
                <dt className={`${L.label} ${L.dim} pt-[3px]`}>Price</dt>
                <dd>
                  <span className="tabular-nums">{piece.sold ? "Sold" : piece.priceText}</span>
                  {piece.last && <span className={`mt-1 block ${L.label} ${L.dim}`}>{piece.last}</span>}
                </dd>
              </div>
            </dl>

            <p className={`mt-6 inline-flex items-center gap-2 ${L.label} ${L.brass}`}>
              <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Checked by hand
            </p>

            <div className="mt-10">
              <Link
                href={`/product/${piece.slug}`}
                aria-label={`See the piece: ${piece.name}, ${piece.sold ? "sold" : piece.priceText}`}
                className="group relative inline-block pb-1.5 text-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df]"
              >
                See the piece <span aria-hidden className="inline-block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1 motion-reduce:transition-none">&rarr;</span>
                {/* A hairline always there, the brass line drawing over it on hover or focus */}
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-[#ede8df]/30" />
                <span aria-hidden className={`absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 ${L.brassBg} transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none`} />
              </Link>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
