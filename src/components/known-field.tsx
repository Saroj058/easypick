"use client";

import { useState } from "react";

// A detail we already have for a signed-in customer (their number, their address), shown as one
// line with "Change" instead of a box to fill in again. The value still goes with the form, in
// hidden inputs. "Change" (or a problem with this field) shows the usual inputs, already filled.

export function KnownField({
  label,
  value,
  hidden,
  open = false,
  children,
}: {
  label: string;
  /** What we have, as shown; nothing shown (the inputs instead) when empty. */
  value: string | null | undefined;
  /** The form fields this line stands for, name to value. */
  hidden: Record<string, string>;
  /** Show the inputs anyway (e.g. the server had a problem with this field). */
  open?: boolean;
  /** The usual inputs. */
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (!value || editing || open) return <>{children}</>;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-mist/40 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-steel-dark">{label}</p>
        <p className="truncate text-[15px] font-medium">{value}</p>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="min-h-11 shrink-0 cursor-pointer px-1 text-[13px] font-semibold underline underline-offset-4">
        Change
      </button>
      {Object.entries(hidden).map(([name, v]) => (
        <input key={name} type="hidden" name={name} value={v} />
      ))}
    </div>
  );
}
