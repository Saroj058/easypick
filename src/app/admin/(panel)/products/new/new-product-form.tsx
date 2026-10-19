"use client";

import { useActionState, useRef, useState } from "react";
import { Check, ImagePlus, Plus, X } from "lucide-react";

import { formatPrice } from "@/lib/format";
import { categoryLabels } from "@/lib/site";
import type { Colour, Size } from "@/lib/types";
import { addProduct, type SaveState } from "@/app/admin/actions";
import { shrinkPhotoInput } from "../../resize-photo";

const input = "mt-2 h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-base outline-none focus:border-ink";
const field = "block text-sm font-semibold";
const hint = "font-normal text-[#6b6d72]";
const card = "scroll-mt-28 rounded-[24px] bg-[#f4f4f2] p-5 md:p-6";
const cell = "h-10 w-16 rounded-xl border border-ink/15 bg-white text-center font-mono outline-none focus:border-ink";
const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
const SIZE_SETS: { label: string; sizes: Size[] }[] = [
  { label: "S–XL", sizes: ["S", "M", "L", "XL"] },
  { label: "XS–XXL", sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
  { label: "One size", sizes: ["ONE"] },
];
const COLOUR_PRESETS: Colour[] = [
  { name: "Black", hex: "#111111" },
  { name: "White", hex: "#f5f5f2" },
  { name: "Grey", hex: "#8a8c91" },
  { name: "Navy", hex: "#1d2a44" },
  { name: "Olive", hex: "#5b5f3a" },
  { name: "Cream", hex: "#ece4d2" },
  { name: "Brown", hex: "#5a3d2b" },
];
const MEASURES = [
  { key: "chest", label: "Chest" },
  { key: "length", label: "Length" },
  { key: "sleeve", label: "Sleeve" },
  { key: "waist", label: "Waist" },
  { key: "inseam", label: "Inseam" },
] as const;
// Which measurements matter, by category: tops vs bottoms vs caps.
const measuresFor = (category: string) =>
  category === "shorts" ? ["waist", "length"] : ["jeans", "trousers", "joggers"].includes(category) ? ["waist", "length", "inseam"] : category === "accessories" ? [] : ["chest", "length", "sleeve"];
const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
const sizeName = (s: Size) => (s === "ONE" ? "One size" : s);

function Step({ n, id, title, note, children }: { n: number; id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={card}>
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink font-mono text-[12px] font-semibold text-paper" aria-hidden>
          {n}
        </span>
        <div>
          <h2 id={`${id}-h`} className="text-[17px] font-semibold leading-7">
            {title}
          </h2>
          {note && <p className="text-[13.5px] text-[#55575c]">{note}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function NewProductForm({ drops, preset = { drop: "" } }: { drops: { slug: string; name: string }[]; /** From "Add a new piece to this drop". */ preset?: { drop: string } }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(addProduct, { status: "idle" });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("tees");
  const [colours, setColours] = useState<Colour[]>([{ name: "Black", hex: "#111111" }]);
  const [sizes, setSizes] = useState<Size[]>(["S", "M", "L", "XL"]);
  const [stock, setStock] = useState<Record<string, string>>({});
  const [fill, setFill] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [publish, setPublish] = useState(false);
  const photo = useRef<HTMLInputElement>(null);

  const measures = MEASURES.filter((m) => measuresFor(category).includes(m.key));
  const shownSizes = SIZES.filter((s) => sizes.includes(s));
  const named = colours.filter((c) => c.name.trim());
  const total = named.reduce((n, c) => n + shownSizes.reduce((m, s) => m + (Number(stock[`${c.name.trim()}:${s}`]) || 0), 0), 0);
  const priceN = Number(price);

  const setColour = (i: number, patch: Partial<Colour>) => setColours((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addColour = (c: Colour) => setColours((cs) => (cs.some((x) => x.name.toLowerCase() === c.name.toLowerCase()) ? cs : [...cs.filter((x) => x.name.trim()), c].slice(0, 20)));
  const pickPhoto = async () => {
    if (!photo.current) return;
    const f = await shrinkPhotoInput(photo.current);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const checks: [string, boolean][] = [
    ["A name", Boolean(name.trim())],
    ["A price", priceN > 0],
    ["A photo", Boolean(preview)],
    ["At least one colour", named.length > 0],
    ["At least one size", shownSizes.length > 0],
    ["Some stock", total > 0],
  ];

  return (
    <form action={action} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <input type="hidden" name="colours" value={JSON.stringify(colours)} />

      <div className="min-w-0 space-y-4">
        <nav aria-label="Steps" className="flex gap-1 overflow-x-auto rounded-full bg-[#f4f4f2] p-1 [scrollbar-width:none]">
          {[
            ["piece", "The piece"],
            ["photo", "Photo"],
            ["variants", "Colours & sizes"],
            ["stock", "Stock"],
            ["publish", "Publish"],
          ].map(([id, l], i) => (
            <a key={id} href={`#${id}`} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] text-[#55575c] hover:bg-white hover:text-ink">
              <span className="font-mono text-[11px] text-[#8a8c91]">{i + 1}</span>
              {l}
            </a>
          ))}
        </nav>

        <Step n={1} id="piece" title="The piece" note="What it is and what it costs.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className={field}>
                Name
              </label>
              <input id="name" name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Boxy Pocket Tee" className={input} />
              {slugOf(name) && <p className="mt-1.5 font-mono text-[12px] text-[#6b6d72]">/product/{slugOf(name)}</p>}
            </div>
            <div>
              <label htmlFor="category" className={field}>
                Category
              </label>
              <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                {Object.entries(categoryLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="price" className={field}>
                Price (Rs, VAT included)
              </label>
              <input id="price" name="price" type="number" inputMode="numeric" min={1} required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1499" className={`${input} font-mono`} />
            </div>
            <div>
              <label htmlFor="fit" className={field}>
                Fit
              </label>
              <select id="fit" name="fit" defaultValue="regular" className={input}>
                <option value="oversized">Oversized</option>
                <option value="relaxed">Relaxed</option>
                <option value="regular">Regular</option>
              </select>
            </div>
            <div>
              <label htmlFor="gender" className={field}>
                For
              </label>
              <select id="gender" name="gender" defaultValue="unisex" className={input}>
                <option value="unisex">Everyone (unisex)</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="drop" className={field}>
                Drop <span className={hint}>(optional)</span>
              </label>
              <select id="drop" name="drop" defaultValue={preset.drop} className={input}>
                <option value="">Not part of a drop</option>
                {drops.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="shortDescription" className={field}>
                One-line description
              </label>
              <input id="shortDescription" name="shortDescription" maxLength={300} placeholder="Heavy cotton, boxy cut, one chest pocket." className={input} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="details" className={field}>
                Details <span className={hint}>(one per line: fabric, weight, care)</span>
              </label>
              <textarea
                id="details"
                name="details"
                rows={4}
                maxLength={4000}
                placeholder={"100% cotton, 240 GSM\nDropped shoulder\nWash cold, inside out"}
                className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-ink"
              />
            </div>
          </div>
        </Step>

        <Step n={2} id="photo" title="Photo" note="A flat-lay on a plain light background, like the others. Big phone photos are shrunk for you.">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              if (photo.current && e.dataTransfer.files.length) {
                photo.current.files = e.dataTransfer.files;
                void pickPhoto();
              }
            }}
            className={`flex cursor-pointer items-center gap-5 rounded-2xl border-2 border-dashed p-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${over ? "border-ink bg-white" : "border-ink/15 bg-white/60 hover:border-ink/40"}`}
          >
            <span className="grid aspect-[4/5] w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-ink/10">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file
                <img src={preview} alt="Photo preview" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6 text-[#8a8c91]" aria-hidden />
              )}
            </span>
            <span>
              <span className="block font-semibold">{preview ? "Photo ready. Tap to change it" : "Drop a photo here, or tap to choose"}</span>
              <span className="mt-1 block text-[13px] text-[#6b6d72]">JPG, PNG or WebP</span>
            </span>
            <input ref={photo} id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={() => void pickPhoto()} className="sr-only" />
          </label>
        </Step>

        <Step n={3} id="variants" title="Colours & sizes" note="Each colour and size becomes its own code, like EP-T012-BLK-M.">
          <p className="text-sm font-semibold">Quick add</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COLOUR_PRESETS.map((c) => {
              const has = colours.some((x) => x.name.toLowerCase() === c.name.toLowerCase());
              return (
                <button
                  key={c.name}
                  type="button"
                  disabled={has}
                  onClick={() => addColour(c)}
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-white px-3 text-[13px] ring-1 ring-ink/10 hover:ring-ink disabled:cursor-default disabled:opacity-40"
                >
                  <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} aria-hidden />
                  {c.name}
                </button>
              );
            })}
          </div>
          <ul className="mt-4 space-y-2">
            {colours.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`ch-${i}`}>
                  Colour {i + 1} swatch
                </label>
                <input id={`ch-${i}`} type="color" value={c.hex} onChange={(e) => setColour(i, { hex: e.target.value })} className="h-11 w-11 shrink-0 cursor-pointer rounded-full border border-ink/15 bg-white p-1" />
                <label className="sr-only" htmlFor={`cn-${i}`}>
                  Colour {i + 1} name
                </label>
                <input id={`cn-${i}`} value={c.name} onChange={(e) => setColour(i, { name: e.target.value })} maxLength={30} placeholder="Colour name" className="h-11 min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 outline-none focus:border-ink" />
                {colours.length > 1 && (
                  <button type="button" onClick={() => setColours((cs) => cs.filter((_, j) => j !== i))} className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-[#55575c] hover:bg-white hover:text-ink">
                    <X className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Remove {c.name || `colour ${i + 1}`}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={colours.length >= 20}
            onClick={() => setColours((cs) => [...cs, { name: "", hex: "#888888" }])}
            className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-[13.5px] font-semibold hover:border-ink"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add a colour
          </button>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold">Sizes</legend>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {SIZES.map((s) => (
                <label key={s} className="relative cursor-pointer">
                  <input
                    type="checkbox"
                    name={`size:${s}`}
                    checked={sizes.includes(s)}
                    onChange={(e) => setSizes((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))}
                    className="peer sr-only"
                  />
                  <span className="flex h-10 min-w-12 items-center justify-center rounded-full bg-white px-3.5 font-mono text-[14px] ring-1 ring-ink/10 peer-checked:bg-ink peer-checked:text-paper peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                    {sizeName(s)}
                  </span>
                </label>
              ))}
              <span className="mx-1 h-5 w-px bg-ink/10" aria-hidden />
              {SIZE_SETS.map((set) => (
                <button key={set.label} type="button" onClick={() => setSizes(set.sizes)} className="h-10 cursor-pointer rounded-full px-3 text-[13px] text-[#55575c] underline-offset-2 hover:underline">
                  {set.label}
                </button>
              ))}
            </div>
          </fieldset>

          {measures.length > 0 && shownSizes.length > 0 && (
            <details className="group mt-6 rounded-2xl bg-white p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
                Measurements in cm <span className={hint}>(optional; powers &ldquo;Your size in cm&rdquo; and the hang tag)</span>
                <Plus className="h-4 w-4 shrink-0 transition-transform group-open:rotate-45" aria-hidden />
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[360px] text-[15px]">
                  <thead className="text-[13px] text-[#6b6d72]">
                    <tr>
                      <th className="py-2 pr-3 text-left font-normal">Size</th>
                      {measures.map((m) => (
                        <th key={m.key} className="px-1 py-2 font-normal">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shownSizes.map((s) => (
                      <tr key={s}>
                        <th scope="row" className="py-1 pr-3 text-left font-mono font-normal">
                          {s}
                        </th>
                        {measures.map((m) => (
                          <td key={m.key} className="px-1 py-1">
                            <input name={`m:${s}:${m.key}`} type="number" inputMode="numeric" min={1} aria-label={`${s} ${m.label} in cm`} className={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </Step>

        <Step n={4} id="stock" title="Starting stock" note="How many of each are tagged and on the rack. You can add more later.">
          {shownSizes.length > 0 && named.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="fill" className="text-[13.5px] text-[#55575c]">
                  Same number everywhere
                </label>
                <input id="fill" type="number" inputMode="numeric" min={0} value={fill} onChange={(e) => setFill(e.target.value)} placeholder="5" className={cell} />
                <button
                  type="button"
                  onClick={() => setStock(Object.fromEntries(named.flatMap((c) => shownSizes.map((s) => [`${c.name.trim()}:${s}`, fill || "0"]))))}
                  className="h-10 cursor-pointer rounded-full bg-white px-4 text-[13px] font-semibold ring-1 ring-ink/10 hover:ring-ink"
                >
                  Fill all
                </button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[360px] border-separate border-spacing-y-1.5 text-[15px]">
                  <thead className="text-[13px] text-[#6b6d72]">
                    <tr>
                      <th className="py-1 pl-3 pr-3 text-left font-normal">Colour</th>
                      {shownSizes.map((s) => (
                        <th key={s} className="px-1 py-1 font-normal">
                          {sizeName(s)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {named.map((c) => (
                      <tr key={c.name} className="bg-white [&>*:first-child]:rounded-l-2xl [&>*:last-child]:rounded-r-2xl">
                        <th scope="row" className="py-2 pl-3 pr-3 text-left font-normal">
                          <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} aria-hidden />
                            {c.name}
                          </span>
                        </th>
                        {shownSizes.map((s) => {
                          const k = `${c.name.trim()}:${s}`;
                          return (
                            <td key={s} className="px-1 py-2">
                              <input
                                name={`stock:${c.name.trim()}:${s}`}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={stock[k] ?? "0"}
                                onChange={(e) => setStock((cur) => ({ ...cur, [k]: e.target.value }))}
                                aria-label={`${c.name} ${s} stock`}
                                className={cell}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-[14px] text-[#55575c]">Name a colour and tick a size first.</p>
          )}
        </Step>

        <Step n={5} id="publish" title="Publish">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
            <input type="checkbox" name="publish" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#0a0a0a]" />
            <span>
              <span className="font-semibold">Put it live now</span>
              <span className="block text-[13.5px] text-[#6b6d72]">Otherwise it&apos;s saved as a hidden draft. In a drop that hasn&apos;t started yet, it waits for the drop.</span>
            </span>
          </label>
        </Step>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24" aria-label="Preview">
        <div className="rounded-[24px] bg-[#f4f4f2] p-2">
          <div className="grid aspect-[4/5] place-items-center overflow-hidden rounded-[18px] bg-white">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[13px] text-[#8a8c91]">No photo yet</span>
            )}
          </div>
          <div className="px-3 pb-2 pt-3">
            <p className="truncate font-semibold">{name.trim() || "New piece"}</p>
            <p className="font-mono text-[14px]">{priceN > 0 ? formatPrice(priceN) : "Rs —"}</p>
            <p className="mt-2 flex gap-1">
              {named.map((c) => (
                <span key={c.name} title={c.name} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} />
              ))}
            </p>
            <p className="mt-2 text-[12.5px] text-[#6b6d72]">
              {shownSizes.map(sizeName).join(" · ") || "No sizes"} · {total} in stock
            </p>
          </div>
        </div>

        <div className="rounded-[24px] bg-[#f4f4f2] p-5">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]">Ready?</p>
          <ul className="mt-3 space-y-2 text-[14px]">
            {checks.map(([l, ok]) => (
              <li key={l} className={`flex items-center gap-2.5 ${ok ? "" : "text-[#6b6d72]"}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full ${ok ? "bg-ink text-paper" : "ring-1 ring-ink/20"}`} aria-hidden>
                  {ok && <Check className="h-3 w-3" />}
                </span>
                {l}
                <span className="sr-only">{ok ? "done" : "not yet"}</span>
              </li>
            ))}
          </ul>
          <button type="submit" disabled={pending} className="mt-5 h-12 w-full cursor-pointer rounded-full bg-ink text-[14.5px] font-semibold text-paper hover:bg-graphite disabled:opacity-50">
            {pending ? "Adding…" : publish ? "Add and put live" : "Add product"}
          </button>
          <p role="alert" className="mt-2 text-[13.5px] text-[#d70015] empty:hidden">
            {state.status === "error" ? state.message : ""}
          </p>
        </div>
      </aside>
    </form>
  );
}
