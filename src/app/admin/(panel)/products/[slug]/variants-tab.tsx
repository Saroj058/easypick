"use client";

import { useActionState, useState } from "react";

import type { SaveState } from "@/app/admin/actions";
import { measurementsAction, variantsAction } from "@/app/admin/product-actions";
import type { Product, Size } from "@/lib/types";
import { Card, input } from "../../kit";

const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL", "ONE"];
const MEASURES = [
  { key: "chest", label: "Chest" },
  { key: "length", label: "Length" },
  { key: "sleeve", label: "Sleeve" },
  { key: "waist", label: "Waist" },
  { key: "inseam", label: "Inseam" },
] as const;
const sizeName = (s: Size) => (s === "ONE" ? "One size" : s);

function Status({ state, pending }: { state: SaveState; pending: boolean }) {
  return (
    <p role="status" className={`text-[13.5px] ${state.status === "error" ? "text-[#d70015]" : "text-[#55575c]"}`}>
      {pending ? "Saving…" : state.status === "idle" ? "" : state.message}
    </p>
  );
}

/** One colour row: rename it or change its swatch, or remove it when nothing was ever sold. */
function ColourRow({ slug, name, hex, stock, onlyOne }: { slug: string; name: string; hex: string; stock: number; onlyOne: boolean }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(variantsAction, { status: "idle" });
  const [n, setN] = useState(name);
  const [h, setH] = useState(hex);
  return (
    <li className="rounded-2xl bg-white p-3">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="from" value={name} />
        <input aria-label={`${name} swatch`} type="color" name="hex" value={h} onChange={(e) => setH(e.target.value)} className="h-10 w-10 shrink-0 cursor-pointer rounded-full border border-ink/15 bg-white p-1" />
        <input aria-label={`${name} name`} name="name" value={n} maxLength={30} onChange={(e) => setN(e.target.value)} className="h-10 min-w-0 flex-1 rounded-full border border-ink/15 px-4 text-[14px] outline-none focus:border-ink" />
        <span className="font-mono text-[12px] text-[#6b6d72]">{stock} in stock</span>
        {(n !== name || h !== hex) && (
          <button type="submit" name="op" value="editColour" className="h-10 cursor-pointer rounded-full bg-ink px-4 text-[13px] font-semibold text-paper">
            Save
          </button>
        )}
        {!onlyOne && (
          <button type="submit" name="op" value="removeColour" className="h-10 cursor-pointer rounded-full px-3 text-[13px] text-[#55575c] underline-offset-4 hover:underline">
            Remove
          </button>
        )}
        <input type="hidden" name="colour" value={name} />
      </form>
      <Status state={state} pending={pending} />
    </li>
  );
}

/**
 * Colours, sizes and measurements after a piece was made (owner, 18 Oct 2026). New ones start with
 * no stock; a colour or size that was ever sold, stocked or asked for stays for the records.
 */
