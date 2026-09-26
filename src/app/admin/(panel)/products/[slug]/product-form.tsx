"use client";

import { useActionState, useState } from "react";

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
    <form action={action} className="mt-8 space-y-10">
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
