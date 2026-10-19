"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { saveMyFit } from "@/app/auth-actions";
import { bodyOf, hasFit, matchSize, normalizeFit, readFit, saveFit, type FitProfile } from "@/lib/fit-profile";
import { MY_SIZES, setMySize } from "@/lib/my-size";
import { BRANDS, BRAND_SIZES, HEIGHT, jeansFor, recommend, WEIGHT, type BrandId, type Pref, type Shape } from "@/lib/size-maths";
import { typicalSizes } from "@/lib/typical-sizes";
import type { Category, Fit, Measurements, Size } from "@/lib/types";
import { useMe } from "./session";

// ---------- Opening it from anywhere ----------

const EVENT = "ep:size-finder";
export type FinderPiece = { name: string; category: Category; fit?: Fit; measurements: Measurements };

/** Opens Find my size over the page; with a piece, the result also says its size in that piece. */
export function openSizeFinder(piece?: FinderPiece) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: piece ?? null }));
}

// ---------- Small parts ----------

type Method = "body" | "brand" | "garment";
const cmToFtIn = (cm: number) => {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
};
const kgToLb = (kg: number) => Math.round(kg / 0.45359);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function Slider({ label, value, min, max, step, onChange, shown, unit, units, onUnit, spoken }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; shown: string; unit: string; units: [string, string]; onUnit: (u: string) => void; spoken: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span role="radiogroup" aria-label={`${label} in`} className="flex rounded-full bg-photo p-0.5">
          {units.map((u) => (
            <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => onUnit(u)} className={`h-8 cursor-pointer rounded-full px-3 text-[12px] font-semibold uppercase ${unit === u ? "bg-ink text-paper" : "text-steel-dark"}`}>
              {u}
            </button>
          ))}
        </span>
      </div>
      <p className="mt-2 font-mono text-[40px] leading-none tabular-nums" aria-hidden>
        {shown}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={() => onChange(clamp(value - step, min, max))} aria-label={`Less ${label.toLowerCase()}`} className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-mist text-lg hover:border-ink">
          −
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          aria-valuetext={spoken}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ "--pct": `${pct}%` } as React.CSSProperties}
          className="size-range w-full"
        />
        <button type="button" onClick={() => onChange(clamp(value + step, min, max))} aria-label={`More ${label.toLowerCase()}`} className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-mist text-lg hover:border-ink">
          +
        </button>
      </div>
    </div>
  );
}

const FIGURE: Record<Shape, { sh: number; ch: number; wa: number; hip: number; belly: number }> = {
  slim: { sh: 12, ch: 10, wa: 8, hip: 9, belly: 0 },
  average: { sh: 14, ch: 13, wa: 11, hip: 11, belly: 0 },
  broad: { sh: 18, ch: 17, wa: 12, hip: 12, belly: 0 },
  belly: { sh: 15, ch: 15, wa: 14, hip: 13, belly: 4 },
};

