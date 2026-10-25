"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

import { ProductImage } from "@/components/product-image";
import type { TileData } from "@/components/vault/vault-tile";
import { MaskLines } from "./reveal";
import { L, two } from "./tokens";

// The Vault, section 4 (owner, 25 Oct 2026): the featured pieces in one pinned horizontal gallery.
// On a desktop with a mouse, scrolling down slides the row sideways while the stage stays put;
// on touch, or with less motion asked for, it is a plain row you swipe, with the same cards.

const DESK = "(hover: hover) and (pointer: fine) and (min-width: 1024px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DESK);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True on a desktop with a fine pointer. The server (and first paint) gets the swipe row. */
function useDesk() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(DESK).matches, () => false);
}

/** Featured pieces: pinned and scroll-driven on desktop, a native swipe row elsewhere. Needs two or more. */
export function VaultGallery({ pieces, title }: { pieces: TileData[]; title: [string, string] }) {
  const desk = useDesk();
  const still = useReducedMotion();
  if (pieces.length < 2) return null;
  return desk && !still ? <Pinned pieces={pieces} title={title} /> : <Row pieces={pieces} title={title} />;
}

/** One piece: the picture on a raised panel, then its number, brand, model and price. */
function Card({ t, i, sizes, drift, onFocus }: { t: TileData; i: number; sizes: string; drift?: MotionValue<string>; onFocus?: () => void }) {
  return (
    <Link
      href={`/product/${t.slug}`}
      aria-label={`${t.name}, ${t.sold ? "sold" : t.priceText}`}
      onFocus={onFocus}
      className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df]"
    >
      <div className={`relative aspect-[4/5] overflow-hidden rounded-[2px] ${L.raised}`}>
        {/* A slight drift inside the frame as the row moves (under 8%) */}
        <motion.div className="absolute inset-0 scale-[1.1]" style={drift ? { x: drift } : undefined}>
          <ProductImage image={t.image} category={t.category} colourHex={t.hex} decorative sizes={sizes} ground={L.raised} className={`h-full w-full ${t.sold ? "opacity-60" : ""}`} />
        </motion.div>
      </div>
      <div className={`mt-5 flex items-baseline justify-between gap-4 border-t pt-4 ${L.hair}`}>
        <span className={`${L.label} ${L.dim} tabular-nums`}>No. {two(i + 1)}</span>
        <span className={`${L.label} ${L.dim} truncate`}>{t.brand}</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <span className={`${L.serif} ${L.ivory} min-w-0 text-[26px] leading-[0.95] md:text-[32px]`}>
          <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]">{t.model}</span>
        </span>
        <span className={`shrink-0 text-[15px] tabular-nums ${t.sold ? L.dim : L.ivory}`}>{t.sold ? "Sold" : t.priceText}</span>
      </div>
    </Link>
  );
}

/** The hairline that fills and the "01 / 05" count under the row. */
function Progress({ progress, n }: { progress: MotionValue<number>; n: number }) {
  const at = useTransform(progress, (v) => `${two(Math.min(n, Math.max(1, Math.round(v * (n - 1)) + 1)))} / ${two(n)}`);
  return (
    <div className="flex items-center gap-6" aria-hidden>
      <div className="relative h-px flex-1 bg-[#ede8df]/[0.12]">
        <motion.div className="absolute inset-0 origin-left bg-[#ede8df]" style={{ scaleX: progress }} />
      </div>
      <motion.span className={`${L.label} ${L.dim} tabular-nums`}>{at}</motion.span>
    </div>
  );
}

function Title({ title }: { title: [string, string] }) {
  return <MaskLines lines={title} className={`${L.serif} ${L.ivory} text-[44px] leading-[0.92] md:text-[64px] lg:text-[72px]`} />;
}

/** Desktop: a tall section whose sticky stage slides the row sideways as you scroll down. */
function Pinned({ pieces, title }: { pieces: TileData[]; title: [string, string] }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  // How far the row must travel so the last piece ends flush with the page's edge.
  const dist = useMotionValue(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const x = useTransform(() => -scrollYProgress.get() * dist.get());
  const drift = useTransform(scrollYProgress, [0, 1], ["4%", "-4%"]);

  useEffect(() => {
    const s = stage.current;
    const t = track.current;
    const sec = section.current;
    if (!s || !t || !sec) return;
    const measure = () => {
      const d = Math.max(0, t.scrollWidth - s.clientWidth);
      dist.set(d);
      // One pixel down moves the row one pixel across.
      sec.style.height = `calc(100svh + ${d}px)`;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(s);
    ro.observe(t);
    return () => ro.disconnect();
  }, [dist]);

  // Tabbing to a piece off the stage scrolls the page to it, instead of the stage jumping sideways.
  const reach = (i: number) => {
    const s = stage.current;
    const sec = section.current;
    const card = cards.current[i];
    if (!s || !sec || !card) return;
    s.scrollLeft = 0;
    const d = dist.get();
    if (!d) return;
    const want = Math.min(d, Math.max(0, card.offsetLeft + card.offsetWidth / 2 - s.clientWidth / 2));
    const top = sec.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + want, behavior: "auto" });
  };

  return (
    // Height starts from the piece count, then is measured so the travel is exact.
    <section ref={section} className="relative overflow-x-clip" style={{ height: `${100 + pieces.length * 45}svh` }}>
      <div ref={stage} className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <motion.div ref={track} className="flex w-max items-end gap-[4vw] px-10" style={{ x }}>
          <div className="w-[26vw] max-w-[420px] shrink-0 self-center pr-[2vw]">
            <p className={`${L.label} ${L.dim} mb-8`}>Featured</p>
            <Title title={title} />
          </div>
          {pieces.map((t, i) => (
            <div key={t.id} ref={(el) => { cards.current[i] = el; }} className="shrink-0" style={{ width: "min(34vw, calc((100svh - 260px) * 0.8))" }}>
              <Card t={t} i={i} sizes="34vw" drift={drift} onFocus={() => reach(i)} />
            </div>
          ))}
        </motion.div>
        <div className="mx-auto mt-10 w-full max-w-[1360px] px-10">
          <Progress progress={scrollYProgress} n={pieces.length} />
        </div>
      </div>
    </section>
  );
}

/** Touch or less motion: a native row that snaps piece to piece. */
function Row({ pieces, title }: { pieces: TileData[]; title: [string, string] }) {
  const row = useRef<HTMLDivElement>(null);
  const { scrollXProgress } = useScroll({ container: row });
  return (
    <section className={`${L.section} overflow-x-clip`}>
      <div className={L.wrap}>
        <p className={`${L.label} ${L.dim} mb-6`}>Featured</p>
        <Title title={title} />
      </div>
      <div ref={row} className="mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-2 [scrollbar-width:none] md:mt-16 md:gap-6 md:scroll-px-10 md:px-10 [&::-webkit-scrollbar]:hidden">
        {pieces.map((t, i) => (
          <div key={t.id} className="w-[78vw] max-w-[440px] shrink-0 snap-start">
            <Card t={t} i={i} sizes="(min-width: 768px) 440px, 78vw" />
          </div>
        ))}
      </div>
      <div className={`${L.wrap} mt-8`}>
        <Progress progress={scrollXProgress} n={pieces.length} />
      </div>
    </section>
  );
}
