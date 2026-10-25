"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import type { BrandWorld } from "@/components/vault/look";
import type { TileData } from "@/components/vault/vault-tile";
import { L } from "./tokens";
import { ClipReveal, FadeUp, MaskLines } from "./reveal";

// The opening of a brand's page (/vault?brand=Nike), in place of the tunnel (owner, 25 Oct 2026:
// each brand its own world). The ground is the brand's own dark colour, set by the page. Small text
// sits at 80% ivory, not 65%, so it stays AA on the lighter brand grounds too.

const quiet = "text-[#ede8df]/80";
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df]";
const draw = "bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-500 group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]";

/** The brand's name, where it began, its line and story, and its lead piece standing beside them. */
export function BrandOpening({ name, world, count, lead }: { name: string; world: BrandWorld | null; count: number; lead?: TileData }) {
  const still = useReducedMotion();
  return (
    <section className={`${L.ground} ${L.ivory} relative flex min-h-[88svh] flex-col`}>
      <div className={`${L.wrap} flex flex-1 flex-col pb-[72px] pt-8 md:pb-[120px] md:pt-10`}>
        <Link href="/vault" className={`group self-start ${L.label} ${quiet} hover:text-[#ede8df] ${focus}`}>
          <span className={draw}>← The Vault</span>
        </Link>

        <div className="mt-14 grid flex-1 grid-cols-12 items-end gap-x-6 gap-y-14 md:mt-20">
          <div className="col-span-12 md:col-span-7">
            {world?.origin ? (
              <FadeUp>
                <p className={`${L.label} ${quiet}`}>[ {world.origin} ]</p>
              </FadeUp>
            ) : null}

            <MaskLines as="h1" lines={[name]} delay={0.1} className={`${L.serif} mt-6 break-words text-[clamp(4rem,12vw,11rem)] leading-[0.9]`} />

            {world ? (
              <MaskLines
                as="p"
                delay={0.25}
                lines={[world.line[0], <em key="b" className="italic text-[#ede8df]/70">{world.line[1]}</em>]}
                className={`${L.serif} mt-6 text-[clamp(2rem,4.5vw,4rem)] leading-[0.95]`}
              />
            ) : null}

            {world?.story ? (
              <FadeUp delay={0.4}>
                <p className={`mt-10 max-w-[46ch] text-[15px] leading-[1.5] md:text-[17px] ${quiet}`}>{world.story}</p>
              </FadeUp>
            ) : null}

            <FadeUp delay={0.5}>
              <p className={`mt-10 ${L.label} ${quiet} tabular-nums`}>
                {count} {count === 1 ? "piece" : "pieces"} · one of each
              </p>
            </FadeUp>
          </div>

          {lead ? (
            <div className="col-span-10 col-start-2 md:col-span-4 md:col-start-9">
              <ClipReveal delay={0.2}>
                <motion.div
                  animate={still ? undefined : { y: [0, -6, 0, 6, 0] }}
                  transition={still ? undefined : { duration: 6, ease: "easeInOut", repeat: Infinity }}
                >
                  <Link href={`/product/${lead.slug}`} aria-label={`${lead.name}, ${lead.sold ? "sold" : lead.priceText}`} className={`group block ${focus}`}>
                    <ProductImage image={lead.image} category={lead.category} colourHex={lead.hex} decorative priority ground={L.raised} sizes="(min-width: 768px) 33vw, 84vw" />
                    <span className={`mt-4 flex items-baseline justify-between gap-4 ${L.label} ${quiet}`} aria-hidden>
                      <span className={`truncate ${draw}`}>{lead.model || lead.name}</span>
                      <span className="shrink-0 tabular-nums">{lead.sold ? "Sold" : lead.priceText}</span>
                    </span>
                  </Link>
                </motion.div>
              </ClipReveal>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