/** A plain figure for a build: no face, flat shapes, scaled a little with height and weight. */
function Figure({ shape, sx = 1, sy = 1 }: { shape: Shape; sx?: number; sy?: number }) {
  const f = FIGURE[shape];
  const torso = `M${30 - f.sh},24 C${30 - f.ch},40 ${30 - f.wa - f.belly},58 ${30 - f.hip},68 L${30 + f.hip},68 C${30 + f.wa + f.belly},58 ${30 + f.ch},40 ${30 + f.sh},24 Z`;
  return (
    <svg viewBox="0 0 60 120" className="h-full w-auto" aria-hidden>
      <motion.g animate={{ scaleX: sx, scaleY: sy }} style={{ transformOrigin: "30px 120px" }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
        <circle cx="30" cy="11" r="7" />
        <rect x="27" y="17" width="6" height="6" />
        <path d={torso} />
        <rect x={30 - f.sh - 7} y="25" width="5" height="36" rx="2.5" />
        <rect x={30 + f.sh + 2} y="25" width="5" height="36" rx="2.5" />
        <rect x={30 - f.hip} y="66" width={f.hip - 1} height="50" rx="3" />
        <rect x="31" y="66" width={f.hip - 1} height="50" rx="3" />
      </motion.g>
    </svg>
  );
}

const TEE: Record<Pref, { w: number; drop: number }> = { fitted: { w: 12, drop: 0 }, regular: { w: 14, drop: 0 }, relaxed: { w: 17, drop: 2 }, oversized: { w: 21, drop: 5 } };

/** A tee outline, wider as the fit gets roomier. */
function Tee({ pref }: { pref: Pref }) {
  const { w, drop } = TEE[pref];
  const l = 32 - w;
  const r = 32 + w;
  const d = `M${l},${10 + drop} L24,5 Q32,10 40,5 L${r},${10 + drop} L${r + 9},${19 + drop} L${r + 4},${24 + drop} L${r},${21 + drop} L${r},52 L${l},52 L${l},${21 + drop} L${l - 4},${24 + drop} L${l - 9},${19 + drop} Z`;
  return (
    <svg viewBox="0 0 64 56" className="h-12 w-auto" aria-hidden>
      <path d={d} fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const SHAPE_NAME: Record<Shape, string> = { slim: "Slim", average: "Average", broad: "Broad", belly: "Fuller middle" };
const PREF_NAME: Record<Pref, string> = { fitted: "Close", regular: "Regular", relaxed: "Easy", oversized: "Oversized" };

function Choice<T extends string>({ legend, options, value, onChange, render }: { legend: string; options: T[]; value: T; onChange: (v: T) => void; render: (v: T, on: boolean) => React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {options.map((o) => (
          <label key={o} className="cursor-pointer">
            <input type="radio" name={legend} value={o} checked={value === o} onChange={() => onChange(o)} className="peer sr-only" />
            <span className="flex h-full flex-col items-center gap-1.5 rounded-[6px] border border-mist p-2 text-[12px] text-steel-dark transition-colors peer-checked:border-ink peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">{render(o, value === o)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const field = "h-12 w-full rounded-[6px] border border-steel-dark bg-paper pl-4 pr-12 font-mono text-lg tabular-nums outline-none focus:border-ink";

// ---------- The finder ----------

/**
 * Find my size (owner, 19 Oct 2026: "super advanced but easy; for men; opens in the middle, not a
 * new page"). Three ways in: height and weight, a size in another brand, or a piece they own,
 * measured flat. Then their build and how they like things to fit, and the answer: their size in
 * our tees, hoodies and jeans (and in the piece they were looking at). Saved in this browser, and
 * to the account when signed in.
 */
export function SizeFinderHost() {
  const [open, setOpen] = useState(false);
  const [piece, setPiece] = useState<FinderPiece | null>(null);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const on = (e: Event) => {
      setPiece((e as CustomEvent<FinderPiece | null>).detail);
      setRun((n) => n + 1);
      setOpen(true);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[90] bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-x-0 bottom-0 z-[91] max-h-[92dvh] overflow-y-auto rounded-t-[18px] bg-paper px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.35)] outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,calc(100vw-48px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[18px] sm:p-8"
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.98 }}
                transition={{ type: "spring", duration: 0.45, bounce: 0.08 }}
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-mist sm:hidden" aria-hidden />
                <MotionConfig reducedMotion="user">
                  <Finder key={run} piece={piece} onDone={() => setOpen(false)} />
                </MotionConfig>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function Finder({ piece, onDone }: { piece: FinderPiece | null; onDone: () => void }) {
  const me = useMe();
  // Starts from what they saved last time, if anything.
  const [start] = useState<FitProfile>(() => readFit());
  const known = hasFit(start);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(known ? 3 : 0);
  const [method, setMethod] = useState<Method>(start.chest || start.waist ? "garment" : start.brand ? "brand" : "body");
  const [height, setHeight] = useState(start.heightCm ?? 172);
  const [weight, setWeight] = useState(start.weightKg ?? 68);
  const [hUnit, setHUnit] = useState("cm");
  const [wUnit, setWUnit] = useState("kg");
  const [shape, setShape] = useState<Shape>(start.shape ?? "average");
  const [pref, setPref] = useState<Pref>(start.pref ?? "regular");
  const [brand, setBrand] = useState<BrandId>(start.brand?.id ?? "generic");
  const [brandSize, setBrandSize] = useState<Size | null>(start.brand?.size ?? null);
  const [jeans, setJeans] = useState<number | null>(start.jeans ?? null);
  const [chest, setChest] = useState(start.chest ? String(start.chest) : "");
  const [length, setLength] = useState(start.length ? String(start.length) : "");
  const [waist, setWaist] = useState(start.waist ? String(start.waist) : "");
  const [saved, setSaved] = useState(false);

  const num = (v: string) => {
    const n = Number(v);
    return n >= 40 && n <= 200 ? Math.round(n) : undefined;
  };
  const profile: FitProfile = normalizeFit(
    method === "garment"
      ? { chest: num(chest), length: num(length), waist: num(waist), pref }
      : method === "brand"
        ? { brand: brandSize ? { id: brand, size: brandSize } : undefined, jeans: jeans ?? undefined, pref }
        : { heightCm: height, weightKg: weight, shape, pref, jeans: jeans ?? undefined },
  );
  const ready = hasFit(profile);

  // The answer: our tees, hoodies and jeans at their usual cut, and the piece they came from.
  const body = bodyOf(profile);
  const sizes: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];
  const tee = body ? recommend("tees", "regular", typicalSizes("tees", "regular", sizes), body) : profile.chest ? matchSize("tees", typicalSizes("tees", "regular", sizes), profile) : null;
  const hoodie = body ? recommend("hoodies", "regular", typicalSizes("hoodies", "regular", sizes), body) : profile.chest ? matchSize("hoodies", typicalSizes("hoodies", "regular", sizes), profile) : null;
  const jeansSize = profile.jeans ?? (body?.waist ? jeansFor(body.waist) : profile.waist ? jeansFor(profile.waist - 2) : null);
  const inPiece = piece ? matchSize(piece.category, piece.measurements, profile, piece.fit) : null;
  const sure = method === "garment" ? "Good match: from a piece you own" : method === "brand" ? "Good guide: from a size you wear" : "A close guide: from your height and weight";

  const save = () => {
    const next = { ...profile, updatedAt: new Date().toISOString() };
    saveFit(next);
    void saveMyFit(next);
    if (tee && MY_SIZES.includes(tee.size)) setMySize(tee.size);
    setSaved(true);
    setTimeout(onDone, 700);
  };

  const title = ["Find your size", method === "garment" ? "Measure a piece you own" : method === "brand" ? "A size you wear" : "Your height and weight", "Your build and fit", "Your size"][step];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          {step > 0 && step < 3 && (
            <button type="button" onClick={() => setStep((s) => (s === 2 ? 1 : 0))} className="mb-1 inline-flex h-8 cursor-pointer items-center text-[13px] text-steel-dark hover:text-ink">
              ← Back
            </button>
          )}
          <Dialog.Title className="display text-[30px] leading-[0.95]">{title}</Dialog.Title>
          <p className="mt-1 text-[13px] text-steel-dark" aria-live="polite">
            {step === 0 ? "Takes about 20 seconds. For our men's sizes." : step === 3 ? (piece ? `Including ${piece.name}.` : "Every piece now opens on your size.") : `Step ${step} of ${method === "garment" ? 1 : 2}`}
          </p>
        </div>
        <Dialog.Close className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-steel-dark hover:bg-photo hover:text-ink" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Dialog.Close>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${step}-${method}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="mt-6">
          {step === 0 && (
            <div className="grid gap-2">
              {(
                [
                  ["body", "Use my height and weight", "Quickest. A close guide."],
                  ["brand", "I know my size in another brand", "Uniqlo, H&M, Zara, Nike and more."],
                  ["garment", "Measure a piece I own", "Most exact: a tee that fits you well."],
                ] as const
              ).map(([m, t, d]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m);
                    setStep(1);
                  }}
                  className="flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-mist px-4 py-3 text-left transition-colors hover:border-ink"
                >
                  <span>
                    <span className="block text-[15px] font-semibold">{t}</span>
                    <span className="block text-[13px] text-steel-dark">{d}</span>
                  </span>
                  <span aria-hidden>→</span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && method === "body" && (
            <div className="space-y-7">
              <Slider label="Height" value={height} min={HEIGHT.min} max={HEIGHT.max} step={1} onChange={setHeight} unit={hUnit} units={["cm", "ft"]} onUnit={setHUnit} shown={hUnit === "cm" ? `${height} cm` : cmToFtIn(height)} spoken={hUnit === "cm" ? `${height} centimetres` : cmToFtIn(height).replace("′", " feet ").replace("″", " inches")} />
              <Slider label="Weight" value={weight} min={WEIGHT.min} max={WEIGHT.max} step={1} onChange={setWeight} unit={wUnit} units={["kg", "lb"]} onUnit={setWUnit} shown={wUnit === "kg" ? `${weight} kg` : `${kgToLb(weight)} lb`} spoken={wUnit === "kg" ? `${weight} kilograms` : `${kgToLb(weight)} pounds`} />
            </div>
          )}

          {step === 1 && method === "brand" && (
            <div className="space-y-5">
              <fieldset>
                <legend className="text-sm font-semibold">Brand</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {BRANDS.map((b) => (
                    <button key={b.id} type="button" aria-pressed={brand === b.id} onClick={() => setBrand(b.id)} className={`h-10 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold ${brand === b.id ? "bg-ink text-paper" : "ring-1 ring-mist hover:ring-ink"}`}>
                      {b.name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-semibold">Your size in their tees</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {BRAND_SIZES.map((s) => (
                    <button key={s} type="button" aria-pressed={brandSize === s} onClick={() => setBrandSize(s)} className={`h-11 min-w-12 cursor-pointer rounded-full px-3 font-mono text-[14px] ${brandSize === s ? "bg-ink text-paper" : "ring-1 ring-mist hover:ring-ink"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-semibold">
                  Jeans waist <span className="font-normal text-steel-dark">(optional, inches)</span>
                </legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[28, 30, 31, 32, 33, 34, 36, 38].map((w) => (
                    <button key={w} type="button" aria-pressed={jeans === w} onClick={() => setJeans(jeans === w ? null : w)} className={`h-10 min-w-11 cursor-pointer rounded-full px-2.5 font-mono text-[13px] ${jeans === w ? "bg-ink text-paper" : "ring-1 ring-mist hover:ring-ink"}`}>
                      {w}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 1 && method === "garment" && (
            <div className="space-y-4">
              <p className="text-[13.5px] text-steel-dark">Lay it flat. Measure straight across, then double it.</p>
              {(
                [
                  ["Chest of your tee", "Armpit to armpit × 2", chest, setChest],
                  ["Length of your tee", "Shoulder to hem (optional)", length, setLength],
                  ["Waist of your trousers", "Side to side × 2 (optional)", waist, setWaist],
                ] as const
              ).map(([l, h, v, set]) => (
                <label key={l} className="block">
                  <span className="text-sm font-semibold">{l}</span> <span className="text-[13px] text-steel-dark">· {h}</span>
                  <span className="relative mt-1.5 block">
                    <input type="number" inputMode="decimal" min={40} max={200} value={v} onChange={(e) => set(e.target.value)} className={field} />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm text-steel-dark">cm</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {method === "body" && (
                <Choice
                  legend="Your build"
                  options={["slim", "average", "broad", "belly"] as Shape[]}
                  value={shape}
                  onChange={setShape}
                  render={(s, on) => (
                    <>
                      <span className={`h-24 ${on ? "fill-ink" : "fill-steel"}`}>
                        <Figure shape={s} sx={clamp(Math.sqrt(weight / (height / 100) ** 2 / 23), 0.9, 1.14)} sy={clamp(height / 178, 0.92, 1.06)} />
                      </span>
                      {SHAPE_NAME[s]}
                    </>
                  )}
                />
              )}
              <Choice
                legend="How you like it to fit"
                options={["fitted", "regular", "relaxed", "oversized"] as Pref[]}
                value={pref}
                onChange={setPref}
                render={(p) => (
                  <>
                    <Tee pref={p} />
                    {PREF_NAME[p]}
                  </>
                )}
              />
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="rounded-[12px] bg-photo p-5">
                <p className="text-[12px] uppercase tracking-[0.08em] text-steel-dark">Your size</p>
                <div className="mt-1 flex items-end gap-4">
                  <p className="display text-[72px] leading-[0.85]" data-size-result>
                    {tee?.size ?? "—"}
                  </p>
                  <p className="pb-2 text-[14px]">
                    in our tees{tee && "alt" in tee && tee.alt ? <span className="text-steel-dark"> · {tee.alt.size} if you like it {tee.alt.why}</span> : null}
                  </p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
                  <div className="rounded-[8px] bg-paper px-3 py-2">
                    <dt className="text-steel-dark">Hoodies & jackets</dt>
                    <dd className="font-mono text-[18px] font-semibold">{hoodie?.size ?? "—"}</dd>
                  </div>
                  <div className="rounded-[8px] bg-paper px-3 py-2">
                    <dt className="text-steel-dark">Jeans waist</dt>
                    <dd className="font-mono text-[18px] font-semibold">{jeansSize ? `${jeansSize}″` : "—"}</dd>
                  </div>
                  {piece && (
                    <div className="col-span-2 rounded-[8px] bg-paper px-3 py-2">
                      <dt className="text-steel-dark">{piece.name}</dt>
                      <dd className="font-mono text-[18px] font-semibold">{inPiece?.size ?? "—"}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-3 flex items-center gap-2 text-[13px] text-steel-dark">
                  <span className="h-1.5 w-1.5 rounded-full bg-volt ring-1 ring-ink/30" aria-hidden />
                  {sure} · {PREF_NAME[pref].toLowerCase()} fit
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 text-[13px]">
                <button type="button" onClick={() => setStep(method === "garment" ? 1 : 2)} className="min-h-11 cursor-pointer underline underline-offset-4">
                  Change my answers
                </button>
                <button type="button" onClick={() => setStep(0)} className="min-h-11 cursor-pointer text-steel-dark underline underline-offset-4 hover:text-ink">
                  Try another way
                </button>
                {known && (
                  <button
                    type="button"
                    onClick={() => {
                      saveFit({});
                      void saveMyFit({});
                      setMySize(null);
                      onDone();
                    }}
                    className="min-h-11 cursor-pointer text-steel-dark underline underline-offset-4 hover:text-ink"
                  >
                    Forget my size
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {step > 0 && (
        <div className="mt-6">
          {step < 3 ? (
            <button
              type="button"
              disabled={step === 1 && !ready && method !== "body"}
              onClick={() => setStep(step === 1 && method !== "garment" ? 2 : 3)}
              className="btn btn-ink w-full disabled:opacity-40"
            >
              {step === 1 && method !== "garment" ? "Next" : "See my size"}
            </button>
          ) : (
            <button type="button" disabled={!ready || saved} onClick={save} className="btn btn-ink w-full disabled:opacity-60">
              {saved ? "Saved" : known ? "Save changes" : "Save my size"}
            </button>
          )}
          <p className="mt-3 text-center text-[12px] text-steel-dark">{me ? "Saved to your account, so it follows you to any phone." : "Saved in this browser. Sign in to keep it on your account."}</p>
        </div>
      )}
    </div>
  );
}
