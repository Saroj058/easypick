"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Copy, ExternalLink, LayoutGrid, List, Search, X } from "lucide-react";

import { ProductImage } from "@/components/product-image";
import { bulkProductStatus, duplicateProduct } from "@/app/admin/actions";
import { formatPrice } from "@/lib/format";
import type { Category, ProductImage as Img, ProductStatus, Size } from "@/lib/types";

export type BoardRow = {
  slug: string;
  name: string;
  code: string;
  category: Category;
  categoryLabel: string;
  status: ProductStatus;
  price: number;
  salePrice: number | null;
  stock: number;
  sizes: { size: Size; n: number }[];
  colours: string[];
  asked: number;
  vault: boolean;
  staffPick: boolean;
  drop: string | null;
  image: Img;
  colourHex: string;
  order: number;
};

const STATUS: Record<ProductStatus, { label: string; dot: string }> = {
  live: { label: "Live", dot: "bg-[#1f9d55]" },
  scheduled: { label: "Scheduled", dot: "bg-[#2f6fde]" },
  draft: { label: "Draft", dot: "bg-[#a3a5aa]" },
  sold_out: { label: "Sold out", dot: "bg-[#d70015]" },
  archived: { label: "Archived", dot: "bg-[#55575c]" },
  in_review: { label: "In review", dot: "bg-[#b35c00]" },
};
const TABS: ("all" | ProductStatus)[] = ["all", "live", "scheduled", "draft", "sold_out", "archived"];
const SORTS = {
  shop: "Shop order",
  name: "Name A–Z",
  "stock-asc": "Least stock first",
  "stock-desc": "Most stock first",
  "price-asc": "Price, low to high",
  "price-desc": "Price, high to low",
  asked: "Most asked for",
} as const;
type Sort = keyof typeof SORTS;
const FLAGS = { low: "Low or empty sizes", sale: "On sale", vault: "Vault", pick: "Staff picks", asked: "Restock asks" } as const;
type Flag = keyof typeof FLAGS;

const chip = (on: boolean) =>
  `inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors ${on ? "bg-ink text-paper" : "bg-[#f4f4f2] text-ink hover:bg-ink/[0.08]"}`;
const sizeName = (s: Size) => (s === "ONE" ? "One" : s);

