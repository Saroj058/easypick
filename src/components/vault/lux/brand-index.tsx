"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";

import { ProductImage } from "@/components/product-image";
import type { TileData } from "@/components/vault/vault-tile";
import { EASE_IO, L, two } from "./tokens";

// The Vault's brand index (owner, 25 Oct 2026: "like a luxury website"): one big serif list, "All"
// first, then each brand with where it began and how many pieces are here. On a desktop, pointing
// at a brand floats a few of its own pieces beside the cursor; on a phone, or with less motion
// asked for, each row shows one small picture instead.

type Row = { name: string; n: number; href: string; origin: string; pieces: TileData[]; on: boolean };

/** True on a mouse or trackpad (the floating preview only makes sense there). */
const FINE = "(pointer: fine)";
function subscribeFine(cb: () => void) {
  const m = window.matchMedia(FINE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const useFinePointer = () =>
  useSyncExternalStore(
    subscribeFine,
    () => window.matchMedia(FINE).matches,
    () => false,
  );

/** The preview's size: the front picture, in px. */
const W = 200;

export function BrandIndex({ brands, active, total }: { brands: { name: string; n: number; href: string; origin: string; pieces: TileData[] }[]; active?: string; total: number }) {
  const still = useReducedMotion();
  const fine = useFinePointer();
  const follow = fine && !still;

  const rows: Row[] = [{ name: "All", n: total, href: "/vault", origin: "", pieces: brands.flatMap((b) => b.pieces).slice(0, 3), on: !active }].concat(
    brands.map((b) => ({ ...b, pieces: b.pieces.slice(0, 3), on: active === b.name })),
  );

  const box = useRef<HTMLElement>(null);
  const [hot, setHot] = useState<number | null>(null);
  const [inside, setInside] = useState(false);

  // Where the preview sits, eased toward the cursor (about a 0.12 lerp), moved by transform only.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 140, damping: 22, mass: 0.6 });
  const y = useSpring(my, { stiffness: 140, damping: 22, mass: 0.6 });

  const place = (cx: number, cy: number, jump = false) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    // Keep it inside the list and a little off the cursor, so it never covers the name being read.
    const px = Math.min(Math.max(cx - r.left + 32, 0), r.width - W * 1.3);
    const py = cy - r.top - (W * 1.25) / 2;
    mx.set(px);
    my.set(py);
    if (jump) {
      x.jump(px);
      y.jump(py);
    }
  };

  const shown = follow && inside && hot !== null && rows[hot].pieces.length > 0 ? rows[hot] : null;

  return (
    <nav
      ref={box}
      aria-label="Vault brands"
      className="relative"
      onPointerMove={follow ? (e) => place(e.clientX, e.clientY, !inside) : undefined}
      onPointerEnter={follow ? (e) => (place(e.clientX, e.clientY, true), setInside(true)) : undefined}
      onPointerLeave={() => {
        setInside(false);
        setHot(null);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setInside(false);
          setHot(null);
        }
      }}
    >
      <ul className={`border-t ${L.hair}`}>
        {rows.map((r, i) => {
          const dimmed = hot !== null && hot !== i;
          const thumb = r.pieces[0];
          return (
            <li key={r.href} className={`border-b ${L.hair}`}>
              <Link
                href={r.href}
                aria-current={r.on ? "page" : undefined}
                aria-label={`${r.name}, ${r.n} ${r.n === 1 ? "piece" : "pieces"}`}
                onPointerEnter={() => setHot(i)}
                onFocus={(e) => {
                  setHot(i);
                  // With the keyboard there is no cursor: park the preview by the row's right side.
                  if (follow) {
                    const b = e.currentTarget.getBoundingClientRect();
                    place(b.left + b.width * 0.6, b.top + b.height / 2, !inside);
                    setInside(true);
                  }
                }}
                className="group grid grid-cols-[2.25rem_1fr_auto] items-center gap-x-3 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ede8df] md:grid-cols-[4rem_1fr_auto] md:gap-x-6 md:py-7"
              >
                <span className={`self-start pt-[0.9em] font-mono text-[11px] tabular-nums tracking-[0.14em] transition-colors duration-500 ${dimmed ? "text-[#ede8df]/70" : "text-[#ede8df]/80"}`}>{two(i)}</span>

                <span className="flex min-w-0 flex-col gap-2 md:flex-row md:items-baseline md:gap-6">
                  <span
                    className={`${L.serif} flex min-w-0 items-center gap-3 text-[clamp(2.4rem,7vw,5.5rem)] leading-[0.92] transition-[color,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:translate-x-3 motion-safe:group-focus-visible:translate-x-3 ${
                      dimmed ? "text-[#ede8df]/70" : L.ivory
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    {/* The open brand: one small brass dot */}
                    {r.on && <span aria-hidden className={`size-2 shrink-0 rounded-full ${L.brassBg} md:size-2.5`} />}
                  </span>
                  {r.origin && <span className={`${L.label} truncate transition-colors duration-500 ${dimmed ? "text-[#ede8df]/70" : "text-[#ede8df]/80"}`}>{r.origin}</span>}
                </span>

                <span className="flex items-center gap-4">
                  <span className={`font-mono text-[11px] uppercase tabular-nums tracking-[0.14em] transition-colors duration-500 ${dimmed ? "text-[#ede8df]/70" : "text-[#ede8df]/80"}`}>
                    {two(r.n)}
                    <span className="hidden md:inline"> {r.n === 1 ? "piece" : "pieces"}</span>
                  </span>
                  {/* Phone, or less motion: one small picture in place of the floating preview */}
                  {thumb && (
                    <span aria-hidden className="block w-12 shrink-0 [@media(pointer:fine)_and_(prefers-reduced-motion:no-preference)]:hidden">
                      <ProductImage image={thumb.image} category={thumb.category} colourHex={thumb.hex} decorative sizes="48px" className="rounded-[2px]" />
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* The floating preview: up to three of the brand's pieces, fanned, crossfading between brands */}
      {follow && (
        <motion.div aria-hidden className="pointer-events-none absolute left-0 top-0 z-10 hidden md:block" style={{ x, y, width: W * 1.3 }}>
          <AnimatePresence>
            {shown && (
              <motion.div
                key={shown.href}
                className="absolute inset-x-0 top-0"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.45, ease: EASE_IO }}
              >
                {shown.pieces
                  .map((p, k) => ({ p, k }))
                  .reverse()
                  .map(({ p, k }) => (
                    <div
                      key={p.id}
                      className="absolute top-0"
                      style={{ width: W * (1 - k * 0.14), left: k * W * 0.2, transform: `translateY(${k * 18}px) rotate(${(k - 1) * 2.5}deg)` }}
                    >
                      <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative sizes={`${W}px`} className="rounded-[2px]" />
                    </div>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </nav>
  );
}
