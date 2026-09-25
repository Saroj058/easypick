"use client";

import { useActionState, useState } from "react";

import { adjustStock, type SaveState } from "@/app/admin/actions";
import { SIZE_ORDER } from "@/lib/inventory";
import type { Product } from "@/lib/types";

const reasons = [
  { value: "received", label: "Received (new pieces tagged)" },
  { value: "count", label: "Count correction" },
  { value: "returned", label: "Returned to stock" },
  { value: "damaged", label: "Damaged or lost" },
];

/**
 * Stock changes as + or − with a reason, never an absolute number, so a sale made while
 * this page was open is never overwritten. Every change is kept in the stock history.
 */
export function StockForm({ product, demand }: { product: Product; demand: Record<string, number> }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(adjustStock, { status: "idle" });
  const [round, setRound] = useState(0);
  const sizes = SIZE_ORDER.filter((s) => product.variants.some((v) => v.size === s));

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setRound((r) => r + 1); // clear the + / − boxes after saving
      }}
      className="space-y-5"
      aria-labelledby="stock-h"
    >
      <input type="hidden" name="slug" value={product.slug} />
      <div>
        <h3 id="stock-h" className="text-lg font-semibold">
          Stock
        </h3>
        <p className="mt-1 text-[14px] text-steel-dark">
          Type how many to add (5) or take off (−2) for each size. Online orders take stock off by themselves. When a size goes from 0 to more,
          everyone waiting is told.
        </p>
      </div>
      <div className="overflow-x-auto">
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
                      <span className={`block font-mono text-[18px] tabular-nums ${v.stock === 0 ? "text-[#d70015]" : ""}`}>{v.stock}</span>
                      <label className="sr-only" htmlFor={`adj-${v.sku}`}>
                        Change {c.name} {s} by
                      </label>
                      <input
                        key={round}
                        id={`adj-${v.sku}`}
                        name={`adj:${v.sku}`}
                        type="number"
                        inputMode="numeric"
                        step={1}
                        placeholder="±0"
                        className="mt-1 h-11 w-16 rounded-[2px] border border-mist text-center font-mono tabular-nums outline-none focus:border-ink"
                      />
                      {asked > 0 && <span className="mt-1 block text-[11px] text-steel-dark">{asked} waiting</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="st-reason" className="block text-sm font-semibold">
            Why
          </label>
          <select id="st-reason" name="reason" defaultValue="received" className="mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-3">
            {reasons.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="st-note" className="block text-sm font-semibold">
            Note <span className="font-normal text-steel-dark">(optional)</span>
          </label>
          <input id="st-note" name="note" placeholder="e.g. Drop 02 delivery" className="mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn btn-ink min-w-40">
          {pending ? "Saving…" : "Update stock"}
        </button>
        <p role="status" className={`text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-steel-dark"}`}>
          {state.status === "idle" ? "" : state.message}
        </p>
      </div>
    </form>
  );
}
