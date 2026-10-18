"use client";

import { useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";

import type { SaveState } from "@/app/admin/actions";
import { savePhotosAction, uploadCutoutAction, uploadPhotoAction } from "@/app/admin/product-actions";
import type { ProductImage as Img } from "@/lib/types";
import { shrinkPhotoInput } from "../../resize-photo";
import { Card, RowTools, SaveBar, input, moved } from "../../kit";

const KINDS: { id: Img["kind"]; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "detail", label: "Detail" },
  { id: "model", label: "On a model" },
  { id: "styled", label: "Styled" },
];

/**
 * A piece's photos (owner, 18 Oct 2026): add as many as twelve, each a front, back, detail, model
 * or styled shot; put them in order (the first is the one shown everywhere); set what each shows
 * for screen readers; and tap a photo to choose the spot that stays in view when it's cropped. Plus
 * a cut-out on a clear background for the home hero.
 */
export function PhotosTab({ slug, images, cutout }: { slug: string; images: Img[]; cutout?: string }) {
  const [list, setList] = useState(images.filter((i) => i.src));
  const [saved, setSaved] = useState(list);
  // A photo was added or the page refreshed: start from what's saved now, keeping the messages.
  const now = images.map((i) => `${i.src}~${i.kind}~${i.alt}~${i.focus?.x ?? ""}~${i.focus?.y ?? ""}`).join("|");
  const [seen, setSeen] = useState(now);
  if (seen !== now) {
    setSeen(now);
    setList(images.filter((i) => i.src));
    setSaved(images.filter((i) => i.src));
  }
  const [kind, setKind] = useState<Img["kind"]>(list.some((i) => i.kind === "front") ? "back" : "front");
  const [arrange, arrangeAction, arranging] = useActionState<SaveState, FormData>(savePhotosAction, { status: "idle" });
  const [up, upload, uploading] = useActionState<SaveState, FormData>(uploadPhotoAction, { status: "idle" });
  const [cut, cutAction, cutting] = useActionState<SaveState, FormData>(uploadCutoutAction, { status: "idle" });
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);
  const patch = (i: number, p: Partial<Img>) => setList((cur) => cur.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <div className="space-y-4">
      <Card title="Add a photo" note="JPG, PNG or WebP; big phone photos are shrunk for you. A plain light background looks best.">
        <form action={upload} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="slug" value={slug} />
          <label className="block">
            <span className="text-[13px] font-semibold">What it shows</span>
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Img["kind"])} className={`${input} w-44`}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-[14px] font-semibold hover:border-ink focus-within:outline focus-within:outline-2 focus-within:outline-ink">
            <ImagePlus className="h-4 w-4" aria-hidden />
            Choose photo
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={async (e) => {
                await shrinkPhotoInput(e.target);
                e.target.form?.requestSubmit();
              }}
            />
          </label>
          <p role="status" className={`text-[13.5px] ${up.status === "error" ? "text-[#d70015]" : "text-[#55575c]"}`}>
            {uploading ? "Uploading…" : up.status === "idle" ? "" : up.message}
          </p>
        </form>
      </Card>

      <form
        action={(fd) => {
          setSaved(list);
          arrangeAction(fd);
        }}
        className="space-y-4"
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="data" value={JSON.stringify(list)} />
        <Card title={`Photos (${list.length})`} note="The first photo is the one shown everywhere. Tap a photo to set the spot that stays in view when it's cropped.">
          {list.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-8 text-center text-[14px] text-[#55575c]">No photos yet: the piece shows its drawn stand-in. Add one above.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((img, i) => (
                <li key={img.src} className="rounded-2xl bg-white p-3">
                  <button
                    type="button"
                    aria-label={`Set the focus of photo ${i + 1}`}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      patch(i, { focus: { x: Math.round(((e.clientX - r.left) / r.width) * 100) / 100, y: Math.round(((e.clientY - r.top) / r.height) * 100) / 100 } });
                    }}
                    className="relative block aspect-[4/5] w-full cursor-crosshair overflow-hidden rounded-xl bg-[#f2f2f0]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded photo */}
                    <img src={img.src!} alt="" className="h-full w-full object-cover" style={img.focus ? { objectPosition: `${img.focus.x * 100}% ${img.focus.y * 100}%` } : undefined} />
                    {img.focus && (
                      <span aria-hidden className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink/40 shadow" style={{ left: `${img.focus.x * 100}%`, top: `${img.focus.y * 100}%` }} />
                    )}
                    {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper">Shown first</span>}
                  </button>
                  <div className="mt-2 flex items-center gap-2">
                    <select aria-label={`Photo ${i + 1} shows`} value={img.kind} onChange={(e) => patch(i, { kind: e.target.value as Img["kind"] })} className="h-9 flex-1 rounded-full border border-ink/15 bg-white px-3 text-[13px]">
                      {KINDS.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    <RowTools i={i} n={list.length} name={`photo ${i + 1}`} onMove={(a, b) => setList((cur) => moved(cur, a, b))} onRemove={() => setList((cur) => cur.filter((_, j) => j !== i))} />
                  </div>
                  <input aria-label={`Photo ${i + 1} description`} value={img.alt} maxLength={140} onChange={(e) => patch(i, { alt: e.target.value })} placeholder="What the photo shows" className="mt-2 h-9 w-full rounded-full border border-ink/15 px-3 text-[13px] outline-none focus:border-ink" />
                  {img.focus && (
                    <button type="button" onClick={() => patch(i, { focus: undefined })} className="mt-1 text-[12px] text-[#55575c] underline underline-offset-2">
                      Back to the middle
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <SaveBar pending={arranging} dirty={dirty} message={arrange.status === "idle" ? undefined : arrange.message} error={arrange.status === "error"} onReset={() => setList(saved)} />
      </form>

      <Card title="Cut-out for the home hero" note="The piece on a clear background (PNG or WebP). With one, it can turn in the home page hero and stand in the fits.">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-36 w-28 place-items-center overflow-hidden rounded-xl bg-[repeating-conic-gradient(#e7e7e4_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
            {cutout ? <img src={cutout} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[12px] text-[#6b6d72]">None yet</span>}
          </span>
          <form action={cutAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="slug" value={slug} />
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-[14px] font-semibold hover:border-ink">
              <ImagePlus className="h-4 w-4" aria-hidden />
              {cutout ? "Replace cut-out" : "Upload cut-out"}
              <input name="photo" type="file" accept="image/png,image/webp" className="sr-only" onChange={(e) => e.target.form?.requestSubmit()} />
            </label>
            {cutout && (
              <button type="submit" name="remove" value="1" className="h-11 cursor-pointer px-2 text-[13.5px] font-semibold text-[#55575c] underline-offset-4 hover:underline">
                Remove
              </button>
            )}
            <p role="status" className={`text-[13.5px] ${cut.status === "error" ? "text-[#d70015]" : "text-[#55575c]"}`}>
              {cutting ? "Uploading…" : cut.status === "idle" ? "" : cut.message}
            </p>
          </form>
        </div>
      </Card>
    </div>
  );
}