export function VariantsTab({ product }: { product: Product }) {
  const [add, addAction, adding] = useActionState<SaveState, FormData>(variantsAction, { status: "idle" });
  const [sizeState, sizeAction, sizing] = useActionState<SaveState, FormData>(variantsAction, { status: "idle" });
  const [mState, mAction, measuring] = useActionState<SaveState, FormData>(measurementsAction, { status: "idle" });
  const sizes = SIZES.filter((s) => product.variants.some((v) => v.size === s));
  const stockOf = (f: (v: Product["variants"][number]) => boolean) => product.variants.filter(f).reduce((n, v) => n + v.stock, 0);
  const shown = MEASURES.filter((m) => sizes.some((s) => product.measurements[s]?.[m.key] !== undefined)).map((m) => m.key);
  const [cols, setCols] = useState<string[]>(shown.length ? shown : product.category === "accessories" ? [] : ["jeans", "trousers", "joggers", "shorts"].includes(product.category) ? ["waist", "length", "inseam"] : ["chest", "length", "sleeve"]);

  return (
    <div className="space-y-4">
      <Card title="Colours" note="Rename a colour or change its swatch: its sizes, codes and anyone waiting for it follow.">
        <ul className="space-y-2">
          {product.colours.map((c, i) => (
            // By place, so a rename keeps the row (and its message).
            <ColourRow key={`${i}-${product.colours.length}`} slug={product.slug} name={c.name} hex={c.hex} stock={stockOf((v) => v.colour === c.name)} onlyOne={product.colours.length === 1} />
          ))}
        </ul>
        <form action={addAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="slug" value={product.slug} />
          <input type="hidden" name="op" value="addColour" />
          <label className="block">
            <span className="text-[13px] font-semibold">New colour</span>
            <input name="name" maxLength={30} required placeholder="e.g. Olive" className={`${input} w-48`} />
          </label>
          <input aria-label="New colour swatch" type="color" name="hex" defaultValue="#888888" className="h-11 w-11 cursor-pointer rounded-full border border-ink/15 bg-white p-1" />
          <button type="submit" className="h-11 cursor-pointer rounded-full bg-ink px-5 text-[13.5px] font-semibold text-paper">
            Add colour
          </button>
          <Status state={add} pending={adding} />
        </form>
      </Card>

      <Card title="Sizes" note="Tap a size to add it in every colour, or the × to remove it.">
        <form action={sizeAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="slug" value={product.slug} />
          {SIZES.map((s) => {
            const has = sizes.includes(s);
            return has ? (
              <span key={s} className="inline-flex h-10 items-center gap-1 rounded-full bg-ink pl-4 pr-1 font-mono text-[13px] text-paper">
                {sizeName(s)} <span className="text-paper/60">· {stockOf((v) => v.size === s)}</span>
                {sizes.length > 1 && (
                  <button type="submit" name="size" value={s} onClick={(e) => ((e.currentTarget.form!.elements.namedItem("op") as HTMLInputElement).value = "removeSize")} aria-label={`Remove size ${sizeName(s)}`} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full hover:bg-white/15">
                    ×
                  </button>
                )}
              </span>
            ) : (
              <button key={s} type="submit" name="size" value={s} onClick={(e) => ((e.currentTarget.form!.elements.namedItem("op") as HTMLInputElement).value = "addSize")} className="h-10 cursor-pointer rounded-full border border-dashed border-ink/30 px-4 font-mono text-[13px] text-[#55575c] hover:border-ink hover:text-ink">
                + {sizeName(s)}
              </button>
            );
          })}
          <input type="hidden" name="op" defaultValue="addSize" />
        </form>
        <div className="mt-2">
          <Status state={sizeState} pending={sizing} />
        </div>
      </Card>

      <Card title="Measurements (cm)" note="Measured flat on the garment. They power the size chart, “Your size in cm” and the hang tag.">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {MEASURES.map((m) => {
            const on = cols.includes(m.key);
            return (
              <button key={m.key} type="button" aria-pressed={on} onClick={() => setCols((c) => (on ? c.filter((x) => x !== m.key) : [...c, m.key]))} className={`h-8 cursor-pointer rounded-full px-3 text-[12.5px] ${on ? "bg-ink text-paper" : "border border-ink/15 hover:border-ink"}`}>
                {m.label}
              </button>
            );
          })}
        </div>
        {cols.length === 0 ? (
          <p className="text-[14px] text-[#55575c]">No measurements (e.g. caps). Tap one above to add a column.</p>
        ) : (
          <form action={mAction}>
            <input type="hidden" name="slug" value={product.slug} />
            <div className="overflow-x-auto">
              <table className="min-w-[360px] border-separate border-spacing-y-1.5 text-[14px]">
                <thead className="text-[12.5px] text-[#6b6d72]">
                  <tr>
                    <th className="py-1 pr-3 text-left font-normal">Size</th>
                    {MEASURES.filter((m) => cols.includes(m.key)).map((m) => (
                      <th key={m.key} className="px-1 py-1 font-normal">
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((s) => (
                    <tr key={s}>
                      <th scope="row" className="pr-3 text-left font-mono font-normal">
                        {sizeName(s)}
                      </th>
                      {MEASURES.filter((m) => cols.includes(m.key)).map((m) => (
                        <td key={m.key} className="px-1">
                          <input name={`m:${s}:${m.key}`} type="number" min={1} max={500} defaultValue={product.measurements[s]?.[m.key] ?? ""} aria-label={`${sizeName(s)} ${m.label} in cm`} className="h-10 w-16 rounded-xl border border-ink/15 bg-white text-center font-mono outline-none focus:border-ink" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button type="submit" disabled={measuring} className="h-11 cursor-pointer rounded-full bg-ink px-6 text-[14px] font-semibold text-paper disabled:opacity-50">
                Save measurements
              </button>
              <Status state={mState} pending={measuring} />
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
