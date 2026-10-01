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

/** The size to start on: the customer's matched size, else M, else the first one in stock. */
function startSize(p: LookPiece, matched: Size | null): Size | null {
  const ok = (s: Size) => p.sizes.some((x) => x.size === s && x.stock > 0);
  if (matched && ok(matched)) return matched;
  if (ok("M")) return "M";
  return p.sizes.find((x) => x.stock > 0)?.size ?? null;
}

export function OccasionFits({ looks }: { looks: Look[] }) {
  const addToBagOrLogin = useAddToBag();
  const profile = useFitProfile();
  const [key, setKey] = useState(looks[0]?.key);
  const [picked, setPicked] = useState<Record<string, Size | null>>({});
  const [added, setAdded] = useState(false);

  const look = looks.find((l) => l.key === key) ?? looks[0];
  if (!look) return null;

  const sizeOf = (p: LookPiece) =>
    picked[`${look.key}:${p.slug}`] !== undefined ? picked[`${look.key}:${p.slug}`] : startSize(p, matchSize(p.category, p.measurements, profile)?.size ?? null);
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

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-16">
      <div className="lg:col-span-4">
        <h2 id="occasion-title" className="display display-h1">
          Wear it to…
        </h2>
        <div role="radiogroup" aria-label="Occasion" className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-1">
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
                className={`flex min-h-14 items-center border px-4 text-left font-bold ${on ? "border-ink bg-ink text-paper" : "border-[#c7c7cc] bg-paper hover:border-ink"}`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-8">
        <ul className="grid grid-cols-3 gap-2 md:gap-3">
          {look.pieces.map((p) => {
            const size = sizeOf(p);
            return (
              <li key={p.slug} className="flex min-w-0 flex-col gap-2 bg-paper p-2 md:p-3.5">
                <Link href={`/product/${p.slug}`} className="block">
                  <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative sizes="(min-width: 1024px) 20vw, 30vw" />
                  <span className="mt-2 flex flex-col justify-between gap-0.5 text-[13px] md:flex-row md:gap-2 md:text-[14px]">
                    <span className="truncate font-semibold">{p.name}</span>
                    <span className="font-mono tabular-nums">{formatPrice(p.price)}</span>
                  </span>
                </Link>
                <label className="sr-only" htmlFor={`fit-${look.key}-${p.slug}`}>
                  Size for {p.name}
                </label>
                <select
                  id={`fit-${look.key}-${p.slug}`}
                  value={size ?? ""}
                  onChange={(e) => {
                    setPicked((m) => ({ ...m, [`${look.key}:${p.slug}`]: (e.target.value || null) as Size | null }));
                    setAdded(false);
                  }}
                  className="h-10 w-full border border-[#c7c7cc] bg-paper px-2 font-mono text-[13px]"
                >
                  {p.sizes.map((s) => (
                    <option key={s.size} value={s.size} disabled={s.stock <= 0}>
                      Size {s.size}
                      {s.stock <= 0 ? " · sold out" : ""}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <button type="button" onClick={addAll} disabled={!ready} className="btn btn-ink h-[60px] w-full">
            {added ? "Added to your bag" : `Add the fit · ${formatPrice(total)}`}
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
  );
}
