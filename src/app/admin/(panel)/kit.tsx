"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

// Shared pieces for the admin's settings pages (owner, 18 Oct 2026: "everything controllable from
// admin, easy to operate"): one look for every card, field, switch, list row and save bar, so each
// new page is quick to make and the same to use.

export const card = "rounded-[24px] bg-[#f4f4f2] p-5 md:p-6";
export const input = "mt-1.5 h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-[15px] outline-none focus:border-ink";
export const area = "mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-ink";
export const eyebrow = "font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]";

export function PageHead({ group, title, lead, children }: { group: string; title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className={eyebrow}>{group}</p>
        <h1 className="mt-1 text-[40px] font-light leading-none tracking-[-0.02em]">{title}</h1>
        {lead && <p className="mt-2 text-[14px] text-[#55575c]">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, note, children, id }: { title: string; note?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} aria-label={title} className={`${card} scroll-mt-24`}>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {note && <p className="mt-1 max-w-2xl text-[13.5px] text-[#55575c]">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Text({ label, value, onChange, hint, max = 140, long = false, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; max?: number; long?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold">
        {label} {hint && <span className="font-normal text-[#6b6d72]">({hint})</span>}
      </span>
      {long ? (
        <textarea value={value} maxLength={max} rows={3} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={area} />
      ) : (
        <input value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={input} />
      )}
    </label>
  );
}

export function Num({ label, value, onChange, min, max, step = 1, hint }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold">
        {label} {hint && <span className="font-normal text-[#6b6d72]">({hint})</span>}
      </span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className={`${input} font-mono`} />
    </label>
  );
}

export function Switch({ label, on, onChange, note }: { label: string; on: boolean; onChange: (v: boolean) => void; note?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="text-[14.5px] font-semibold">{label}</span>
        {note && <span className="block text-[12.5px] text-[#6b6d72]">{note}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-ink/20 transition-colors peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Up / down / remove buttons for a row in an ordered list. */
export function RowTools({ i, n, onMove, onRemove, name }: { i: number; n: number; onMove: (from: number, to: number) => void; onRemove?: () => void; name: string }) {
  const b = "grid h-9 w-9 cursor-pointer place-items-center rounded-full text-[#55575c] hover:bg-ink/[0.07] hover:text-ink disabled:cursor-default disabled:opacity-30";
  return (
    <span className="flex shrink-0 items-center">
      <button type="button" disabled={i === 0} onClick={() => onMove(i, i - 1)} className={b} aria-label={`Move ${name} up`}>
        <ArrowUp className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" disabled={i === n - 1} onClick={() => onMove(i, i + 1)} className={b} aria-label={`Move ${name} down`}>
        <ArrowDown className="h-4 w-4" aria-hidden />
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} className={b} aria-label={`Remove ${name}`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      )}
    </span>
  );
}

export function AddButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-[13.5px] font-semibold hover:border-ink disabled:opacity-40">
      <Plus className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}

/** Moves an item in a list (for RowTools). */
export function moved<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

/** The sticky save bar: the button, what happened, and a reset to the saved version. */
export function SaveBar({ pending, dirty, message, error, onReset }: { pending: boolean; dirty: boolean; message?: string; error?: boolean; onReset?: () => void }) {
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-full bg-white/90 py-2 pl-2 pr-5 shadow-[0_12px_30px_-14px_rgba(0,0,0,0.35)] ring-1 ring-ink/10 backdrop-blur">
      <button type="submit" disabled={pending} className="h-11 min-w-32 cursor-pointer rounded-full bg-ink px-6 text-[14px] font-semibold text-paper hover:bg-graphite disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
      {dirty && onReset && (
        <button type="button" onClick={onReset} className="h-11 cursor-pointer px-2 text-[13.5px] font-semibold text-[#55575c] underline-offset-4 hover:underline">
          Undo changes
        </button>
      )}
      <p role="status" className={`text-[14px] ${error ? "text-[#d70015]" : "text-[#55575c]"}`}>
        {pending ? "" : dirty ? "Unsaved changes" : (message ?? "")}
      </p>
    </div>
  );
}
