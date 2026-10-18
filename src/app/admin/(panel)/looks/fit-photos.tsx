"use client";

import { startTransition, useActionState, useRef } from "react";

import type { SaveState } from "@/app/admin/actions";
import { saveFitPhoto } from "@/app/admin/looks-actions";
import type { OccasionKey } from "@/lib/occasions";
import { shrinkPhotoInput } from "../resize-photo";

// A photo of each fit being worn, for the Fits page: the person in the fit, full length, on a
// plain light background. Shown only while the fit is set above (so the photo matches its pieces).

export function FitPhotos({ fits }: { fits: { key: OccasionKey; label: string; photo?: string; set: boolean }[] }) {
  return (
    <section aria-labelledby="fit-photos" className="mt-14 border-t border-ink pt-8">
      <h2 id="fit-photos" className="text-xl font-semibold">
        Fit photos
      </h2>
      <p className="mt-2 text-steel-dark">
        Optional. One photo of someone wearing the fit, head to toe, standing in the middle, on a plain light background (portrait, about 4:5). It shows on the Fits page only while you&apos;ve set
        the fit&apos;s pieces above, so it always matches them.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {fits.map((f) => (
          <FitPhoto key={f.key} fit={f} />
        ))}
      </ul>
    </section>
  );
}

function FitPhoto({ fit }: { fit: { key: OccasionKey; label: string; photo?: string; set: boolean } }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveFitPhoto, { status: "idle" });
  const file = useRef<HTMLInputElement>(null);
  const send = (remove: boolean) => {
    const data = new FormData();
    data.set("key", fit.key);
    if (remove) data.set("remove", "1");
    else if (file.current?.files?.[0]) data.set("photo", file.current.files[0]);
    startTransition(() => action(data));
  };
  return (
    <li className="flex gap-3 border border-mist p-3">
      <div className="h-24 w-[77px] shrink-0 overflow-hidden rounded-xl bg-[#f4f4f2]">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small admin preview */}
        {fit.photo ? <img src={fit.photo} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{fit.label}</p>
        {!fit.set && <p className="text-[12px] text-steel-dark">Set this fit&apos;s pieces above for the photo to show.</p>}
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={`Photo for ${fit.label}`}
          onChange={async (e) => {
            await shrinkPhotoInput(e.currentTarget);
          }}
          className="mt-2 block w-full text-[13px]"
        />
        <div className="mt-2 flex items-center gap-3">
          <button type="button" disabled={pending} onClick={() => send(false)} className="h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-paper disabled:opacity-50">
            {pending ? "Saving…" : fit.photo ? "Replace" : "Upload"}
          </button>
          {fit.photo && (
            <button type="button" disabled={pending} onClick={() => send(true)} className="text-[13px] font-semibold underline underline-offset-2">
              Remove
            </button>
          )}
          <span role="status" className={`text-[12px] ${state.status === "error" ? "text-[#d70015]" : "text-steel-dark"}`}>
            {state.status === "idle" ? "" : state.message}
          </span>
        </div>
      </div>
    </li>
  );
}
