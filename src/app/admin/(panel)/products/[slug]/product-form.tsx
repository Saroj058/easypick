"use client";

import { startTransition, useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";

import { ProductImage } from "@/components/product-image";

import type { Product } from "@/lib/types";
import { saveProduct, type SaveState } from "@/app/admin/actions";
import { shrinkPhotoInput } from "../../resize-photo";

const input = "mt-2 h-12 w-full rounded-xl border border-ink/15 bg-white px-4 text-base outline-none focus:border-ink";
const area = "mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-ink";
const field = "block text-sm font-semibold";
const hint = "font-normal text-[#6b6d72]";
const card = "rounded-[24px] bg-[#f4f4f2] p-5 md:p-6";
const h3 = "text-[17px] font-semibold";
const statuses = [
  { value: "live", label: "Live", note: "On the website and kiosk", dot: "bg-[#1f9d55]" },
  { value: "scheduled", label: "Scheduled", note: "Coming soon until its drop", dot: "bg-[#2f6fde]" },
  { value: "sold_out", label: "Sold out", note: "Shown, can't be bought", dot: "bg-[#d70015]" },
  { value: "draft", label: "Draft", note: "Hidden", dot: "bg-[#a3a5aa]" },
  { value: "archived", label: "Archived", note: "Hidden, kept for records", dot: "bg-[#55575c]" },
];

export function ProductForm({ product, drops }: { product: Product; drops: { slug: string; name: string }[] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProduct, { status: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const front = product.images.find((i) => i.kind === "front") ?? product.images[0];

  return (
    <form
      // Submitted by hand so a failed save keeps what was typed (a form action resets the fields).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setDirty(false);
        startTransition(() => action(data));
      }}
      onChange={() => setDirty(true)}
      className="space-y-4"
    >
      <input type="hidden" name="slug" value={product.slug} />

      <section aria-labelledby="photo-h" className={`${card} flex flex-wrap items-center gap-5`}>
        <div className="w-28 shrink-0 overflow-hidden rounded-2xl bg-white">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file
            <img src={preview} alt="New photo preview" className="aspect-[4/5] w-full object-cover" />
          ) : (
            <ProductImage image={front} category={product.category} colourHex={product.colours[0]?.hex ?? "#ccc"} decorative sizes="112px" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="photo-h" className={h3}>
            Photo
          </h3>
          <p className="mt-1 text-[14px] text-[#55575c]">Flat-lay on a plain light background. JPG, PNG or WebP; big phone photos are shrunk for you. Saved when you press Save.</p>
          <label className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-[14px] font-semibold hover:border-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
            <ImagePlus className="h-4 w-4" aria-hidden />
            {preview ? "Pick a different photo" : "Change photo"}
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={async (e) => {
                // Big phone photos are shrunk here so the upload stays under the hosting limit.
                const f = await shrinkPhotoInput(e.target);
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="basics-h" className={`${card} grid gap-4 sm:grid-cols-2`}>
        <h3 id="basics-h" className={`${h3} sm:col-span-2`}>
          The piece
        </h3>
        <div className="sm:col-span-2">
          <label htmlFor="name" className={field}>
            Name <span className={hint}>(the link stays /product/{product.slug})</span>
          </label>
          <input id="name" name="name" required maxLength={80} defaultValue={product.name} className={input} />
        </div>
        <div>
          <label htmlFor="fit" className={field}>
            Fit
          </label>
          <select id="fit" name="fit" defaultValue={product.fit} className={input}>
            <option value="oversized">Oversized</option>
            <option value="relaxed">Relaxed</option>
            <option value="regular">Regular</option>
          </select>
        </div>
        <div>
          <label htmlFor="gender" className={field}>
            For
          </label>
          <select id="gender" name="gender" defaultValue={product.gender} className={input}>
            <option value="unisex">Everyone (unisex)</option>
            <option value="men">Men</option>
            <option value="women">Women</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="drop" className={field}>
            Drop
          </label>
          <select id="drop" name="drop" defaultValue={product.dropSlug ?? ""} className={input}>
            <option value="">Not part of a drop</option>
            {drops.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="shortDescription" className={field}>
            One-line description
          </label>
          <input id="shortDescription" name="shortDescription" maxLength={300} defaultValue={product.shortDescription} className={input} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="details" className={field}>
            Details <span className={hint}>(one per line: fabric, weight, care)</span>
          </label>
          <textarea id="details" name="details" rows={4} maxLength={4000} defaultValue={product.details.join("\n")} className={area} />
        </div>
      </section>

      <section aria-labelledby="price-h" className={`${card} grid gap-4 sm:grid-cols-2`}>
        <h3 id="price-h" className={`${h3} sm:col-span-2`}>
          Price
        </h3>
        <div>
          <label htmlFor="price" className={field}>
            Price (Rs, VAT included)
          </label>
          <input id="price" name="price" type="number" inputMode="numeric" min={1} defaultValue={product.price} required className={`${input} font-mono`} />
        </div>
        <div>
          <label htmlFor="salePrice" className={field}>
            Sale price <span className={hint}>(optional)</span>
          </label>
          <input id="salePrice" name="salePrice" type="number" inputMode="numeric" min={1} defaultValue={product.salePrice ?? ""} className={`${input} font-mono`} />
        </div>
      </section>

      <fieldset className={card}>
        <legend className="sr-only">Status</legend>
        <p className={h3} aria-hidden>
          Status
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {statuses.map((s) => (
            <label key={s.value} className="relative block cursor-pointer">
              <input type="radio" name="status" value={s.value} defaultChecked={product.status === s.value} className="peer sr-only" />
              <span className="flex min-h-[64px] flex-col justify-center rounded-2xl bg-white px-4 py-2.5 ring-1 ring-ink/10 transition-shadow peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                <span className="flex items-center gap-2 font-semibold">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
                  {s.label}
                </span>
                <span className="text-[12.5px] text-[#6b6d72]">{s.note}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={`${card} space-y-4`}>
        <legend className="sr-only">The Vault</legend>
        <div aria-hidden>
          <p className={h3}>The Vault</p>
          <p className="mt-1 text-[14px] text-[#55575c]">Premium pieces: original brands and numbered runs, in their own section.</p>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="vault" defaultChecked={Boolean(product.vault)} className="h-5 w-5 accent-ink" />
          Show in The Vault
        </label>
        <div>
          <label htmlFor="brand" className={field}>
            Brand <span className={hint}>(e.g. Nike)</span>
          </label>
          <input id="brand" name="brand" maxLength={40} defaultValue={product.brand ?? ""} className={input} />
        </div>
        <label className="flex min-h-11 items-start gap-3 text-[15px]">
          <input type="checkbox" name="original" defaultChecked={Boolean(product.original)} className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
          <span>
            Tag it &ldquo;Original&rdquo;
            <span className="block text-[13px] text-[#6b6d72]">Only when you have the invoice from the brand or an authorised seller.</span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="editionNo" className={field}>
              Piece number <span className={hint}>(optional)</span>
            </label>
            <input id="editionNo" name="editionNo" type="number" inputMode="numeric" min={1} defaultValue={product.edition?.no ?? ""} className={`${input} font-mono`} />
          </div>
          <div>
            <label htmlFor="editionOf" className={field}>
              Of how many
            </label>
            <input id="editionOf" name="editionOf" type="number" inputMode="numeric" min={1} defaultValue={product.edition?.of ?? ""} className={`${input} font-mono`} />
          </div>
        </div>
        <div>
          <label htmlFor="story" className={field}>
            Its story <span className={hint}>(a few lines, shown on its page)</span>
          </label>
          <textarea id="story" name="story" maxLength={600} rows={3} defaultValue={product.story ?? ""} className={area} />
        </div>
      </fieldset>

      <fieldset className={card}>
        <legend className="sr-only">Trending page</legend>
        <p className={h3} aria-hidden>
          Trending page
        </p>
        <p className="mt-1 text-[14px] text-[#55575c]">Until there are enough real orders, Trending shows your staff picks instead (labelled as such).</p>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="staffPick" defaultChecked={Boolean(product.staffPick)} className="h-5 w-5 accent-ink" />
          Staff pick
        </label>
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="hideFromTrending" defaultChecked={Boolean(product.hideFromTrending)} className="h-5 w-5 accent-ink" />
          Keep off Trending <span className="text-[13px] text-[#6b6d72]">(recorded in the activity log)</span>
        </label>
      </fieldset>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-full bg-white/90 py-2 pl-2 pr-5 shadow-[0_12px_30px_-14px_rgba(0,0,0,0.35)] ring-1 ring-ink/10 backdrop-blur">
        <button type="submit" disabled={pending} className="h-11 min-w-32 cursor-pointer rounded-full bg-ink px-6 text-[14px] font-semibold text-paper hover:bg-graphite disabled:opacity-50">
          {pending ? "Saving…" : "Save"}
        </button>
        <p role="status" className={`text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-[#55575c]"}`}>
          {pending ? "" : dirty ? "Unsaved changes" : state.status === "idle" ? "" : state.message}
        </p>
      </div>
    </form>
  );
}
