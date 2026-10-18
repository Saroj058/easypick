"use client";

import { useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";

import type { SaveState } from "@/app/admin/actions";
import { kindPictureAction, saveKindsAction } from "@/app/admin/settings-actions";
import { kindPicture, STAND_IN_PICTURES, type KindSetting } from "@/lib/settings/categories-rules";
import { shrinkPhotoInput } from "../resize-photo";
import { Card, RowTools, SaveBar, Switch, moved } from "../kit";

/** One category's own picture upload (saved straight away). */
function OwnPicture({ id }: { id: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(kindPictureAction, { status: "idle" });
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 text-[12.5px] font-semibold hover:border-ink">
        <ImagePlus className="h-3.5 w-3.5" aria-hidden />
        Own picture
        <input
          name="photo"
          type="file"
          accept="image/png,image/webp,image/jpeg"
          className="sr-only"
          onChange={async (e) => {
            await shrinkPhotoInput(e.target);
            e.target.form?.requestSubmit();
          }}
        />
      </label>
      <span role="status" className={`text-[12px] ${state.status === "error" ? "text-[#d70015]" : "text-[#6b6d72]"}`}>
        {pending ? "Uploading…" : state.status === "idle" ? "" : state.message}
      </span>
    </form>
  );
}

/**
 * The kinds as the shop shows them (owner, 18 Oct 2026): their names, order, pictures, a line about
 * each, and which ones the shop, drops and the rail show.
 */
export function KindsForm({ initial }: { initial: KindSetting[] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveKindsAction, { status: "idle" });
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  // A picture was uploaded: take the saved list, keeping the message.
  const now = JSON.stringify(initial);
  const [seen, setSeen] = useState(now);
  if (seen !== now) {
    setSeen(now);
    setV(initial);
    setSaved(initial);
  }
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const patch = (i: number, p: Partial<KindSetting>) => setV((cur) => cur.map((k, j) => (j === i ? { ...k, ...p } : k)));

  return (
    <div className="space-y-4">
      <form
        action={(fd) => {
          setSaved(v);
          action(fd);
        }}
        className="space-y-4"
      >
        <input type="hidden" name="data" value={JSON.stringify(v)} />
        <Card title="Names, order and pictures" note="The order here is the order of the shop's buttons and shelves. A hidden kind leaves the shop, drops and rail; its pieces still have their own pages.">
          <ul className="space-y-2">
            {v.map((k, i) => (
              <li key={k.id} className={`rounded-2xl bg-white p-3 ${k.visible ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#f2f2f0]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a small category picture */}
                    <img src={kindPicture(k.icon)} alt="" className="h-9 w-9 object-contain" />
                  </span>
                  <input aria-label={`${k.id} name`} value={k.label} maxLength={30} onChange={(e) => patch(i, { label: e.target.value })} className="h-10 w-44 rounded-full border border-ink/15 px-4 text-[14px] font-semibold outline-none focus:border-ink" />
                  <input aria-label={`${k.label} line`} value={k.blurb} maxLength={120} placeholder="A line under its shelf (optional)" onChange={(e) => patch(i, { blurb: e.target.value })} className="h-10 min-w-0 flex-1 rounded-full border border-ink/15 px-4 text-[13.5px] outline-none focus:border-ink" />
                  <span className="w-40">
                    <Switch label="Shown" on={k.visible} onChange={(visible) => patch(i, { visible })} />
                  </span>
                  <RowTools i={i} n={v.length} name={k.label} onMove={(a, b) => setV((cur) => moved(cur, a, b))} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[60px]">
                  {STAND_IN_PICTURES.map((pic) => (
                    <button key={pic} type="button" aria-pressed={k.icon === pic} aria-label={`Use the ${pic} picture`} onClick={() => patch(i, { icon: pic })} className={`grid h-9 w-9 cursor-pointer place-items-center rounded-lg ${k.icon === pic ? "bg-ink/10 ring-2 ring-ink" : "hover:bg-ink/5"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- a small stand-in picture */}
                      <img src={`/stand-ins/${pic}.webp`} alt="" className="h-7 w-7 object-contain" />
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <SaveBar pending={pending} dirty={dirty} message={state.status === "idle" ? undefined : state.message} error={state.status === "error"} onReset={() => setV(saved)} />
      </form>
      <Card title="Own pictures" note="Upload a picture for a kind instead of the drawn ones (a cut-out on a clear background looks best).">
        <ul className="grid gap-2 sm:grid-cols-2">
          {v.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2">
              <span className="text-[14px] font-semibold">{k.label}</span>
              <OwnPicture id={k.id} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
