"use client";

import { useActionState, useState } from "react";

import { requestRestock, type RestockState } from "@/app/actions";
import type { Size } from "@/lib/types";
import { useMe, usePrefilled } from "./session";

/** Under the size grid: "Sold out in your size?" → one message when it's back. No account needed. */
export function RestockForm({ slug, options }: { slug: string; options: { sku: string; size: Size }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<RestockState, FormData>(requestRestock, { status: "idle" });
  const me = useMe();
  const contact = usePrefilled(me?.phone);
  if (options.length === 0) return null;

  if (state.status === "done") {
    return (
      <p role="status" className="mt-3 bg-photo px-4 py-3 text-[14px]">
        {state.message}
      </p>
    );
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-[14px] underline underline-offset-4">
          Sold out in your size? Tell me when it&apos;s back
        </button>
      ) : (
        <form action={action} className="border border-mist p-4">
          <input type="hidden" name="slug" value={slug} />
          <p className="text-[14px] font-semibold">We&apos;ll message you once, when it&apos;s back.</p>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Size you want">
            {options.map((o, i) => (
              <label key={o.sku} className="relative cursor-pointer">
                <input type="radio" name="sku" value={o.sku} defaultChecked={i === 0} className="peer sr-only" />
                <span className="flex h-11 min-w-12 items-center justify-center rounded-[2px] border border-mist px-3 font-mono peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                  {o.size === "ONE" ? "One size" : o.size}
                </span>
              </label>
            ))}
          </div>
          <label htmlFor={`rs-${slug}`} className="mt-4 block text-[13px] font-semibold">
            Email or mobile number
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id={`rs-${slug}`}
              name="contact"
              required
              autoComplete="email"
              placeholder="you@email.com or 98XXXXXXXX"
              {...contact}
              className="h-11 min-w-0 flex-1 rounded-[2px] border border-mist bg-paper px-3 outline-none focus:border-ink"
            />
            <button type="submit" disabled={pending} className="btn btn-ink h-11 shrink-0 px-4">
              {pending ? "…" : "Notify me"}
            </button>
          </div>
          <p role="alert" className="mt-1 min-h-5 text-[13px] text-[#d70015]">
            {state.status === "error" ? state.message : ""}
          </p>
        </form>
      )}
    </div>
  );
}
