"use client";

import { ArrowRight, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { Archivo, Instrument_Serif } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { showBagToast, useAddToBag } from "@/components/bag-gate";
import { openBuyNow } from "@/components/buy-sheets";
import { ProductImage } from "@/components/product-image";
import { TrackForm } from "@/app/track/track-form";
import { formatPrice } from "@/lib/format";
import { MY_SIZES, setMySize, useMySize } from "@/lib/my-size";
import type { Category, ProductImage as Img, Size } from "@/lib/types";

import "./showroom.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-sr-serif", display: "swap" });

export type ShowPiece = {
  slug: string;
  name: string;
  kind: string;
  price: number;
  line: string;
  isNew: boolean;
  /** The piece cut out on a clear background, when there is one; otherwise its first photo. */
  cutout: string | null;
  photo: Img;
  category: Category;
  hex: string;
  /** The first colour's sizes, with how many can be bought online. */
  colour: string;
  sizes: { size: Size; sku: string; left: number }[];
};
export type ShowroomData = {
  pieces: ShowPiece[];
  inStock: number;
  from: number | null;
  fresh: number;
  vault: { pieces: number; brands: { name: string; logo: string | null }[] };
  drop: { name: string; at: string } | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const total = (p: ShowPiece) => p.sizes.reduce((n, s) => n + s.left, 0);
const oneSize = (p: ShowPiece) => p.sizes.length > 0 && p.sizes.every((s) => s.size === "ONE");

/** The piece, as large as the stage allows: its cut-out, or its photo. */
function Shot({ p, big }: { p: ShowPiece; big?: boolean }) {
  if (p.cutout) return <Image src={p.cutout} alt={big ? p.name : ""} fill sizes={big ? "(min-width: 1024px) 560px, 80vw" : "80px"} className="object-contain" priority={big} />;
  return <ProductImage image={p.photo} category={p.category} colourHex={p.hex} decorative={!big} sizes={big ? "(min-width: 1024px) 560px, 80vw" : "80px"} ground="bg-transparent" className="!absolute inset-0 !aspect-auto h-full w-full" priority={big} />;
}

/** The next drop, counting down. */
function Countdown({ at }: { at: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the clock once mounted, then every second
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = now === null ? 0 : Math.max(0, Math.floor((Date.parse(at) - now) / 1000));
  const parts: [string, number][] = [
    ["Days", Math.floor(s / 86400)],
    ["Hrs", Math.floor((s % 86400) / 3600)],
    ["Min", Math.floor((s % 3600) / 60)],
    ["Sec", s % 60],
  ];
  return (
    <div className="sr-clock" aria-hidden>
      {parts.map(([k, v]) => (
        <div key={k}>
          <b>{now === null ? "--" : pad(v)}</b>
          <span>{k}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The top of the home page: the showroom (owner, 28 Oct 2026, design 2 of the five). One piece stands large on a calm
 * stage with its name, price and the sizes it comes in; a strip of the rail's pieces switches it; your size is picked
 * once (the rail below uses it too), and the piece is bought from here with Quick buy or goes in the bag; the Vault, tracking an order and the next
 * drop sit as small boxes on the right. Real pieces, prices and stock.
 */
export function Showroom({ data }: { data: ShowroomData }) {
  const { pieces } = data;
  const size = useMySize();
  const add = useAddToBag();
  const [cur, setCur] = useState(0);
  const [out, setOut] = useState(false);
  const p = pieces[cur];

  const show = (i: number) => {
    const next = (i + pieces.length) % pieces.length;
    if (next === cur) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setCur(next);
    setOut(true);
    window.setTimeout(() => {
      setCur(next);
      requestAnimationFrame(() => setOut(false));
    }, 220);
  };

  if (!p) return null;
  const sold = total(p) === 0;
  const single = oneSize(p);
  const pick = single ? p.sizes[0] : size ? p.sizes.find((s) => s.size === size) : undefined;
  const inSize = (q: ShowPiece) => !size || oneSize(q) || q.sizes.some((s) => s.size === size && s.left > 0);
  const stocked = p.sizes.filter((s) => s.left > 0 && s.size !== "ONE").map((s) => s.size);
  const note = sold
    ? "Sold out in every size. Back soon."
    : single
      ? "One size. In stock."
      : !size
        ? `In stock: ${stocked.join(" · ")}`
        : pick && pick.left > 0
          ? pick.left <= 2
            ? `${size} in stock. Only ${pick.left} left.`
            : `${size} in stock.`
          : `${size} is out in this piece.`;
  const canAdd = !sold && !!pick && pick.left > 0;
  const addLabel = sold ? "Sold out" : canAdd ? "Quick buy" : size && !single ? `Not in ${size}` : "Choose a size";
  const line = pick ? { slug: p.slug, sku: pick.sku, name: p.name, size: pick.size, colour: p.colour, price: p.price } : null;

  return (
    <div className={`sr ${archivo.variable} ${serif.variable}`}>
      <h1 className="sr-only">Easypick: quality clothes and real style in Kathmandu</h1>

      {/* Left: the line, the piece, your size */}
      <section className="sr-info" aria-label="The piece on show">
        <p className="sr-line">
          Quality clothes. <em>Real style.</em> Kathmandu.
        </p>
        <div className="sr-rule" />
        <div className={`sr-piece sr-swap ${out ? "out" : ""}`}>
          <p className="sr-meta">{p.kind}</p>
          <h2 className="sr-name">{p.name}</h2>
          <p className="sr-price">{formatPrice(p.price)}</p>
          {p.line && <p className="sr-detail">{p.line}</p>}
        </div>

        <div className="sr-sizes">
          <div className="sr-sizes-head">
            <span className="sr-meta">Your size</span>
            <span className="sr-meta">{size ? `Saved · rail shows ${size}` : "Filters the rail"}</span>
          </div>
          <div className="sr-chips" role="group" aria-label="Your size">
            {MY_SIZES.map((s) => {
              const here = single || p.sizes.some((v) => v.size === s && v.left > 0);
              return (
                <button key={s} type="button" aria-pressed={size === s} className={`sr-chip ${here ? "" : "na"}`} onClick={() => setMySize(size === s ? null : s)}>
                  {s}
                  {!here && <span className="sr-only"> (not in this piece)</span>}
                </button>
              );
            })}
          </div>
          <p className="sr-stock" aria-live="polite">
            {note}
          </p>
          <div className="sr-cta">
            {/* Quick buy: straight to paying for this one piece, as Buy now does on a product page (owner, 28 Oct 2026) */}
            <button type="button" className="sr-btn sr-btn-dark" disabled={!canAdd} onClick={() => line && openBuyNow([{ ...line, qty: 1 }], "Quick buy")}>
              {addLabel}
            </button>
            <button
              type="button"
              className="sr-btn sr-btn-ghost"
              disabled={!canAdd}
              aria-label={`Add ${p.name} to bag`}
              title="Add to bag"
              onClick={() => {
                if (line && add([line])) showBagToast(`Added ${p.name} (${p.colour}${line.size === "ONE" ? "" : `, ${line.size}`}) to your bag.`);
              }}
            >
              <ShoppingBag aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <Link href={`/product/${p.slug}`} className="sr-btn sr-btn-ghost" aria-label={`See ${p.name}`}>
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>

      {/* Centre: the stage */}
      <section className="sr-stage" aria-label="Showroom">
        <div className="sr-floor" aria-hidden />
        <div className="sr-shadow" aria-hidden />
        <Link href={`/product/${p.slug}`} className={`sr-figure ${out ? "out" : ""}`} aria-label={`${p.name}, ${formatPrice(p.price)}`}>
          <Shot p={p} big />
        </Link>
        <span className="sr-idx sr-meta">
          {pad(cur + 1)} / {pad(pieces.length)}
        </span>
        {p.isNew && <span className="sr-tag">New this month</span>}
        <div className="sr-arrows">
          <button type="button" className="sr-arrow" onClick={() => show(cur - 1)} aria-label="Previous piece">
            <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button type="button" className="sr-arrow" onClick={() => show(cur + 1)} aria-label="Next piece">
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </section>

      {/* The strip: every piece on the rail */}
      <section className="sr-strip-wrap" aria-label="The rail">
        <div className="sr-strip-head">
          <p className="sr-count">
            <b>The rail</b>
            <span className="sep">/</span>
            {data.inStock} pieces in stock{data.from !== null && `, from ${formatPrice(data.from)}`}
            {data.fresh > 0 && (
              <span className="opt">
                <span className="sep">/</span>New this month: {data.fresh}
              </span>
            )}
          </p>
          <span className="sr-links">
            <a className="sr-link" href="#rail-title">
              Browse the rail <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={1.6} />
            </a>
            <Link className="sr-link" href="/shop">
              Go to the shop <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={1.6} />
            </Link>
          </span>
        </div>
        <div className="sr-strip" style={{ gridTemplateColumns: `repeat(${pieces.length}, minmax(0, 1fr))` }}>
          {pieces.map((q, i) => (
            <button
              key={q.slug}
              type="button"
              className={`sr-thumb ${!inSize(q) || total(q) === 0 ? "dim" : ""}`}
              aria-current={i === cur}
              aria-label={`${q.name}, ${formatPrice(q.price)}`}
              onClick={() => show(i)}
            >
              <span className="sr-box">
                {q.isNew && <i className="sr-new" title="New this month" />}
                <span className="sr-in">
                  <Shot p={q} />
                </span>
              </span>
              <span className="sr-p">{formatPrice(q.price)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Right: the Vault, tracking an order, the next drop */}
      <aside className="sr-modules">
        <Link className={`sr-mod sr-vault ${data.vault.pieces ? "" : "empty"}`} href="/vault">
          <div className="sr-mod-head">
            <span className="sr-mod-title">The Vault</span>
            <span className="sr-meta">Originals</span>
          </div>
          <p className="sr-sub">
            {data.vault.pieces
              ? `${data.vault.pieces} pieces${data.vault.brands.length > 0 ? `, ${data.vault.brands.length} brands` : ""}. Authentic, checked by hand.`
              : "Original brands, one of each. The first pieces are on their way."}
          </p>
          {data.vault.brands.length > 0 && (
            <div className="sr-logos">
              {data.vault.brands.slice(0, 6).map((b) => (
                <span key={b.name}>{b.logo ? <Image src={b.logo} alt={b.name} width={120} height={60} /> : <em>{b.name}</em>}</span>
              ))}
            </div>
          )}
          <span className="sr-link">
            Enter the Vault <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={1.6} />
          </span>
        </Link>

        <div className="sr-mod">
          <div className="sr-mod-head">
            <span className="sr-mod-title">Track an order</span>
            <span className="sr-meta">No login</span>
          </div>
          <div className="mt-3">
            <TrackForm narrow id="hero-track" />
          </div>
        </div>

        <div className="sr-mod">
          <div className="sr-mod-head">
            <span className="sr-mod-title">Next drop</span>
            {data.drop && (
              <span className="sr-meta sr-live">
                <i className="sr-dot" aria-hidden />
                Live count
              </span>
            )}
          </div>
          {data.drop ? (
            <>
              <p className="sr-sub">
                {data.drop.name},{" "}
                {new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" }).format(new Date(data.drop.at))} Kathmandu
              </p>
              <Countdown at={data.drop.at} />
            </>
          ) : (
            <p className="sr-sub">
              The next date is coming.{" "}
              <Link href="/alerts" className="underline underline-offset-2">
                Get drop alerts
              </Link>
            </p>
          )}
        </div>
      </aside>

      <footer className="sr-promises">
        <ul>
          <li>Quality only</li>
          <li>Real style</li>
          <li>Fixed prices</li>
          <li>Pay with eSewa</li>
        </ul>
        <span className="sr-meta">Self-checkout store, Kathmandu</span>
      </footer>
    </div>
  );
}
