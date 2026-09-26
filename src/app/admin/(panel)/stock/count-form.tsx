"use client";

import { useActionState } from "react";

import { bulkCount, type CountState } from "@/app/admin/actions";

/** Paste "SKU,count" lines, see what would change, then apply. */
export function CountForm() {
  const [state, action, pending] = useActionState<CountState, FormData>(bulkCount, { status: "idle" });
  const text = state.status === "preview" ? state.text : "";

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-4">
        <label htmlFor="counts" className="block text-sm font-semibold">
          Counted stock
        </label>
        <textarea
          id="counts"
          name="counts"
          key={state.status === "saved" ? "done" : "edit"}
          defaultValue={text}
          rows={10}
          spellCheck={false}
          placeholder={"HOD01-BLA-M,4\nHOD01-BLA-L,2\nTEE03-WHI-S,0"}
          aria-describedby="counts-hint"
          className="w-full rounded-[2px] border border-mist bg-paper p-4 font-mono text-[14px] outline-none placeholder:text-steel-dark focus:border-ink"
        />
        <p id="counts-hint" className="text-[13px] text-steel-dark">
          One size per line: SKU, a comma (or tab, from a spreadsheet), and every piece in the shop: on the floor, in the back, and packed for orders
          not yet collected. Sizes you leave out aren&apos;t changed.
        </p>
        <button type="submit" disabled={pending} className="btn btn-outline">
          {pending ? "Checking…" : "Check the differences"}
        </button>
      </form>

      {state.status === "error" && (
        <p role="alert" className="text-[14px] text-[#d70015]">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <div role="status" className="bg-photo px-4 py-3 text-[15px]">
          <p>{state.message}</p>
          {state.problems.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-[14px] text-[#9b0010]">
              {state.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.status === "preview" && (
        <section aria-labelledby="diff-h" className="border-t border-mist pt-6">
          <h3 id="diff-h" className="text-lg font-semibold">
            {state.rows.length ? `${state.rows.length} ${state.rows.length === 1 ? "size is" : "sizes are"} different` : "Everything matches"}
          </h3>
          {state.unknown.length > 0 && (
            <p className="mt-2 text-[14px] text-[#9b0010]">
              Not found (check the SKU): <span className="font-mono">{state.unknown.join(", ")}</span>
            </p>
          )}
          {state.bad.length > 0 && (
            <div className="mt-2 text-[14px] text-[#9b0010]">
              <p>Couldn&apos;t read {state.bad.length === 1 ? "this line" : "these lines"} (the count must be a whole number, 0 or more), so nothing changes for them:</p>
              <ul className="mt-1 list-disc pl-5 font-mono text-[13px]">
                {state.bad.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}
          {state.duplicates.length > 0 && (
            <p className="mt-2 text-[14px] text-[#9b0010]">
              In the list more than once (the last line is used): <span className="font-mono">{state.duplicates.join(", ")}</span>
            </p>
          )}
          {state.short.length > 0 && (
            <div className="mt-2 text-[14px] text-[#9b0010]">
              <p>Fewer counted than are held for orders. Find the missing pieces before packing these orders:</p>
              <ul className="mt-1 list-disc pl-5">
                {state.short.map((s) => (
                  <li key={s.sku}>
                    {s.name} <span className="font-mono text-[12px]">{s.sku}</span>: counted {s.counted}, held {s.held}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {state.rows.length > 0 && (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[14px]">
                  <thead className="text-[12px] text-steel-dark">
                    <tr className="border-b border-mist">
                      <th className="py-2 font-normal">Size</th>
                      <th className="py-2 text-right font-normal">Counted</th>
                      <th className="py-2 text-right font-normal">Held for orders</th>
                      <th className="py-2 text-right font-normal">For sale now</th>
                      <th className="py-2 text-right font-normal">New for sale</th>
                      <th className="py-2 text-right font-normal">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.rows.map((r) => (
                      <tr key={r.sku} className="border-b border-mist">
                        <td className="py-2">
                          {r.name} <span className="font-mono text-[12px] text-steel-dark">{r.sku}</span>
                        </td>
                        <td className="py-2 text-right font-mono">{r.counted}</td>
                        <td className="py-2 text-right font-mono">{r.held}</td>
                        <td className="py-2 text-right font-mono">{r.now}</td>
                        <td className="py-2 text-right font-mono">{r.target}</td>
                        <td className={`py-2 text-right font-mono ${r.delta < 0 ? "text-[#d70015]" : "text-[#1f7a3d]"}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form action={action} className="mt-5">
                {/* Exactly the changes shown; a size whose stock moves before you apply is left alone. */}
                <input type="hidden" name="plan" value={state.plan} />
                <input type="hidden" name="apply" value="1" />
                <button type="submit" disabled={pending} className="btn btn-ink">
                  {pending ? "Saving…" : `Apply ${state.rows.length} ${state.rows.length === 1 ? "change" : "changes"}`}
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </div>
  );
}
