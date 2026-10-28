"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/lib/format";
import type { Category, ProductImage as Img } from "@/lib/types";

export type MosaicPiece = { slug: string; name: string; price: number; category: Category; hex: string; image: Img };

/** The ten cards, as a collage (owner's reference, 28 Oct 2026): left, top, width, height, in % of the mosaic. */
const SPOTS: [number, number, number, number][] = [
  [0, 9.5, 30.9, 39.6],
  [31.9, 0, 17.7, 18.9],
  [31.9, 20.7, 17.7, 28.4],
  [50.6, 10.4, 24.1, 38.7],
  [75.7, 20.7, 17.7, 28.4],
  [7, 50.9, 17.5, 28.4],
  [25.4, 50.9, 24.1, 38.7],
  [50.6, 50.9, 17.7, 28.4],
  [50.6, 81.1, 17.7, 18.9],
  [69.1, 50.9, 30.9, 39.6],
];
/** How long until the next change, picked at random each time. */
const WAITS = [500, 1000, 1000, 1500, 2000, 3000, 5000];
/** How a card turns over: upside down, downside up, to the left, to the right, or back and forward again. */
const TURNS: [Keyframe[], Keyframe[]][] = [
  [[{ transform: "perspective(900px) rotateX(0)" }, { transform: "perspective(900px) rotateX(90deg)" }], [{ transform: "perspective(900px) rotateX(-90deg)" }, { transform: "perspective(900px) rotateX(0)" }]],
  [[{ transform: "perspective(900px) rotateX(0)" }, { transform: "perspective(900px) rotateX(-90deg)" }], [{ transform: "perspective(900px) rotateX(90deg)" }, { transform: "perspective(900px) rotateX(0)" }]],
  [[{ transform: "perspective(900px) rotateY(0)" }, { transform: "perspective(900px) rotateY(-90deg)" }], [{ transform: "perspective(900px) rotateY(90deg)" }, { transform: "perspective(900px) rotateY(0)" }]],
  [[{ transform: "perspective(900px) rotateY(0)" }, { transform: "perspective(900px) rotateY(90deg)" }], [{ transform: "perspective(900px) rotateY(-90deg)" }, { transform: "perspective(900px) rotateY(0)" }]],
  [[{ transform: "scale(1)", opacity: 1 }, { transform: "scale(0.6)", opacity: 0 }], [{ transform: "scale(1.2)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }]],
];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/**
 * The pieces under the logo at the end of the home film: ten cards in a collage, and every half second to five
 * seconds (at random) one to three of them turn over to show another piece, each its own way. Still for people who
 * ask for less motion. `play` starts it once the film has ended.
 */
export function HeroMosaic({ pieces, play }: { pieces: MosaicPiece[]; play: boolean }) {
  const n = SPOTS.length;
  // Each card holds the piece it shows and the one it turns to next (already loading, out of sight).
  const [cards, setCards] = useState(() => {
    const len = Math.max(1, pieces.length);
    return SPOTS.map((_, i) => ({ cur: i % len, nxt: (i + Math.max(1, Math.min(n, len - 1))) % len }));
  });
  const els = useRef<(HTMLAnchorElement | null)[]>([]);
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    if (!play || pieces.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let alive = true;
    let timer = 0;
    const busy = new Set<number>();
    // A piece not on show anywhere, where there are enough; otherwise any piece but the card's own.
    const fresh = (own: number) => {
      const used = new Set(cardsRef.current.flatMap((c) => [c.cur, c.nxt]));
      const free = pieces.map((_, i) => i).filter((i) => !used.has(i));
      return free.length ? pick(free) : pick(pieces.map((_, i) => i).filter((i) => i !== own));
    };
    const turn = (spot: number) => {
      const el = els.current[spot];
      if (!el) return;
      busy.add(spot);
      const [out, back] = pick(TURNS);
      el.animate(out, { duration: 260, easing: "cubic-bezier(.55,0,.75,.2)", fill: "forwards" })
        .finished.then(() => {
          if (!alive) return;
          setCards((cs) => cs.map((c, i) => (i === spot ? { cur: c.nxt, nxt: fresh(c.nxt) } : c)));
          requestAnimationFrame(() => {
            el.getAnimations().forEach((a) => a.cancel());
            el.animate(back, { duration: 420, easing: "cubic-bezier(.2,.8,.3,1)" }).finished.finally(() => busy.delete(spot));
          });
        })
        .catch(() => busy.delete(spot));
    };
    const next = () => {
      timer = window.setTimeout(() => {
        if (!alive) return;
        const idle = SPOTS.map((_, i) => i).filter((i) => !busy.has(i));
        const count = Math.min(idle.length, pick([1, 1, 2, 2, 3]));
        for (let k = 0; k < count; k++) {
          const spot = idle.splice(Math.floor(Math.random() * idle.length), 1)[0];
          window.setTimeout(() => alive && turn(spot), k * (60 + Math.random() * 160));
        }
        next();
      }, pick(WAITS));
    };
    next();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [play, pieces]);

  if (!pieces.length) return null;
  return (
    <div className="sf-mosaic">
      {SPOTS.map(([l, t, w, h], i) => {
        const c = cards[i], p = pieces[c.cur];
        return (
          <Link
            key={i}
            ref={(el) => {
              els.current[i] = el;
            }}
            href={`/product/${p.slug}`}
            aria-label={`${p.name}, ${formatPrice(p.price)}`}
            className={`sf-tile${w < 20 ? " slim" : ""}`}
            style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, transitionDelay: `${i * 60}ms` }}
          >
            {[...new Set([c.cur, c.nxt])].map((k) => (
              <ProductImage
                key={k}
                image={pieces[k].image}
                category={pieces[k].category}
                colourHex={pieces[k].hex}
                decorative
                sizes="(min-width: 768px) 22vw, 40vw"
                className={`sf-tile-img !absolute inset-0 !aspect-auto h-full w-full ${k === c.cur ? "on" : ""}`}
              />
            ))}
            <span className="sf-tile-cap">
              <span className="n">{p.name}</span>
              <span className="p">{formatPrice(p.price)}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
