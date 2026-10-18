"use client";

import { useActionState, useState } from "react";

import type { SaveState } from "@/app/admin/actions";
import { deleteAction, moreAction, moveAction } from "@/app/admin/product-actions";
import type { Product } from "@/lib/types";
import { Card, Switch, input } from "../../kit";

/** The rest of a piece's settings: its kind, where it shows, tags, its place in the shop, and delete. */
export function MoreTab({ product, kinds }: { product: Product; kinds: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(moreAction, { status: "idle" });
  const [del, delAction, deleting] = useActionState<SaveState, FormData>(deleteAction, { status: "idle" });
  const [web, setWeb] = useState(product.showOn?.website !== false);
  const [kiosk, setKiosk] = useState(product.showOn?.kiosk !== false);
  const canDelete = product.status === "draft" || product.status === "archived";

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="slug" value={product.slug} />
        <Card title="Kind and where it shows">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold">Kind</span>
              <select name="category" defaultValue={product.category} className={input}>
                {kinds.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[12px] text-[#6b6d72]">Moves it to another shelf. The codes on its tags stay.</span>
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold">
                Model note <span className="font-normal text-[#6b6d72]">(optional)</span>
              </span>
              <input name="modelNote" maxLength={140} defaultValue={product.modelNote ?? ""} placeholder="Model is 178 cm and wears M" className={input} />
            </label>
          </div>
          <div className="mt-3 rounded-2xl bg-white px-4 py-1">
            <Switch label="On the website" note="Off hides it online; it can still sell in store." on={web} onChange={setWeb} />
            <Switch label="On the store kiosk" on={kiosk} onChange={setKiosk} />
          </div>
          {web && <input type="hidden" name="website" value="on" />}
          {kiosk && <input type="hidden" name="kiosk" value="on" />}
        </Card>
        <Card title="Tags" note="Words that help search and offers find it, separated by commas, e.g. linen, summer, dashain-offer.">
          <input name="tags" maxLength={600} defaultValue={product.tags.join(", ")} className={input} />
        </Card>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="h-11 cursor-pointer rounded-full bg-ink px-6 text-[14px] font-semibold text-paper disabled:opacity-50">
            Save
          </button>
          <p role="status" className={`text-[14px] ${state.status === "error" ? "text-[#d70015]" : "text-[#55575c]"}`}>
            {pending ? "" : state.status === "idle" ? "" : state.message}
          </p>
        </div>
      </form>

      <Card title="Place in the shop" note="Where it sits in every list: the shop, its shelf and the admin.">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["top", "Move to the top"],
              ["up", "One place up"],
              ["down", "One place down"],
              ["bottom", "Move to the end"],
            ] as const
          ).map(([to, label]) => (
            <form key={to} action={moveAction}>
              <input type="hidden" name="slug" value={product.slug} />
              <button type="submit" name="to" value={to} className="h-10 cursor-pointer rounded-full border border-ink/15 bg-white px-4 text-[13.5px] font-semibold hover:border-ink">
                {label}
              </button>
            </form>
          ))}
        </div>
      </Card>

      <Card title="Delete" note={canDelete ? "Only for a draft or archived piece that was never ordered and has no stock. This can't be undone." : "Set it to Draft or Archived first (Details tab). Pieces that were ordered stay for the records; archive them instead."}>
        {canDelete && (
          <form action={delAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="slug" value={product.slug} />
            <label className="block">
              <span className="text-[13px] font-semibold">Type &ldquo;delete&rdquo; to confirm</span>
              <input name="confirm" autoComplete="off" className={`${input} w-48`} />
            </label>
            <button type="submit" disabled={deleting} className="h-11 cursor-pointer rounded-full bg-[#d70015] px-5 text-[13.5px] font-semibold text-white disabled:opacity-50">
              Delete {product.name}
            </button>
            <p role="status" className="text-[13.5px] text-[#d70015]">
              {del.status === "error" ? del.message : ""}
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
