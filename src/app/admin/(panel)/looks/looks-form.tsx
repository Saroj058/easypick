"use client";

import { startTransition, useActionState } from "react";

import type { SaveState } from "@/app/admin/actions";
import { saveLooksForm } from "@/app/admin/looks-actions";
import type { OccasionKey, SavedLooks } from "@/lib/occasions";

export interface PieceOption {
  value: string; // slug~colour
  label: string;
  group: string;
}

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink";

export function LooksForm({
  occasions,
  options,
  saved,
}: {
  occasions: { key: OccasionKey; label: string; place: string }[];
  options: PieceOption[];
  saved: SavedLooks;
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveLooksForm, { status: "idle" });
  const groups = Array.from(new Set(options.map((o) => o.group)));

  return (
    <form
      // Submitted by hand so a failed save keeps the picks (a form action resets the fields).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="mt-8 space-y-10"
    >
      {occasions.map((o) => {
        const mine = saved[o.key];
        return (
          <fieldset key={o.key} className="space-y-4 border-t border-mist pt-6">
            <legend className="text-lg font-semibold">{o.label}</legend>
            {[0, 1, 2].map((i) => {
              const current = mine?.pieces[i];
              return (
                <div key={i}>
                  <label htmlFor={`${o.key}-${i}`} className="block text-sm font-semibold">
                    Piece {i + 1}
                    {i === 2 ? <span className="font-normal text-steel-dark"> (optional)</span> : null}
                  </label>
                  <select id={`${o.key}-${i}`} name={`${o.key}.${i}`} defaultValue={current ? `${current.slug}~${current.colour}` : ""} className={input}>
                    <option value="">{i === 0 && !mine?.pieces.length ? "Let the site pick" : "None"}</option>
                    {groups.map((g) => (
                      <optgroup key={g} label={g}>
                        {options
                          .filter((x) => x.group === g)
                          .map((x) => (
                            <option key={x.value} value={x.value}>
                              {x.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              );
            })}
          </fieldset>
        );
      })}

      <div className="sticky bottom-0 flex items-center gap-4 border-t border-mist bg-paper py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
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
