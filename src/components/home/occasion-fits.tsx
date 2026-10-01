"use client";

import Link from "next/link";
import { useState } from "react";

import { useAddToBag } from "@/components/bag-gate";
import { encodeFit, type Fit } from "@/components/fit-builder";
import { useFitProfile } from "@/components/fit-finder";
import { ProductImage } from "@/components/product-image";
import { matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import { fitSlot, type Look, type LookPiece } from "@/lib/occasions";
import type { Size } from "@/lib/types";

// "Wear it to…": the occasion is a big type tab, the outfit is one composed look
// (a large piece and two smaller ones), and beside it an itemised list with sizes and the total.

/** The size to start on: the customer's matched size, else M, else the first one in stock. */
function startSize(p: LookPiece, matched: Size | null): Size | null {
  const ok = (s: Size) => p.sizes.some((x) => x.size === s && x.stock > 0);
  if (matched && ok(matched)) return matched;
  if (ok("M")) return "M";
  return p.sizes.find((x) => x.stock > 0)?.size ?? null;
}

const plate = (i: number) => String(i + 1).padStart(2, "0");

export function OccasionFits({ looks }: { looks: Look[] }) {
  const addToBagOrLogin = useAddToBag();
  const profile = useFitProfile();
  const [key, setKey] = useState(looks[0]?.key);
  const [picked, setPicked] = useState<Record<string, Size | null>>({});
  const [added, setAdded] = useState(false);

  const look = looks.find((l) => l.key === key) ?? looks[0];
  if (!look) return null;

  const id = (p: LookPiece) => `${look.key}:${p.slug}`;
  const sizeOf = (p: LookPiece) => (picked[id(p)] !== undefined ? picked[id(p)] : startSize(p, matchSize(p.category, p.measurements, profile)?.size ?? null));
  const total = look.pieces.reduce((n, p) => n + p.price, 0);

  function addAll() {
    const items = look.pieces.flatMap((p) => {
      const size = sizeOf(p);
      const v = p.sizes.find((x) => x.size === size && x.stock > 0);
      return v && size ? [{ slug: p.slug, sku: v.sku, name: p.name, size, colour: p.colour, price: p.price }] : [];
    });
    if (items.length && addToBagOrLogin(items)) setAdded(true);
  }

  const fit: Fit = {};
  for (const p of look.pieces) fit[fitSlot(p.category)] = { slug: p.slug, colour: p.colour, size: sizeOf(p) };
  const ready = look.pieces.every((p) => sizeOf(p));
  const [lead, ...rest] = look.pieces;

  return (
    <div>
      {/* The sentence: "Wear it to…" then the occasion, set as large type tabs. */}
      <h2 id="occasion-title" className="font-mono text-[13px] uppercase tracking-[0.14em] text-steel-dark">
        Wear it to…
      </h2>
      <div role="radiogroup" aria-labelledby="occasion-title" className="no-scrollbar -mx-4 mt-3 flex gap-x-6 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:gap-x-10 md:px-0">
        {looks.map((l) => {
          const on = l.key === look.key;
          return (
            <button
              key={l.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setKey(l.key);
                setAdded(false);
              }}
              className={`display shrink-0 text-[clamp(2.5rem,1.6rem+4vw,5.5rem)] leading-[0.95] transition-colors duration-200 ${on ? "text-ink" : "text-[#c7c7cc] hover:text-steel-dark"}`}
            >
              <span className={on ? "hl-volt" : ""}>{l.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-8 md:mt-10 lg:grid-cols-12 lg:gap-12">
        {/* The look: one large piece, the others beside it. */}
        {/* Every tile fills its cell, so the big one and the two small ones always end on the same line. */}
        <ul className={`grid gap-2 md:gap-3 lg:col-span-7 lg:aspect-auto lg:min-h-[520px] ${rest.length > 1 ? "aspect-[6/5] grid-cols-3 grid-rows-2" : "aspect-[8/5] grid-cols-2"}`}>
          <li className={`min-h-0 ${rest.length > 1 ? "col-span-2 row-span-2" : ""}`}>
            <Link href={`/product/${lead.slug}`} aria-label={lead.name} className="group relative block h-full overflow-hidden bg-photo">
              <ProductImage
                image={lead.image}
                category={lead.category}
                colourHex={lead.hex}
                decorative
                priority={false}
                className="!aspect-auto h-full transition-transform duration-500 group-hover:scale-[1.03]"
                sizes="(min-width: 1024px) 40vw, 66vw"
              />
              <span aria-hidden className="absolute left-3 top-3 font-mono text-[12px] tracking-[0.12em] text-ink/70">
                {plate(0)}
              </span>
            </Link>
          </li>
          {rest.map((p, i) => (
            <li key={p.slug} className="min-h-0">
              <Link href={`/product/${p.slug}`} aria-label={p.name} className="group relative block h-full overflow-hidden bg-photo">
                <ProductImage
                  image={p.image}
                  category={p.category}
                  colourHex={p.hex}
                  decorative
                  className="!aspect-auto h-full transition-transform duration-500 group-hover:scale-[1.03]"
                  sizes="(min-width: 1024px) 20vw, 33vw"
                />
                <span aria-hidden className="absolute left-2 top-2 font-mono text-[11px] tracking-[0.12em] text-ink/70 md:left-3 md:top-3 md:text-[12px]">
                  {plate(i + 1)}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* The list: each piece with its size, then the total and the two ways on. */}
        <div className="flex flex-col lg:col-span-5">
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-steel-dark">
            The {look.label.toLowerCase()} fit · {look.pieces.length} pieces
          </p>
          <ul className="mt-3 border-b border-mist">
            {look.pieces.map((p, i) => {
              const size = sizeOf(p);
              const oneSize = p.sizes.length === 1 && p.sizes[0].size === "ONE";
              return (
                <li key={p.slug} className="grid grid-cols-[auto_1fr_auto] gap-x-4 border-t border-mist py-4">
                  <span aria-hidden className="pt-0.5 font-mono text-[12px] text-steel-dark">
                    {plate(i)}
                  </span>
                  <div className="min-w-0">
                    <Link href={`/product/${p.slug}`} className="font-semibold decoration-1 underline-offset-4 hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-[13px] text-steel-dark">{p.colour}</p>
                    {oneSize ? (
                      <p className="mt-2 font-mono text-[12px] text-steel-dark">One size</p>
                    ) : (
                      <div role="radiogroup" aria-label={`Size for ${p.name}`} className="mt-2 flex flex-wrap gap-1.5">
                        {p.sizes.map((s) => {
                          const out = s.stock <= 0;
                          const on = size === s.size;
                          return (
                            <button
                              key={s.size}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              aria-label={`${s.size}${out ? ", sold out" : ""}`}
                              disabled={out}
                              onClick={() => {
                                setPicked((m) => ({ ...m, [id(p)]: s.size }));
                                setAdded(false);
                              }}
                              className={`h-9 min-w-9 border px-2 font-mono text-[12px] font-semibold ${
                                on ? "border-ink bg-ink text-paper" : out ? "border-mist text-[#c7c7cc] line-through" : "border-mist hover:border-ink"
                              }`}
                            >
                              {s.size}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-[14px] tabular-nums">{formatPrice(p.price)}</span>
                </li>
              );
            })}
          </ul>

          <p className="flex items-baseline justify-between py-5">
            <span className="text-[15px] font-semibold">The whole fit</span>
            <span className="font-mono text-[28px] font-semibold leading-none tabular-nums">{formatPrice(total)}</span>
          </p>

          <div className="mt-auto grid gap-2.5">
            <button type="button" onClick={addAll} disabled={!ready} aria-label={added ? "Added to your bag" : `Add the fit · ${formatPrice(total)}`} className="btn btn-ink h-[60px] w-full">
              {added ? "Added to your bag" : "Add the fit"}
            </button>
            {/* The one lime button in the section: make it yours. */}
            <Link
              href={`/fit?${encodeFit(fit)}`}
              className="group flex h-[60px] w-full items-center justify-between gap-3 rounded-[2px] border border-ink bg-volt px-5 text-[15px] font-semibold uppercase tracking-[0.06em] text-ink transition-shadow duration-200 hover:shadow-[4px_4px_0_0_#0a0a0a]"
            >
              <span className="flex items-center gap-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M12 8a2 2 0 1 0-2-2M12 8v2l9 6.5a1 1 0 0 1-.6 1.8H3.6a1 1 0 0 1-.6-1.8L12 10" />
                </svg>
                Build your own fit
              </span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
