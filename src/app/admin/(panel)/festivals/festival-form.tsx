"use client";

import { useActionState, useState } from "react";

import type { Festival } from "@/lib/types";
import { formatBS } from "@/lib/nepali-date";
import { saveFestivalList, type SaveState } from "@/app/admin/actions";

const input = "mt-1 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-3 text-base outline-none focus:border-ink";

type Row = { key: number; name: string; date: string; orderBy: string };

export function FestivalForm({ initial }: { initial: Festival[] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveFestivalList, { status: "idle" });
  const [rows, setRows] = useState<Row[]>(
    initial.length ? initial.map((f, i) => ({ key: i, name: f.name, date: f.date, orderBy: f.orderBy })) : [{ key: 0, name: "", date: "", orderBy: "" }],
  );
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const bs = (d: string) => (d ? formatBS(new Date(`${d}T12:00:00+05:45`)) : "");

  return (
    <form action={action} className="mt-8 space-y-6">
      <ul className="space-y-4">
        {rows.map((r, i) => (
          <li key={r.key} className="grid gap-3 border border-mist p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor={`fn-${r.key}`} className="text-sm font-semibold">
                Festival
              </label>
              <input id={`fn-${r.key}`} name="name" value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Dashain (Tika)" className={input} />
            </div>
            <div>
              <label htmlFor={`fd-${r.key}`} className="text-sm font-semibold">
                Festival day
              </label>
              <input id={`fd-${r.key}`} name="date" type="date" value={r.date} onChange={(e) => set(r.key, { date: e.target.value })} className={input} />
              <p className="mt-1 min-h-4 text-[12px] text-steel-dark">{bs(r.date)}</p>
            </div>
            <div>
              <label htmlFor={`fo-${r.key}`} className="text-sm font-semibold">
                Order by
              </label>
              <input id={`fo-${r.key}`} name="orderBy" type="date" value={r.orderBy} onChange={(e) => set(r.key, { orderBy: e.target.value })} className={input} />
              <p className="mt-1 min-h-4 text-[12px] text-steel-dark">{bs(r.orderBy)}</p>
            </div>
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              className="min-h-11 self-center text-[14px] underline sm:mb-5"
              aria-label={`Remove festival ${i + 1}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setRows((rs) => [...rs, { key: Date.now(), name: "", date: "", orderBy: "" }])} className="btn btn-outline">
        Add a festival
      </button>
      <div className="flex items-center gap-4">
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
