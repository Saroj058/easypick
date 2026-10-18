"use client";

import { useActionState, useState } from "react";

import { saveOffersAction, type SaveState } from "@/app/admin/actions";
import { MAX_OFFERS, OFFER_GROUPS, type Offer } from "@/lib/offer-rules";
import { categoryLabels } from "@/lib/site";
import type { Category } from "@/lib/types";

const input = "mt-1 h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-[15px] outline-none focus:border-ink";
const label = "text-[13px] font-semibold";

type Row = Offer & { key: number; by: "tag" | "under" | "kinds" | "all" };

/** Up to three named offers: what they're called, which pieces (a tag, a price ceiling, or every sale piece), until when. */
export function OffersForm({ initial, counts }: { initial: Offer[]; counts: Record<string, number> }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveOffersAction, { status: "idle" });
  const [rows, setRows] = useState<Row[]>(initial.map((o, i) => ({ ...o, key: i, by: o.tag ? "tag" : o.kinds?.length ? "kinds" : o.under ? "under" : "all" })));
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="count" value={rows.length} />
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className={`rounded-[22px] bg-white p-4 ring-1 ring-ink/10 ${r.on ? "" : "opacity-60"}`}>
            <input type="hidden" name={`id-${i}`} value={r.id} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 text-[14px] font-semibold">
                <input type="checkbox" name={`on-${i}`} checked={r.on} onChange={(e) => set(r.key, { on: e.target.checked })} className="h-5 w-5 accent-[#0a0a0a]" />
                Running
              </label>
              <span className="rounded-full bg-[#f4f4f2] px-3 py-1 font-mono text-[12px]">
                {counts[r.id] ?? 0} pieces now · /shop?offer={r.id}
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`on-name-${i}`} className={label}>
                  Name
                </label>
                <input id={`on-name-${i}`} name={`name-${i}`} required maxLength={40} value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} className={input} />
              </div>
              <div>
                <label htmlFor={`on-ends-${i}`} className={label}>
                  Last day <span className="font-normal text-steel-dark">(optional)</span>
                </label>
                <input id={`on-ends-${i}`} name={`endsOn-${i}`} type="date" value={r.endsOn ?? ""} onChange={(e) => set(r.key, { endsOn: e.target.value || null })} className={input} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`on-note-${i}`} className={label}>
                  One line
                </label>
                <input id={`on-note-${i}`} name={`note-${i}`} maxLength={120} value={r.note} onChange={(e) => set(r.key, { note: e.target.value })} className={input} />
              </div>
              <div>
                <label htmlFor={`on-group-${i}`} className={label}>
                  Stack <span className="font-normal text-steel-dark">(left, middle or right)</span>
                </label>
                <select id={`on-group-${i}`} name={`group-${i}`} value={r.group} onChange={(e) => set(r.key, { group: e.target.value })} className={input}>
                  {OFFER_GROUPS.map((g, n) => (
                    <option key={g} value={g}>
                      {g} ({["left", "middle", "right"][n]})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`on-by-${i}`} className={label}>
                  Which pieces
                </label>
                <select id={`on-by-${i}`} name={`by-${i}`} value={r.by} onChange={(e) => set(r.key, { by: e.target.value as Row["by"] })} className={input}>
                  <option value="tag">Ones I tick on the piece</option>
                  <option value="under">On sale under a price</option>
                  <option value="kinds">On sale, of some kinds</option>
                  <option value="all">Everything on sale</option>
                </select>
              </div>
              {r.by === "tag" && (
                <div>
                  <label htmlFor={`on-tag-${i}`} className={label}>
                    Tick name <span className="font-normal text-steel-dark">(on each product)</span>
                  </label>
                  <input id={`on-tag-${i}`} name={`tag-${i}`} maxLength={30} value={r.tag ?? ""} onChange={(e) => set(r.key, { tag: e.target.value })} placeholder="dashain-offer" className={`${input} font-mono`} />
                </div>
              )}
              {r.by === "kinds" && (
                <fieldset className="sm:col-span-2">
                  <legend className={label}>Kinds</legend>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(Object.keys(categoryLabels) as Category[]).map((k) => {
                      const on = r.kinds?.includes(k) ?? false;
                      return (
                        <label key={k} className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] ${on ? "border-ink bg-ink text-paper" : "border-ink/15 bg-white hover:border-ink"}`}>
                          <input
                            type="checkbox"
                            name={`kinds-${i}`}
                            value={k}
                            checked={on}
                            onChange={(e) => set(r.key, { kinds: e.target.checked ? [...(r.kinds ?? []), k] : (r.kinds ?? []).filter((x) => x !== k) })}
                            className="sr-only"
                          />
                          {categoryLabels[k]}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              {r.by === "under" && (
                <div>
                  <label htmlFor={`on-under-${i}`} className={label}>
                    Under Rs
                  </label>
                  <input id={`on-under-${i}`} name={`under-${i}`} type="number" min={1} value={r.under ?? ""} onChange={(e) => set(r.key, { under: Number(e.target.value) || null })} className={`${input} font-mono`} />
                </div>
              )}
            </div>
            <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="mt-3 text-[13px] text-steel-dark underline underline-offset-2 hover:text-ink">
              Remove this offer
            </button>
          </li>
        ))}
      </ul>
      {rows.length < MAX_OFFERS && (
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { key: Date.now(), id: "", name: "", note: "", group: OFFER_GROUPS[0], tag: null, kinds: null, under: null, endsOn: null, on: true, by: "tag" }])}
          className="h-10 rounded-full border border-ink/15 bg-white px-4 text-[13.5px] font-semibold hover:border-ink"
        >
          Add an offer
        </button>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="h-11 min-w-32 rounded-full bg-ink px-6 text-[14px] font-semibold text-paper disabled:opacity-50">
          {pending ? "Saving…" : "Save offers"}
        </button>
        <p role="status" className={`text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-steel-dark"}`}>
          {state.status === "idle" ? "" : state.message}
        </p>
      </div>
    </form>
  );
}
