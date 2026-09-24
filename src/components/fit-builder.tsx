"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { matchSize } from "@/lib/fit-profile";
import { formatPrice } from "@/lib/format";
import type { Category, Product, Size } from "@/lib/types";
import { useAddToBag } from "./bag-gate";
import { useFitProfile } from "./fit-finder";
import { Barcode } from "./hang-tag";
import { GarmentSvg } from "./product-image";

export type SlotKey = "top" | "bottom" | "layer" | "cap";
export interface FitPick {
  slug: string;
  colour: string;
  size: Size | null;
}
export type Fit = Partial<Record<SlotKey, FitPick | null>>;

const SLOTS: { key: SlotKey; label: string; cats: Category[]; optional?: boolean }[] = [
  { key: "top", label: "Top", cats: ["tees", "hoodies"] },
  { key: "bottom", label: "Bottom", cats: ["bottoms"] },
  { key: "layer", label: "Layer", cats: ["jackets"], optional: true },
  { key: "cap", label: "Cap", cats: ["accessories"], optional: true },
];

/** Where each slot sits on the flat-lay stage (percent of the stage). */
const PLACE: Record<SlotKey, string> = {
  cap: "left-[70%] top-[64%] w-[24%] z-30",
  layer: "left-[44%] top-[9%] w-[54%] z-10",
  top: "left-[4%] top-[10%] w-[56%] z-20",
  bottom: "left-[27%] top-[46%] w-[46%] z-0",
};

const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];

export function encodeFit(fit: Fit) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(fit)) if (v) q.set(k, [v.slug, v.colour, v.size ?? ""].join("~"));
  return q.toString();
}