function StatusPill({ status }: { status: ProductStatus }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[12px] ring-1 ring-ink/10">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

/** Sizes as small cells: red at 0, bold at 1–2. */
function SizeCells({ sizes }: { sizes: BoardRow["sizes"] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {sizes.map((s) => (
        <span
          key={s.size}
          title={`${sizeName(s.size)}: ${s.n} left`}
          className={`inline-flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[11px] tabular-nums ${
            s.n === 0 ? "bg-[#fdecee] text-[#9b0010]" : s.n <= 2 ? "bg-[#fff1e0] font-semibold text-[#7a3e00]" : "bg-white text-[#55575c] ring-1 ring-ink/[0.06]"
          }`}
        >
          {s.size !== "ONE" && <span className="opacity-60">{s.size}</span>}
          {s.n}
        </span>
      ))}
    </span>
  );
}

function Price({ r }: { r: BoardRow }) {
  return r.salePrice ? (
    <span className="whitespace-nowrap font-mono tabular-nums">
      {formatPrice(r.salePrice)} <s className="text-[12px] text-[#8a8c91]">{formatPrice(r.price)}</s>
    </span>
  ) : (
    <span className="whitespace-nowrap font-mono tabular-nums">{formatPrice(r.price)}</span>
  );
}

function Duplicate({ slug, compact }: { slug: string; compact?: boolean }) {
  return (
    <form action={duplicateProduct}>
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        title="Make a copy as a hidden draft"
        className={`grid cursor-pointer place-items-center rounded-full text-[#55575c] hover:bg-ink/[0.07] hover:text-ink ${compact ? "h-8 w-8" : "h-9 w-9"}`}
      >
        <Copy className="h-4 w-4" aria-hidden />
        <span className="sr-only">Duplicate</span>
      </button>
    </form>
  );
}

export function ProductsBoard({ rows }: { rows: BoardRow[] }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [kind, setKind] = useState<"" | Category>("");
  const [flags, setFlags] = useState<Flag[]>([]);
  const [sort, setSort] = useState<Sort>("shop");
  const [view, setView] = useState<"table" | "grid">("table");
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, start] = useTransition();

  const kinds = useMemo(() => [...new Map(rows.map((r) => [r.category, r.categoryLabel]))], [rows]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t, t === "all" ? rows.length : rows.filter((r) => r.status === t).length])), [rows]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const has = (r: BoardRow, f: Flag) =>
      f === "low" ? r.sizes.some((s) => s.n <= 2) : f === "sale" ? Boolean(r.salePrice) : f === "vault" ? r.vault : f === "pick" ? r.staffPick : r.asked > 0;
    const out = rows.filter(
      (r) =>
        (tab === "all" || r.status === tab) &&
        (!kind || r.category === kind) &&
        flags.every((f) => has(r, f)) &&
        (!needle || r.name.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle) || (r.drop ?? "").toLowerCase().includes(needle)),
    );
    const price = (r: BoardRow) => r.salePrice ?? r.price;
    const by: Record<Sort, (a: BoardRow, b: BoardRow) => number> = {
      shop: (a, b) => a.order - b.order,
      name: (a, b) => a.name.localeCompare(b.name),
      "stock-asc": (a, b) => a.stock - b.stock,
      "stock-desc": (a, b) => b.stock - a.stock,
      "price-asc": (a, b) => price(a) - price(b),
      "price-desc": (a, b) => price(b) - price(a),
      asked: (a, b) => b.asked - a.asked,
    };
    return out.sort(by[sort]);
  }, [rows, q, tab, kind, flags, sort]);

  const shown = list.map((r) => r.slug);
  const allPicked = shown.length > 0 && shown.every((s) => picked.includes(s));
  const toggle = (slug: string) => setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));
  const filtered = q || tab !== "all" || kind || flags.length;

  const bulk = (status: ProductStatus) =>
    start(async () => {
      const r = await bulkProductStatus(picked, status);
      setNote(r.status === "idle" ? "" : r.message);
      if (r.status === "saved") setPicked([]);
    });

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div role="tablist" aria-label="Status" className="flex gap-1 overflow-x-auto rounded-full bg-[#f4f4f2] p-1 [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-[13.5px] transition-colors ${tab === t ? "bg-white font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-[#55575c] hover:text-ink"}`}
          >
            {t === "all" ? "All" : STATUS[t].label}
            <span className="font-mono text-[11.5px] text-[#8a8c91]">{counts[t]}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Find a piece</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8c91]" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, code or drop"
            className="h-10 w-full rounded-full border border-ink/15 bg-white pl-10 pr-4 text-[14px] outline-none focus:border-ink"
          />
        </label>
        <label>
          <span className="sr-only">Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as "" | Category)} className="h-10 rounded-full border border-ink/15 bg-white px-4 text-[13.5px] outline-none focus:border-ink">
            <option value="">Every kind</option>
            {kinds.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-full border border-ink/15 bg-white px-4 text-[13.5px] outline-none focus:border-ink">
            {Object.entries(SORTS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="flex rounded-full bg-[#f4f4f2] p-1" role="group" aria-label="View">
          {(
            [
              ["table", List, "List"],
              ["grid", LayoutGrid, "Grid"],
            ] as const
          ).map(([v, Icon, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`grid h-8 w-9 cursor-pointer place-items-center rounded-full ${view === v ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-[#6b6d72]"}`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="sr-only">{l}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(FLAGS) as Flag[]).map((f) => (
          <button key={f} type="button" aria-pressed={flags.includes(f)} onClick={() => setFlags((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]))} className={chip(flags.includes(f))}>
            {FLAGS[f]}
          </button>
        ))}
        {filtered ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setTab("all");
              setKind("");
              setFlags([]);
            }}
            className="ml-1 inline-flex h-9 cursor-pointer items-center gap-1 px-2 text-[13px] text-[#55575c] underline-offset-2 hover:underline"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        ) : null}
        <span className="ml-auto text-[13px] text-[#6b6d72]">
          {list.length} of {rows.length}
        </span>
      </div>

      {/* Bulk bar */}
      {picked.length > 0 && (
        <div className="sticky top-3 z-20 flex flex-wrap items-center gap-2 rounded-full bg-ink py-2 pl-5 pr-2 text-paper shadow-[0_12px_30px_-12px_rgba(0,0,0,0.5)]">
          <span className="text-[13.5px] font-semibold">{picked.length} picked</span>
          <span className="mx-1 h-4 w-px bg-white/20" aria-hidden />
          <span className="text-[12.5px] text-white/60">Set to</span>
          {(["live", "draft", "sold_out", "archived"] as const).map((s) => (
            <button key={s} type="button" disabled={busy} onClick={() => bulk(s)} className="h-8 cursor-pointer rounded-full bg-white/10 px-3.5 text-[13px] hover:bg-white/20 disabled:opacity-50">
              {STATUS[s].label}
            </button>
          ))}
          <button type="button" onClick={() => setPicked([])} className="ml-auto h-8 cursor-pointer rounded-full px-3 text-[13px] text-white/70 hover:text-white">
            Cancel
          </button>
        </div>
      )}
      <p role="status" className="text-[13px] text-[#55575c] empty:hidden">
        {busy ? "Saving…" : note}
      </p>

      {list.length === 0 ? (
        <div className="rounded-[22px] bg-[#f4f4f2] px-6 py-14 text-center">
          <p className="font-semibold">Nothing matches.</p>
          <p className="mt-1 text-[14px] text-[#55575c]">Try fewer filters, or add a new piece.</p>
        </div>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-[22px] bg-[#f4f4f2] p-2">
          <table className="w-full min-w-[860px] text-left text-[14px]">
            <thead className="text-[12px] text-[#55575c]">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Pick every piece shown"
                    checked={allPicked}
                    onChange={() => setPicked(allPicked ? picked.filter((s) => !shown.includes(s)) : [...new Set([...picked, ...shown])])}
                    className="h-4 w-4 cursor-pointer accent-[#0a0a0a]"
                  />
                </th>
                <th className="px-2 py-2 font-normal">Piece</th>
                <th className="px-2 py-2 font-normal">Status</th>
                <th className="px-2 py-2 font-normal">Sizes left</th>
                <th className="px-2 py-2 text-right font-normal">Stock</th>
                <th className="px-2 py-2 text-right font-normal">Price</th>
                <th className="px-2 py-2 text-right font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const on = picked.includes(r.slug);
                return (
                  <tr key={r.slug} className={`group border-t border-ink/5 first:border-t-0 ${on ? "bg-[#eef3ff]" : "bg-white"} hover:bg-[#fafaf9]`}>
                    <td className="px-3 py-2.5 first:rounded-l-2xl">
                      <input type="checkbox" checked={on} onChange={() => toggle(r.slug)} aria-label={`Pick ${r.name}`} className="h-4 w-4 cursor-pointer accent-[#0a0a0a]" />
                    </td>
                    <td className="px-2 py-2.5">
                      <Link href={`/admin/products/${r.slug}`} className="flex items-center gap-3">
                        <span className="w-11 shrink-0 overflow-hidden rounded-xl bg-[#f4f4f2]">
                          <ProductImage image={r.image} category={r.category} colourHex={r.colourHex} decorative sizes="44px" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold group-hover:underline">{r.name}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-[12px] text-[#6b6d72]">
                            <span className="font-mono">{r.code}</span>· {r.categoryLabel}
                            {r.drop && <>· {r.drop}</>}
                            <span className="flex gap-0.5" aria-hidden>
                              {r.colours.slice(0, 5).map((c, i) => (
                                <span key={i} className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                              ))}
                            </span>
                            {r.vault && <span className="rounded-full bg-ink px-1.5 text-[10px] text-paper">Vault</span>}
                            {r.staffPick && <span className="rounded-full bg-[#f4f4f2] px-1.5 text-[10px] text-ink">Pick</span>}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-2 py-2.5">
                      <SizeCells sizes={r.sizes} />
                      {r.asked > 0 && <span className="mt-1 block text-[11.5px] text-[#55575c]">{r.asked} waiting for a restock</span>}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono tabular-nums">{r.stock}</td>
                    <td className="px-2 py-2.5 text-right">
                      <Price r={r} />
                    </td>
                    <td className="px-2 py-2.5 last:rounded-r-2xl">
                      <span className="flex justify-end gap-0.5">
                        <Link href={`/product/${r.slug}`} target="_blank" title="See it on the site" className="grid h-8 w-8 place-items-center rounded-full text-[#55575c] hover:bg-ink/[0.07] hover:text-ink">
                          <ExternalLink className="h-4 w-4" aria-hidden />
                          <span className="sr-only">See {r.name} on the site</span>
                        </Link>
                        <Duplicate slug={r.slug} compact />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {list.map((r) => {
            const on = picked.includes(r.slug);
            return (
              <li key={r.slug} className={`group relative rounded-[22px] bg-[#f4f4f2] p-2 ${on ? "ring-2 ring-ink" : ""}`}>
                <Link href={`/admin/products/${r.slug}`} className="block overflow-hidden rounded-[16px] bg-white">
                  <ProductImage image={r.image} category={r.category} colourHex={r.colourHex} decorative sizes="(min-width:1280px) 240px, 45vw" />
                </Link>
                <label className="absolute left-4 top-4 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-white/90 shadow-sm">
                  <input type="checkbox" checked={on} onChange={() => toggle(r.slug)} aria-label={`Pick ${r.name}`} className="h-4 w-4 cursor-pointer accent-[#0a0a0a]" />
                </label>
                <span className="absolute right-4 top-4">
                  <StatusPill status={r.status} />
                </span>
                <div className="px-2 pb-1.5 pt-3">
                  <Link href={`/admin/products/${r.slug}`} className="block truncate font-semibold hover:underline">
                    {r.name}
                  </Link>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[13px]">
                    <Price r={r} />
                    <span className="font-mono text-[12px] text-[#6b6d72]">{r.stock} in stock</span>
                  </div>
                  <div className="mt-2.5 flex items-end justify-between gap-2">
                    <SizeCells sizes={r.sizes} />
                    <Duplicate slug={r.slug} compact />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
