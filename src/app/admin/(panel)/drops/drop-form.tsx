"use client";

import { useActionState } from "react";

import { saveDropAction, type SaveState } from "@/app/admin/actions";

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink";
const label = "block text-sm font-semibold";

export type DropFormValue = { slug: string; name: string; story: string; releaseAt: string; products: string[] };

/** Create or edit a drop: number, name, story, release time (Kathmandu) and its pieces. */
export function DropForm({ initial, products, isNew }: { initial: DropFormValue; products: { slug: string; name: string; status: string; dropSlug: string | null }[]; isNew: boolean }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveDropAction, { status: "idle" });
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <div>
          <label htmlFor="d-slug" className={label}>
            Number
          </label>
          <input id="d-slug" name="slug" defaultValue={initial.slug} readOnly={!isNew} required placeholder="08" className={`${input} ${isNew ? "" : "bg-photo"}`} />
        </div>
        <div>
          <label htmlFor="d-name" className={label}>
            Name
          </label>
          <input id="d-name" name="name" defaultValue={initial.name} required placeholder="Drop 08" className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="d-story" className={label}>
          Story <span className="font-normal text-steel-dark">(one or two lines for the drop page)</span>
        </label>
        <textarea id="d-story" name="story" defaultValue={initial.story} rows={3} maxLength={400} className="mt-2 w-full rounded-[2px] border border-mist bg-paper p-4 text-base outline-none focus:border-ink" />
      </div>
      <div>
        <label htmlFor="d-at" className={label}>
          Release (Kathmandu time)
        </label>
        <input id="d-at" name="releaseAt" type="datetime-local" defaultValue={initial.releaseAt} required className={`${input} sm:w-72`} />
        <p className="mt-1 text-[13px] text-steel-dark">Pieces in a drop that hasn&apos;t started yet are shown as coming soon, not for sale.</p>
      </div>
      <fieldset>
        <legend className={label}>Pieces in this drop</legend>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {products.map((p) => (
            <li key={p.slug}>
              <label className="flex min-h-11 items-center gap-3 text-[15px]">
                <input type="checkbox" name="products" value={p.slug} defaultChecked={initial.products.includes(p.slug)} className="h-5 w-5 accent-ink" />
                <span>
                  {p.name}{" "}
                  <span className="text-[13px] text-steel-dark">
                    · {p.status}
                    {p.dropSlug && p.dropSlug !== initial.slug ? ` · in drop ${p.dropSlug}` : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <p role={state.status === "error" ? "alert" : "status"} className={`min-h-5 text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-steel-dark"}`}>
        {state.status === "idle" ? "" : state.message}
      </p>
      <button type="submit" disabled={pending} className="btn btn-ink">
        {pending ? "Saving…" : isNew ? "Create drop" : "Save drop"}
      </button>
    </form>
  );
}
