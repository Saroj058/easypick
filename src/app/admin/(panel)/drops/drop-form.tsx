"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";

import { saveDropAction, type SaveState } from "@/app/admin/actions";
import { ProductImage } from "@/components/product-image";
import { formatPrice } from "@/lib/format";
import type { Category, ProductImage as Img } from "@/lib/types";
import { Card, input } from "../kit";

export type DropFormValue = { slug: string; name: string; story: string; releaseAt: string; products: string[] };
export type DropChoice = {
  slug: string;
  name: string;
  status: string;
  dropSlug: string | null;
  dropName: string | null;
  category: Category;
  kind: string;
  price: number;
  stock: number;
  image: Img;
  hex: string;
};

const STATUS: Record<string, string> = { live: "Live", draft: "Draft", scheduled: "Waiting", sold_out: "Sold out", archived: "Archived" };

/**
 * One drop (owner, 19 Oct 2026): its number, name, story and time on the left; its pieces on the
 * right, picked from photos with a search and the kinds, the chosen ones in a tray at the top.
 */
export function DropForm({ initial, products, kinds, isNew, saved }: { initial: DropFormValue; products: DropChoice[]; kinds: { id: Category; name: string }[]; isNew: boolean; saved?: boolean }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveDropAction, { status: "idle" });
  const [chosen, setChosen] = useState<string[]>(initial.products);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Category | null>(null);
  const [onlyFree, setOnlyFree] = useState(false);

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const q = query.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      (!kind || p.category === kind) &&
      (!q || p.name.toLowerCase().includes(q) || p.slug.includes(q)) &&
      (!onlyFree || !p.dropSlug || p.dropSlug === initial.slug),
  );
  const kindsHere = kinds.filter((k) => products.some((p) => p.category === k.id));
  const toggle = (slug: string) => setChosen((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));
  const message = state.status !== "idle" ? state.message : saved ? "Drop created. Now pick its pieces." : "";

  return (
    <form action={action} className="grid items-start gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <input type="hidden" name="mode" value={isNew ? "new" : "edit"} />
      {chosen.map((s) => (
        <input key={s} type="hidden" name="products" value={s} />
      ))}

      <div className="space-y-4 lg:sticky lg:top-24">
        <Card title="The drop">
          <div className="grid grid-cols-[96px_1fr] gap-3">
            <label className="block">
              <span className="text-[13px] font-semibold">Number</span>
              <input name="slug" defaultValue={initial.slug} readOnly={!isNew} required maxLength={20} placeholder="08" className={`${input} font-mono ${isNew ? "" : "bg-[#f2f2f0] text-[#55575c]"}`} />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold">Name</span>
              <input name="name" defaultValue={initial.name} required maxLength={60} placeholder="Drop 08" className={input} />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-[13px] font-semibold">
              Story <span className="font-normal text-[#6b6d72]">(a line or two)</span>
            </span>
            <textarea name="story" defaultValue={initial.story} rows={3} maxLength={400} className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-ink" />
          </label>
          <label className="mt-3 block">
            <span className="text-[13px] font-semibold">Lands at (Kathmandu time)</span>
            <input name="releaseAt" type="datetime-local" defaultValue={initial.releaseAt} required className={input} />
          </label>
          <p className="mt-2 text-[12.5px] text-[#6b6d72]">Until then its pieces show as coming soon, not for sale.</p>
        </Card>

        <div className="rounded-[24px] bg-[#f4f4f2] p-5">
          <p className="text-[14px]">
            <span className="font-mono text-[22px] font-semibold">{chosen.length}</span> {chosen.length === 1 ? "piece" : "pieces"} in this drop
          </p>
          <button type="submit" disabled={pending} className="mt-4 h-12 w-full cursor-pointer rounded-full bg-ink text-[14.5px] font-semibold text-paper hover:bg-graphite disabled:opacity-50">
            {pending ? "Saving…" : isNew ? "Create drop" : "Save drop"}
          </button>
          <p role={state.status === "error" ? "alert" : "status"} className={`mt-2 min-h-5 text-[13.5px] ${state.status === "error" ? "text-[#d70015]" : "text-[#55575c]"}`}>
            {message}
          </p>
          {!isNew && (
            <Link href={`/admin/products/new?drop=${initial.slug}`} className="mt-1 inline-flex h-10 items-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-[13.5px] font-semibold hover:border-ink">
              <Plus className="h-4 w-4" aria-hidden />
              Add a new piece to this drop
            </Link>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <Card title="In this drop" note={chosen.length ? "Tap a piece to take it out." : "Nothing yet. Pick pieces below."}>
          {chosen.length > 0 && (
            <ul aria-label="Chosen pieces" className="flex flex-wrap gap-2">
              {chosen.map((s) => {
                const p = bySlug.get(s);
                return (
                  <li key={s}>
                    <button type="button" onClick={() => toggle(s)} aria-label={`Take ${p?.name ?? s} out`} className="group flex h-12 cursor-pointer items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-[13.5px] font-semibold ring-1 ring-ink/10 hover:ring-ink">
                      {p && <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative sizes="40px" className="!aspect-square h-10 w-10 rounded-full" />}
                      <span className="max-w-[160px] truncate">{p?.name ?? s}</span>
                      <X className="h-3.5 w-3.5 text-[#6b6d72] group-hover:text-ink" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Pick pieces">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search pieces</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b6d72]" aria-hidden />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pieces" className="h-11 w-full rounded-full border border-ink/15 bg-white pl-10 pr-4 text-[14px] outline-none focus:border-ink" />
            </label>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-[13px] ring-1 ring-ink/10">
              <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} className="h-4 w-4 accent-[#0a0a0a]" />
              Not in another drop
            </label>
          </div>
          <div role="group" aria-label="Kinds" className="mt-3 flex flex-wrap gap-1.5">
            {[{ id: null, name: "All" }, ...kindsHere].map((k) => (
              <button key={k.id ?? "all"} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className={`h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold ${kind === k.id ? "bg-ink text-paper" : "bg-white ring-1 ring-ink/10 hover:ring-ink"}`}>
                {k.name}
              </button>
            ))}
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => {
              const on = chosen.includes(p.slug);
              const locked = p.status === "archived" && on;
              const elsewhere = p.dropSlug && p.dropSlug !== initial.slug ? p.dropName ?? `Drop ${p.dropSlug}` : null;
              return (
                <li key={p.slug}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={locked}
                    onClick={() => toggle(p.slug)}
                    className={`group block w-full cursor-pointer overflow-hidden rounded-2xl bg-white text-left transition-shadow disabled:cursor-default ${on ? "ring-2 ring-ink" : "ring-1 ring-ink/10 hover:ring-ink/40"}`}
                  >
                    <span className="relative block">
                      <ProductImage image={p.image} category={p.category} colourHex={p.hex} decorative sizes="(min-width: 1280px) 15vw, 40vw" />
                      <span className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full ${on ? "bg-ink text-paper" : "bg-white/90 ring-1 ring-ink/15"}`} aria-hidden>
                        {on ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </span>
                    </span>
                    <span className="block px-3 pb-3 pt-2">
                      <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                      <span className="mt-0.5 block truncate font-mono text-[12px] text-[#55575c]">
                        {formatPrice(p.price)} · {p.stock} left
                      </span>
                      <span className="mt-1 block truncate text-[11.5px] text-[#6b6d72]">
                        {p.kind} · {STATUS[p.status] ?? p.status}
                        {elsewhere ? ` · in ${elsewhere}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {list.length === 0 && <p className="py-10 text-center text-[14px] text-[#55575c]">No pieces match.</p>}
          {elsewhereNote(products, chosen, initial.slug)}
        </Card>
      </div>
    </form>
  );
}

/** Picking a piece that's in another drop moves it here; say so. */
function elsewhereNote(products: DropChoice[], chosen: string[], slug: string) {
  const moving = products.filter((p) => chosen.includes(p.slug) && p.dropSlug && p.dropSlug !== slug);
  if (!moving.length) return null;
  return <p className="mt-4 rounded-2xl bg-[#fff1e0] px-4 py-3 text-[13.5px] text-[#7a3e00]">Saving moves {moving.map((p) => p.name).join(", ")} out of {moving.length === 1 ? "its" : "their"} other drop into this one.</p>;
}