export function FitBuilder({ products, initial }: { products: Product[]; initial: Fit }) {
  const addToBagOrLogin = useAddToBag();
  const profile = useFitProfile();
  const [fit, setFit] = useState<Fit>(initial);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);

  const bySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);

  // Keep the URL shareable: /fit?top=everyday-hoodie~Ash~M&bottom=...
  useEffect(() => {
    const qs = encodeFit(fit);
    window.history.replaceState(null, "", qs ? `/fit?${qs}` : "/fit");
  }, [fit]);

  const setSlot = (key: SlotKey, pick: FitPick | null) => {
    setFit((f) => ({ ...f, [key]: pick }));
    setAdded(false);
  };

  const lines = SLOTS.flatMap(({ key, label }) => {
    const pick = fit[key];
    const product = pick ? bySlug.get(pick.slug) : undefined;
    if (!pick || !product) return [];
    const variant = product.variants.find((v) => v.colour === pick.colour && v.size === pick.size);
    return [{ key, label, pick, product, variant, price: product.salePrice ?? product.price }];
  });
  const total = lines.reduce((n, l) => n + l.price, 0);
  const missingSize = lines.find((l) => !l.variant || l.variant.stock <= 0);
  const missingRequired = SLOTS.find((s) => !s.optional && !fit[s.key]);
  const ready = lines.length > 0 && !missingSize && !missingRequired;

  function addAll() {
    const items = lines.flatMap((l) =>
      l.variant ? [{ slug: l.product.slug, sku: l.variant.sku, name: l.product.name, size: l.variant.size, colour: l.pick.colour, price: l.price }] : [],
    );
    if (addToBagOrLogin(items)) setAdded(true);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "My Easypick fit", url });
      else await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // dismissed
    }
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
      {/* Flat-lay stage */}
      <div className="min-w-0 lg:col-span-6">
        <div className="on-dark relative aspect-[4/5] overflow-hidden bg-graphite text-paper lg:sticky lg:top-20">
          <p className="absolute left-4 top-4 z-40 text-sm text-paper/80">{lines.length} {lines.length === 1 ? "piece" : "pieces"}</p>
          {SLOTS.map(({ key }) => {
            const pick = fit[key];
            const product = pick ? bySlug.get(pick.slug) : undefined;
            const hex = product?.colours.find((c) => c.name === pick?.colour)?.hex;
            if (!product || !hex) return null;
            return (
              <div key={`${key}-${product.slug}-${hex}`} className={`absolute animate-fade-up ${PLACE[key]}`} aria-hidden>
                <GarmentSvg category={product.category} colourHex={hex} className="block aspect-[240/230] w-full" />
              </div>
            );
          })}
          <p className="absolute bottom-4 right-4 z-40 font-mono text-2xl font-semibold tabular-nums">{formatPrice(total)}</p>
          {lines.length === 0 && <p className="absolute inset-0 grid place-items-center text-paper/70">Pick a top to start.</p>}
        </div>
      </div>

      {/* Controls */}
      <div className="min-w-0 space-y-10 lg:col-span-6">
        {SLOTS.map(({ key, label, cats, optional }) => {
          const options = products.filter((p) => cats.includes(p.category) && p.status === "live");
          if (options.length === 0) return null;
          const pick = fit[key];
          const product = pick ? bySlug.get(pick.slug) : undefined;
          const match = product ? matchSize(product.category, product.measurements, profile) : null;
          const sizes = product
            ? SIZE_ORDER.filter((s) => product.variants.some((v) => v.size === s && v.colour === pick?.colour))
            : [];

          return (
            <fieldset key={key} className="min-w-0">
              <legend className="flex w-full items-baseline justify-between gap-4 border-t border-mist pt-4">
                <span className="text-sm font-semibold">
                  {label}
                  {optional ? " · optional" : ""}
                </span>
                {product && <span className="text-sm font-semibold">{product.name}</span>}
              </legend>

              <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" role="radiogroup" aria-label={`${label} piece`}>
                {optional && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!pick}
                    onClick={() => setSlot(key, null)}
                    className={`flex h-[104px] w-[84px] shrink-0 items-center justify-center rounded-[2px] border text-sm font-semibold ${!pick ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
                  >
                    None
                  </button>
                )}
                {options.map((p) => {
                  const on = pick?.slug === p.slug;
                  const colour = on && pick ? pick.colour : p.colours[0].name;
                  const hex = p.colours.find((c) => c.name === colour)?.hex ?? p.colours[0].hex;
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`${p.name}, ${formatPrice(p.salePrice ?? p.price)}`}
                      onClick={() => {
                        const m = matchSize(p.category, p.measurements, profile);
                        const size = p.variants.some((v) => v.size === "ONE") ? "ONE" : (m?.size ?? null);
                        setSlot(key, { slug: p.slug, colour: p.colours[0].name, size });
                      }}
                      className={`flex h-[104px] w-[112px] shrink-0 flex-col items-center justify-between rounded-[2px] border px-2 pb-2 pt-1 ${on ? "border-ink ring-1 ring-ink" : "border-mist hover:border-ink"}`}
                    >
                      <GarmentSvg category={p.category} colourHex={hex} className="h-14 w-14" />
                      <span className="w-full truncate text-center text-[12px] font-semibold">{p.name}</span>
                      <span className="font-mono text-[11px] text-steel-dark">{formatPrice(p.salePrice ?? p.price)}</span>
                    </button>
                  );
                })}
              </div>

              {product && pick && (
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                  {product.colours.length > 1 && (
                    <div className="flex gap-2" role="radiogroup" aria-label={`${label} colour`}>
                      {product.colours.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          role="radio"
                          aria-checked={pick.colour === c.name}
                          aria-label={c.name}
                          onClick={() => setSlot(key, { ...pick, colour: c.name })}
                          className={`h-11 w-11 rounded-full border border-black/10 ring-offset-2 ${pick.colour === c.name ? "ring-2 ring-ink" : ""}`}
                          style={{ background: c.hex }}
                        />
                      ))}
                    </div>
                  )}
                  {!(sizes.length === 1 && sizes[0] === "ONE") && (
                    <div className="flex gap-2" role="radiogroup" aria-label={`${label} size`}>
                      {sizes.map((s) => {
                        const stock = product.variants.find((v) => v.size === s && v.colour === pick.colour)?.stock ?? 0;
                        const on = pick.size === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={stock <= 0}
                            aria-label={`${s}${stock <= 0 ? ", sold out" : ""}${match?.size === s ? ", your fit" : ""}`}
                            onClick={() => setSlot(key, { ...pick, size: s })}
                            className={`relative h-11 min-w-11 rounded-[2px] border px-3 font-mono text-sm font-semibold ${
                              on ? "border-ink bg-ink text-paper" : stock <= 0 ? "border-mist text-steel line-through" : "border-mist hover:border-ink"
                            }`}
                          >
                            {s}
                            {match?.size === s && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 bg-volt ring-1 ring-ink" aria-hidden />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          );
        })}

        {/* The bill */}
        <section aria-label="Your fit bill" className="bg-photo p-4 md:p-6">
          <div className="receipt mx-auto max-w-[420px] px-6 pt-6 font-mono text-[13px]">
            <p className="text-center font-semibold tracking-[0.16em]">EASYPICK · FIT</p>
            <div className="my-3 border-t border-dashed border-steel" />
            {lines.length === 0 ? (
              <p className="text-steel-dark">Nothing picked yet.</p>
            ) : (
              <ul className="space-y-1">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-baseline">
                    <span className="truncate">
                      {l.product.name} · {l.pick.colour} · {l.pick.size === "ONE" ? "OS" : (l.pick.size ?? "size?")}
                    </span>
                    <span className="leader" aria-hidden />
                    <span className="tabular-nums">{formatPrice(l.price)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="my-3 border-t border-dashed border-steel" />
            <p className="flex items-baseline text-[15px] font-semibold">
              <span>TOTAL</span>
              <span className="leader" aria-hidden />
              <span className="tabular-nums">{formatPrice(total)}</span>
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-steel-dark">Fixed prices · VAT incl.</p>
            <Barcode value={encodeFit(fit) || "EASYPICK"} className="mx-auto mt-4 h-7 w-40 text-ink" />
          </div>

          <p role="status" className="mt-4 min-h-5 text-center text-[13px]">
            {missingRequired ? `Pick a ${missingRequired.label.toLowerCase()}.` : missingSize ? `Pick a size for the ${missingSize.label.toLowerCase()}.` : ""}
            {added && (
              <>
                Added {lines.length} pieces.{" "}
                <Link href="/bag" className="font-semibold underline">
                  View bag
                </Link>
              </>
            )}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={addAll} disabled={!ready} className="btn btn-volt flex-1 ring-1 ring-ink/80">
              Add fit to bag
            </button>
            <button type="button" onClick={share} className="btn btn-outline flex-1">
              {copied ? "Link copied" : "Share this fit"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
