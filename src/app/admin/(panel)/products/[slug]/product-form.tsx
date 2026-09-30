"use client";

import { startTransition, useActionState, useState } from "react";

import { ProductImage } from "@/components/product-image";

import type { Product } from "@/lib/types";
import { saveProduct, type SaveState } from "@/app/admin/actions";
import { shrinkPhotoInput } from "../../resize-photo";

const input = "mt-2 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-4 text-base outline-none focus:border-ink";
const statuses = [
  { value: "live", label: "Live", note: "On the website and kiosk" },
  { value: "scheduled", label: "Scheduled", note: "Shown as coming soon until its drop" },
  { value: "sold_out", label: "Sold out", note: "Shown, but can't be bought" },
  { value: "draft", label: "Draft", note: "Hidden" },
  { value: "archived", label: "Archived", note: "Hidden, kept for records" },
];

export function ProductForm({ product }: { product: Product }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProduct, { status: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const front = product.images.find((i) => i.kind === "front") ?? product.images[0];

  return (
    <form
      // Submitted by hand so a failed save keeps what was typed (a form action resets the fields).
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="mt-8 space-y-10"
    >
      <input type="hidden" name="slug" value={product.slug} />

      <section aria-labelledby="photo-h" className="flex items-start gap-5">
        <div className="w-28 shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file
            <img src={preview} alt="New photo preview" className="aspect-[4/5] w-full bg-photo object-cover" />
          ) : (
            <ProductImage image={front} category={product.category} colourHex={product.colours[0]?.hex ?? "#ccc"} decorative sizes="112px" />
          )}
        </div>
        <div>
          <h3 id="photo-h" className="text-lg font-semibold">
            Photo
          </h3>
          <p className="mt-1 text-[14px] text-steel-dark">Flat-lay on a plain light background. JPG, PNG or WebP, under 4 MB (big phone photos are shrunk for you). Saved when you press Save.</p>
          <label className="btn btn-outline mt-3 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
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

      <section aria-labelledby="price-h" className="grid gap-4 sm:grid-cols-2">
        <h3 id="price-h" className="text-lg font-semibold sm:col-span-2">
          Price
        </h3>
        <div>
          <label htmlFor="price" className="block text-sm font-semibold">
            Price (Rs, VAT included)
          </label>
          <input id="price" name="price" type="number" inputMode="numeric" min={1} defaultValue={product.price} required className={`${input} font-mono`} />
        </div>
        <div>
          <label htmlFor="salePrice" className="block text-sm font-semibold">
            Sale price <span className="font-normal text-steel-dark">(optional)</span>
          </label>
          <input id="salePrice" name="salePrice" type="number" inputMode="numeric" min={1} defaultValue={product.salePrice ?? ""} className={`${input} font-mono`} />
        </div>
      </section>

      <fieldset>
        <legend className="text-lg font-semibold">Status</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {statuses.map((s) => (
            <label key={s.value} className="relative block cursor-pointer">
              <input type="radio" name="status" value={s.value} defaultChecked={product.status === s.value} className="peer sr-only" />
              <span className="flex min-h-[60px] flex-col justify-center rounded-[2px] border border-mist px-4 py-2 peer-checked:border-ink peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                <span className="font-semibold">{s.label}</span>
                <span className="text-[13px] text-steel-dark">{s.note}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="shortDescription" className="block text-lg font-semibold">
          One-line description
        </label>
        <input id="shortDescription" name="shortDescription" maxLength={300} defaultValue={product.shortDescription} className={input} />
      </div>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">The Vault</legend>
        <p className="text-[14px] text-steel-dark">Premium pieces: original brands and numbered runs, in their own dark section on the home page.</p>
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="vault" defaultChecked={Boolean(product.vault)} className="h-5 w-5 accent-ink" />
          Show in The Vault
        </label>
        <div>
          <label htmlFor="brand" className="block text-sm font-semibold">
            Brand <span className="font-normal text-steel-dark">(e.g. Nike)</span>
          </label>
          <input id="brand" name="brand" maxLength={40} defaultValue={product.brand ?? ""} className={input} />
        </div>
        <label className="flex min-h-11 items-start gap-3 text-[15px]">
          <input type="checkbox" name="original" defaultChecked={Boolean(product.original)} className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
          <span>
            Tag it &ldquo;Original&rdquo;
            <span className="block text-[13px] text-steel-dark">Only when you have the invoice from the brand or an authorised seller.</span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="editionNo" className="block text-sm font-semibold">
              Piece number <span className="font-normal text-steel-dark">(optional)</span>
            </label>
            <input id="editionNo" name="editionNo" type="number" inputMode="numeric" min={1} defaultValue={product.edition?.no ?? ""} className={`${input} font-mono`} />
          </div>
          <div>
            <label htmlFor="editionOf" className="block text-sm font-semibold">
              Of how many
            </label>
            <input id="editionOf" name="editionOf" type="number" inputMode="numeric" min={1} defaultValue={product.edition?.of ?? ""} className={`${input} font-mono`} />
          </div>
        </div>
        <div>
          <label htmlFor="story" className="block text-sm font-semibold">
            Its story <span className="font-normal text-steel-dark">(a few lines, shown on its page)</span>
          </label>
          <textarea id="story" name="story" maxLength={600} rows={3} defaultValue={product.story ?? ""} className="mt-2 w-full rounded-[2px] border border-mist bg-paper px-4 py-3 text-base outline-none focus:border-ink" />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold">Trending page</legend>
        <p className="mt-1 text-[14px] text-steel-dark">Until there are enough real orders, Trending shows your staff picks instead (labelled as such).</p>
        <label className="mt-3 flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="staffPick" defaultChecked={Boolean(product.staffPick)} className="h-5 w-5 accent-ink" />
          Staff pick
        </label>
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" name="hideFromTrending" defaultChecked={Boolean(product.hideFromTrending)} className="h-5 w-5 accent-ink" />
          Keep off Trending <span className="text-[13px] text-steel-dark">(recorded in the activity log)</span>
        </label>
      </fieldset>

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
