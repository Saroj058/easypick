"use client";

import { useActionState, useState } from "react";

import { categoryLabels } from "@/lib/site";
import type { Colour, Size } from "@/lib/types";
import { addProduct, type SaveState } from "@/app/admin/actions";

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink";
const label = "block text-sm font-semibold";
const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
const MEASURES = [
  { key: "chest", label: "Chest" },
  { key: "length", label: "Length" },
  { key: "sleeve", label: "Sleeve" },
  { key: "waist", label: "Waist" },
  { key: "inseam", label: "Inseam" },
] as const;
// Which measurements matter, by category: tops vs bottoms vs caps.
const measuresFor = (category: string) =>
  category === "bottoms" ? ["waist", "length", "inseam"] : category === "accessories" ? [] : ["chest", "length", "sleeve"];

export function NewProductForm({ drops }: { drops: { slug: string; name: string }[] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(addProduct, { status: "idle" });
  const [category, setCategory] = useState("tees");
  const [colours, setColours] = useState<Colour[]>([{ name: "Black", hex: "#111111" }]);
  const [sizes, setSizes] = useState<Size[]>(["S", "M", "L", "XL"]);
  const [preview, setPreview] = useState<string | null>(null);
  const measures = MEASURES.filter((m) => measuresFor(category).includes(m.key));
  const shownSizes = SIZES.filter((s) => sizes.includes(s));

  const setColour = (i: number, patch: Partial<Colour>) => setColours((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <form action={action} className="mt-8 space-y-10" encType="multipart/form-data">
      <input type="hidden" name="colours" value={JSON.stringify(colours)} />

      <section className="grid gap-4 sm:grid-cols-2" aria-labelledby="basics">
        <h3 id="basics" className="text-lg font-semibold sm:col-span-2">
          The piece
        </h3>
        <div className="sm:col-span-2">
          <label htmlFor="name" className={label}>
            Name
          </label>
          <input id="name" name="name" required placeholder="e.g. Boxy Pocket Tee" className={input} />
        </div>
        <div>
          <label htmlFor="category" className={label}>
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
          <label htmlFor="price" className={label}>
            Price (Rs, VAT included)
          </label>
          <input id="price" name="price" type="number" inputMode="numeric" min={1} required placeholder="1499" className={`${input} font-mono`} />
        </div>
        <div>
          <label htmlFor="fit" className={label}>
            Fit
          </label>
          <select id="fit" name="fit" defaultValue="regular" className={input}>
            <option value="oversized">Oversized</option>
            <option value="relaxed">Relaxed</option>
            <option value="regular">Regular</option>
          </select>
        </div>
        <div>
          <label htmlFor="gender" className={label}>
            For
          </label>
          <select id="gender" name="gender" defaultValue="unisex" className={input}>
            <option value="unisex">Everyone (unisex)</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="drop" className={label}>
            Drop <span className="font-normal text-steel-dark">(optional)</span>
          </label>
          <select id="drop" name="drop" defaultValue="" className={input}>
            <option value="">Not part of a drop</option>
            {drops.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="shortDescription" className={label}>
            One-line description
          </label>
          <input id="shortDescription" name="shortDescription" placeholder="Heavy cotton, boxy cut, one chest pocket." className={input} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="details" className={label}>
            Details <span className="font-normal text-steel-dark">(one per line: fabric, weight, care)</span>
          </label>
          <textarea
            id="details"
            name="details"
            rows={4}
            placeholder={"100% cotton, 240 GSM\nDropped shoulder\nWash cold, inside out"}
            className="mt-2 w-full rounded-[2px] border border-mist bg-paper px-4 py-3 text-base outline-none focus:border-ink"
          />
        </div>
      </section>

      <section aria-labelledby="photo-h">
        <h3 id="photo-h" className="text-lg font-semibold">
          Photo
        </h3>
        <p className="mt-1 text-[14px] text-steel-dark">A flat-lay on a plain light background, like the others. JPG, PNG or WebP, under 8 MB.</p>
        <div className="mt-3 flex items-start gap-4">
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
            className="text-[14px] file:mr-3 file:h-11 file:rounded-[2px] file:border file:border-ink file:bg-paper file:px-4 file:font-semibold"
          />
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file
            <img src={preview} alt="Photo preview" className="h-24 w-20 shrink-0 bg-photo object-cover" />
          )}
        </div>
      </section>

      <section aria-labelledby="colours-h">
        <h3 id="colours-h" className="text-lg font-semibold">
          Colours
        </h3>
        <ul className="mt-3 space-y-2">
          {colours.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`cn-${i}`}>
                Colour {i + 1} name
              </label>
              <input id={`cn-${i}`} value={c.name} onChange={(e) => setColour(i, { name: e.target.value })} placeholder="Colour name" className={`${input} mt-0 flex-1`} />
              <label className="sr-only" htmlFor={`ch-${i}`}>
                Colour {i + 1} swatch
              </label>
              <input id={`ch-${i}`} type="color" value={c.hex} onChange={(e) => setColour(i, { hex: e.target.value })} className="h-[52px] w-14 shrink-0 cursor-pointer rounded-[2px] border border-mist bg-paper p-1" />
              {colours.length > 1 && (
                <button type="button" onClick={() => setColours((cs) => cs.filter((_, j) => j !== i))} className="min-h-11 px-2 text-[14px] underline">
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setColours((cs) => [...cs, { name: "", hex: "#888888" }])} className="btn btn-outline mt-3">
          Add a colour
        </button>
      </section>

      <fieldset>
        <legend className="text-lg font-semibold">Sizes</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <label key={s} className="relative cursor-pointer">
              <input
                type="checkbox"
                name={`size:${s}`}
                checked={sizes.includes(s)}
                onChange={(e) => setSizes((cur) => (e.target.checked ? [...cur, s] : cur.filter((x) => x !== s)))}
                className="peer sr-only"
              />
              <span className="flex h-11 min-w-14 items-center justify-center rounded-[2px] border border-mist px-3 font-mono peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                {s === "ONE" ? "One size" : s}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {measures.length > 0 && shownSizes.length > 0 && (
        <section aria-labelledby="m-h">
          <h3 id="m-h" className="text-lg font-semibold">
            Measurements (cm)
          </h3>
          <p className="mt-1 text-[14px] text-steel-dark">Measured flat on the garment. These power &ldquo;Your size in cm&rdquo; and the hang tag.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[360px] text-[15px]">
              <thead className="text-[13px] text-steel-dark">
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
                        <input
                          name={`m:${s}:${m.key}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          aria-label={`${s} ${m.label} in cm`}
                          className="h-11 w-16 rounded-[2px] border border-mist text-center font-mono outline-none focus:border-ink"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {shownSizes.length > 0 && colours.some((c) => c.name.trim()) && (
        <section aria-labelledby="st-h">
          <h3 id="st-h" className="text-lg font-semibold">
            Starting stock
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[360px] text-[15px]">
              <thead className="text-[13px] text-steel-dark">
                <tr>
                  <th className="py-2 pr-3 text-left font-normal">Colour</th>
                  {shownSizes.map((s) => (
                    <th key={s} className="px-1 py-2 font-normal">
                      {s === "ONE" ? "One size" : s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colours
                  .filter((c) => c.name.trim())
                  .map((c) => (
                    <tr key={c.name}>
                      <th scope="row" className="py-1 pr-3 text-left font-normal">
                        {c.name}
                      </th>
                      {shownSizes.map((s) => (
                        <td key={s} className="px-1 py-1">
                          <input
                            name={`stock:${c.name.trim()}:${s}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            defaultValue={0}
                            aria-label={`${c.name} ${s} stock`}
                            className="h-11 w-16 rounded-[2px] border border-mist text-center font-mono outline-none focus:border-ink"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" name="publish" className="h-5 w-5 accent-[#0a0a0a]" />
        <span>
          <span className="font-semibold">Put it live now</span> <span className="text-steel-dark">(otherwise it&apos;s saved as a hidden draft)</span>
        </span>
      </label>

      <div className="sticky bottom-0 flex items-center gap-4 border-t border-mist bg-paper py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button type="submit" disabled={pending} className="btn btn-volt min-w-44">
          {pending ? "Adding…" : "Add product"}
        </button>
        <p role="alert" className="text-[14px] text-[#d70015]">
          {state.status === "error" ? state.message : ""}
        </p>
      </div>
    </form>
  );
}
