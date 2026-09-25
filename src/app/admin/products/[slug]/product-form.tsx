"use client";

import { useActionState } from "react";

import type { Product } from "@/lib/types";
import { saveProduct, type SaveState } from "../../actions";

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink";
const statuses = [
  { value: "live", label: "Live", note: "On the website and kiosk" },
  { value: "scheduled", label: "Scheduled", note: "Shown as coming soon until its drop" },
  { value: "sold_out", label: "Sold out", note: "Shown, but can't be bought" },
  { value: "draft", label: "Draft", note: "Hidden" },
  { value: "archived", label: "Archived", note: "Hidden, kept for records" },
];

export function ProductForm({ product, demand }: { product: Product; demand: Record<string, number> }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProduct, { status: "idle" });
  const sizes = Array.from(new Set(product.variants.map((v) => v.size)));

  return (
    <form action={action} className="mt-8 space-y-10">
      <input type="hidden" name="slug" value={product.slug} />

      <section aria-labelledby="stock-h">
        <h3 id="stock-h" className="text-lg font-semibold">
          Stock
        </h3>
        <p className="mt-1 text-[14px] text-steel-dark">
          Pieces tagged and on hand. Paid orders take stock off by themselves. When a size goes from 0 to more, everyone who asked is told
          it&apos;s back.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[15px]">
            <thead className="text-[13px] text-steel-dark">
              <tr className="border-b border-mist">
                <th className="py-2 font-normal">Colour</th>
                {sizes.map((s) => (
                  <th key={s} className="px-1 py-2 text-center font-normal">
                    {s === "ONE" ? "One size" : s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {product.colours.map((c) => (
                <tr key={c.name} className="border-b border-mist">
                  <th scope="row" className="py-3 pr-3 font-normal">
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 shrink-0 rounded-full border border-black/10" style={{ background: c.hex }} aria-hidden />
                      {c.name}
                    </span>
                  </th>
                  {sizes.map((s) => {
                    const v = product.variants.find((x) => x.size === s && x.colour === c.name);
                    if (!v) return <td key={s} />;
                    const asked = demand[v.sku] ?? 0;
                    return (
                      <td key={s} className="px-1 py-2 text-center align-top">
                        <label className="sr-only" htmlFor={`st-${v.sku}`}>
                          {c.name} {s} stock
                        </label>
                        <input
                          id={`st-${v.sku}`}
                          name={`stock:${v.sku}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          defaultValue={v.stock}
                          className="h-11 w-16 rounded-[2px] border border-mist text-center font-mono tabular-nums outline-none focus:border-ink"
                        />
                        {asked > 0 && <span className="mt-1 block text-[11px] text-steel-dark">{asked} asked</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="price-h" className="grid gap-4 sm:grid-cols-2">
        <h3 id="price-h" className="text-lg font-semibold sm:col-span-2">
          Price
        </h3>
        <div>
          <label htmlFor="price" className="block text-sm font-semibold">
            Price (Rs, VAT included)
          </label>
          <input id="price" name="price" type="number" inputMode="numeric" min={1} defaultValue={product.price} required className={`${input} font-mono`} />
        </div>
        <div>
          <label htmlFor="salePrice" className="block text-sm font-semibold">
            Sale price <span className="font-normal text-steel-dark">(optional)</span>
          </label>
          <input id="salePrice" name="salePrice" type="number" inputMode="numeric" min={1} defaultValue={product.salePrice ?? ""} className={`${input} font-mono`} />
        </div>
      </section>

      <fieldset>
        <legend className="text-lg font-semibold">Status</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {statuses.map((s) => (
            <label key={s.value} className="relative block cursor-pointer">
              <input type="radio" name="status" value={s.value} defaultChecked={product.status === s.value} className="peer sr-only" />
              <span className="flex min-h-[60px] flex-col justify-center rounded-[2px] border border-mist px-4 py-2 peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                <span className="font-semibold">{s.label}</span>
                <span className="text-[13px] text-steel-dark">{s.note}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="shortDescription" className="block text-lg font-semibold">
          One-line description
        </label>
        <input id="shortDescription" name="shortDescription" defaultValue={product.shortDescription} className={input} />
      </div>

      <div className="sticky bottom-20 flex items-center gap-4 border-t border-mist bg-paper py-3 lg:bottom-0">
        <button type="submit" disabled={pending} className="btn btn-volt min-w-40">
          {pending ? "Saving…" : "Save"}
        </button>
        <p role="status" className={`text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-steel-dark"}`}>
          {state.status === "idle" ? "" : state.message}
        </p>
      </div>
    </form>
  );
}
