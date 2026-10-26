"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { AlertSignup } from "@/components/alert-signup";

export interface Chapter {
  /** Two short lines, set large. */
  title: [string, string];
  text: string;
  link?: { href: string; label: string };
  /** The big picture, and a smaller one that drifts faster. */
  image: string;
  small?: string;
  /** A cut-out person standing in front of the words (the Vault). */
  figure?: { src: string; width: number; height: number };
  /** The last chapter: the sign-up instead of a link. */
  signup?: boolean;
}

const wide = () => window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches;
const subscribe = (fn: () => void) => {
  const m = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};

/**
 * After the opening (owner, 26 Oct 2026, after a parallax editorial reference): the store told in
 * numbered chapters (*01 to *06), each a large didone title, black-and-white pictures and one way in.
 * On a computer they slide past sideways as the page scrolls down, pictures and words at different
 * speeds; on a phone, or with less motion asked for, they simply stack.
 */
export function LandingChapters({ chapters }: { chapters: Chapter[] }) {
  const sideways = useSyncExternalStore(subscribe, wide, () => false);
  return sideways ? <Sideways chapters={chapters} /> : <Stacked chapters={chapters} />;
}

function Sideways({ chapters }: { chapters: Chapter[] }) {
  const ref = useRef<HTMLElement>(null);
  const n = chapters.length;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.5 });
  const x = useTransform(p, [0, 1], ["0vw", `${-(n - 1) * 100}vw`]);
  const [at, setAt] = useState(0);
  useEffect(() => p.on("change", (v) => setAt(Math.min(n - 1, Math.round(v * (n - 1))))), [p, n]);

  return (
    <section ref={ref} aria-label="The store, in chapters" style={{ height: `${n * 100}svh` }} className="relative bg-white">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div style={{ x }} className="flex h-full w-max">
          {chapters.map((c, i) => (
            <ChapterPanel key={c.title.join(" ")} c={c} i={i} n={n} p={p} />
          ))}
        </motion.div>
        {/* Where we are: *01 … */}
        <p aria-hidden className="pointer-events-none absolute bottom-8 right-10 flex items-baseline gap-1 font-[family-name:var(--font-didone)] text-[#111]">
          <span className="text-[34px] leading-none">*</span>
          <span className="text-[44px] font-medium leading-none tabular-nums">{String(at + 1).padStart(2, "0")}</span>
          <span className="ml-2 text-[13px] text-[#111]/50">/ {String(n).padStart(2, "0")}</span>
        </p>
      </div>
    </section>
  );
}

function ChapterPanel({ c, i, n, p }: { c: Chapter; i: number; n: number; p: MotionValue<number> }) {
  // This chapter's moment in the run: from coming in on the right to leaving on the left.
  const mid = n > 1 ? i / (n - 1) : 0;
  const span = n > 1 ? 1 / (n - 1) : 1;
  const range = [mid - span, mid + span];
  const big = useTransform(p, range, ["12vw", "-12vw"]);
  const small = useTransform(p, range, ["28vw", "-28vw"]);
  const words = useTransform(p, range, ["6vw", "-6vw"]);
  const left = i % 2 === 0;
  return (
    <article aria-label={c.title.join(" ")} className="relative h-full w-screen shrink-0 overflow-hidden">
      {/* The big picture */}
      {!c.figure && (
        <motion.div style={{ x: big }} className={`absolute top-[14%] h-[66%] w-[34vw] ${left ? "right-[10vw]" : "left-[10vw]"}`}>
          <Image src={c.image} alt="" fill sizes="34vw" className="object-cover grayscale" />
        </motion.div>
      )}
      {/* The small one, drifting faster */}
      {c.small && (
        <motion.div style={{ x: small }} className={`absolute bottom-[12%] h-[30%] w-[16vw] ${left ? "right-[38vw]" : "left-[38vw]"} z-10 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)]`}>
          <Image src={c.small} alt="" fill sizes="16vw" className="object-cover grayscale" />
        </motion.div>
      )}
      {/* The words */}
      <motion.div style={{ x: words }} className={`absolute z-20 ${c.figure ? "inset-x-0 top-1/2 -translate-y-1/2 text-center" : `top-1/2 -translate-y-1/2 ${left ? "left-[8vw]" : "right-[8vw] text-right"}`}`}>
        <h2 className={`font-[family-name:var(--font-didone)] font-normal uppercase leading-[0.86] tracking-[-0.02em] text-[#111] ${c.figure ? "text-[13vw]" : "text-[clamp(3.4rem,6.4vw,7.4rem)]"}`}>
          {c.title[0]}
          <br />
          {c.title[1]}
        </h2>
        {!c.figure && <ChapterFoot c={c} align={left ? "left" : "right"} />}
      </motion.div>
      {/* The person standing in front of the words (the Vault) */}
      {c.figure && (
        <>
          <motion.div style={{ x: small }} className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center">
            <Image src={c.figure.src} alt="" width={c.figure.width} height={c.figure.height} sizes="420px" className="h-[86svh] w-auto object-contain [filter:drop-shadow(0_30px_40px_rgba(0,0,0,0.2))]" />
          </motion.div>
          <div className="absolute bottom-[12%] left-[8vw] z-40 max-w-[30ch]">
            <ChapterFoot c={c} align="left" />
          </div>
        </>
      )}
    </article>
  );
}

function ChapterFoot({ c, align }: { c: Chapter; align: "left" | "right" }) {
  return (
    <div className={`mt-6 max-w-[34ch] ${align === "right" ? "ml-auto" : ""}`}>
      <p className="text-[14px] leading-relaxed text-[#111]/70">{c.text}</p>
      {c.link && (
        <Link href={c.link.href} className={`group mt-4 inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#111]`}>
          <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:100%_1px] bg-bottom bg-no-repeat pb-1 transition-[background-size] duration-500 group-hover:bg-[length:0%_1px]">{c.link.label}</span>
          <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
        </Link>
      )}
      {c.signup && (
        <div className={`mt-5 ${align === "right" ? "flex justify-end" : ""}`}>
          <AlertSignup source="home" />
        </div>
      )}
    </div>
  );
}

/** Phones and less motion: the chapters one under another, each picture rising in gently. */
function Stacked({ chapters }: { chapters: Chapter[] }) {
  const still = useReducedMotion();
  return (
    <section aria-label="The store, in chapters" className="bg-white">
      {chapters.map((c, i) => (
        <motion.article
          key={c.title.join(" ")}
          aria-label={c.title.join(" ")}
          initial={still ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="container-ep border-t border-black/10 py-14"
        >
          <p className="font-[family-name:var(--font-didone)] text-[28px] leading-none text-[#111]">*{String(i + 1).padStart(2, "0")}</p>
          <h2 className="mt-4 font-[family-name:var(--font-didone)] text-[clamp(2.8rem,12vw,4.4rem)] font-normal uppercase leading-[0.88] tracking-[-0.02em] text-[#111]">
            {c.title[0]}
            <br />
            {c.title[1]}
          </h2>
          <div className="relative mt-6 aspect-[4/5] w-full overflow-hidden bg-[#ececea]">
            {c.figure ? (
              <Image src={c.figure.src} alt="" fill sizes="100vw" className="object-contain object-bottom" />
            ) : (
              <Image src={c.image} alt="" fill sizes="100vw" className="object-cover grayscale" />
            )}
          </div>
          <ChapterFoot c={c} align="left" />
        </motion.article>
      ))}
    </section>
  );
}
