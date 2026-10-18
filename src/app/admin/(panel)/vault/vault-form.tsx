"use client";

import { useActionState, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";

import type { SaveState } from "@/app/admin/actions";
import { saveVaultAction } from "@/app/admin/settings-actions";
import { brandKey, COLD, DEFAULT_WORLDS, themeVars, type BrandWorld, type Theme } from "@/components/vault/look";
import { themeChecks, type VaultSettings } from "@/lib/settings/vault-rules";
import { AddButton, Card, RowTools, SaveBar, Text, input, moved } from "../kit";

const SWATCHES: { k: keyof Theme; name: string; note: string }[] = [
  { k: "frost", name: "Page", note: "the light background" },
  { k: "slate", name: "Panel", note: "the dark panel" },
  { k: "tile", name: "Tiles", note: "the piece cards" },
  { k: "deep", name: "Headline", note: "big words on the page" },
  { k: "ink", name: "Text", note: "small words on the page and tiles" },
  { k: "dim", name: "Quiet text", note: "small words on the panel" },
];

const titleCase = (key: string) => key.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/** Six colour pickers, a small copy of the Vault in those colours, and whether each pairing is easy to read. */
function ThemeEditor({ name, theme, onChange, line, story }: { name: string; theme: Theme; onChange: (p: Partial<Theme>) => void; line?: [string, string]; story?: string }) {
  const checks = themeChecks(theme);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
      <div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SWATCHES.map((s) => (
            <label key={s.k} className="flex items-center gap-2.5 rounded-xl bg-white p-2.5">
              <input type="color" aria-label={`${name} ${s.name.toLowerCase()} colour`} value={theme[s.k]} onChange={(e) => onChange({ [s.k]: e.target.value })} className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-ink/10 bg-transparent p-0.5" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{s.name}</span>
                <span className="block truncate font-mono text-[11px] text-[#6b6d72]">{theme[s.k]}</span>
              </span>
            </label>
          ))}
        </div>
        <ul aria-label={`${name} readability`} className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {checks.map((c) => {
            const ok = c.ratio >= c.need;
            return (
              <li key={c.label} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[12.5px] ${ok ? "bg-white text-[#55575c]" : "bg-[#fff1e0] text-[#7a3e00]"}`}>
                <span className="inline-flex items-center gap-1.5">
                  {ok ? <Check className="h-3.5 w-3.5 text-[#1a7f37]" aria-hidden /> : <TriangleAlert className="h-3.5 w-3.5" aria-hidden />}
                  {c.label}
                </span>
                <span className="font-mono">
                  {c.ratio}:1{ok ? "" : " · hard to read"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {/* A small copy of the Vault in these colours */}
      <div aria-label={`${name} preview`} style={themeVars(theme)} className="overflow-hidden rounded-2xl bg-[var(--v-frost)] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--v-ink)]">[ {name} ]</p>
        <p className="display mt-1 text-[34px] leading-[0.86] text-[var(--v-deep)]">{name}</p>
        {line && (line[0] || line[1]) && (
          <p className="display mt-1 text-[17px] leading-tight text-[var(--v-deep)]">
            {line[0]} <span className="opacity-70">{line[1]}</span>
          </p>
        )}
        {story && <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-[var(--v-ink)]">{story}</p>}
        <div className="mt-3 bg-[var(--v-slate)] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--v-dim)]">[ Active: {name} ]</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-[var(--v-tile)] p-2 [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%-10px))]">
                <div className="aspect-[4/5] bg-[var(--v-ink)]/10" />
                <p className="mt-1 font-mono text-[9px] text-[var(--v-ink)]">No. {String(i + 1).padStart(2, "0")}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type Piece = { slug: string; name: string; brand: string; sold: boolean; image: string | null };

/**
 * The Vault as the owner sets it (owner, 18 Oct 2026): every brand's world (colours, where it began,
 * its line and story), the Vault's own blue, the page's words, and the pieces it opens on.
 */
export function VaultForm({ initial, brandsHere, pieces }: { initial: VaultSettings; brandsHere: { name: string; n: number }[]; pieces: Piece[] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveVaultAction, { status: "idle" });
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);

  // The brands: those with a world, then those in the Vault that don't have one yet.
  const names = new Map(brandsHere.map((b) => [brandKey(b.name), b]));
  const keys = [...Object.keys(v.brands), ...[...names.keys()].filter((k) => !v.brands[k])];
  const [open, setOpen] = useState(keys[0] ?? "");
  const [newBrand, setNewBrand] = useState("");
  const label = (k: string) => names.get(k)?.name ?? titleCase(k);
  const world = v.brands[open];

  const setWorld = (k: string, w: BrandWorld) => setV((cur) => ({ ...cur, brands: { ...cur.brands, [k]: w } }));
  // From the latest state, so quick changes in a row all stick.
  const patch = (p: Partial<BrandWorld>) => setV((cur) => (cur.brands[open] ? { ...cur, brands: { ...cur.brands, [open]: { ...cur.brands[open], ...p } } } : cur));
  const patchTheme = (t: Partial<Theme>) => setV((cur) => (cur.brands[open] ? { ...cur, brands: { ...cur.brands, [open]: { ...cur.brands[open], theme: { ...cur.brands[open].theme, ...t } } } } : cur));
  const setCopy = (p: Partial<VaultSettings["copy"]>) => setV((cur) => ({ ...cur, copy: { ...cur.copy, ...p } }));
  const blank = (k: string): BrandWorld => DEFAULT_WORLDS[k] ?? { theme: v.cold, origin: "", line: ["", ""], story: "" };

  const bySlug = new Map(pieces.map((p) => [p.slug, p]));
  const [pick, setPick] = useState("");

  return (
    <form
      action={(fd) => {
        setSaved(v);
        action(fd);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="data" value={JSON.stringify(v)} />

      <Card title="Brands" note="Open a brand to set its colours and story. Its card, its page and its pieces wear them. A brand with no colours of its own wears the Vault's blue.">
        <div role="tablist" aria-label="Brands" className="flex flex-wrap gap-2">
          {keys.map((k) => {
            const w = v.brands[k];
            return (
              <button key={k} type="button" role="tab" aria-selected={open === k} onClick={() => setOpen(k)} className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-semibold ${open === k ? "border-ink bg-ink text-paper" : "border-ink/15 bg-white hover:border-ink"}`}>
                <span aria-hidden className="h-4 w-4 rounded-full border border-black/10" style={{ background: w ? `linear-gradient(135deg, ${w.theme.frost} 50%, ${w.theme.slate} 50%)` : "transparent" }} />
                {label(k)}
                {names.get(k) && <span className={`font-mono text-[11px] font-normal ${open === k ? "text-paper/70" : "text-[#6b6d72]"}`}>{names.get(k)!.n}</span>}
                {!w && <span className={`text-[11px] font-normal ${open === k ? "text-paper/70" : "text-[#7a3e00]"}`}>no colours</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="text-[13px] font-semibold">Add a brand</span>
            <input value={newBrand} maxLength={40} onChange={(e) => setNewBrand(e.target.value)} placeholder="e.g. Stüssy" className={`${input} w-56`} />
          </label>
          <AddButton
            disabled={!brandKey(newBrand) || Boolean(v.brands[brandKey(newBrand)])}
            onClick={() => {
              const k = brandKey(newBrand);
              setWorld(k, blank(k));
              setOpen(k);
              setNewBrand("");
            }}
          >
            Add brand
          </AddButton>
        </div>

        {open && !world && (
          <div className="mt-4 rounded-2xl bg-white p-4 text-[14px]">
            <p>{label(open)} wears the Vault&apos;s blue for now.</p>
            <button type="button" onClick={() => setWorld(open, blank(open))} className="mt-2 font-semibold underline underline-offset-4">
              Give {label(open)} its own colours
            </button>
          </div>
        )}
        {open && world && (
          <div className="mt-4 space-y-3 rounded-2xl border border-ink/10 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Text label="Where it began" value={world.origin} onChange={(origin) => patch({ origin })} max={60} placeholder="Beaverton, Oregon · 1964" />
              <Text label="Line, first half" value={world.line[0]} onChange={(a) => patch({ line: [a, world.line[1]] })} max={40} />
              <Text label="Line, second half" hint="softer" value={world.line[1]} onChange={(b) => patch({ line: [world.line[0], b] })} max={40} />
            </div>
            <Text label="Story" hint="a few lines" long value={world.story} onChange={(story) => patch({ story })} max={400} />
            <ThemeEditor name={label(open)} theme={world.theme} onChange={patchTheme} line={world.line} story={world.story} />
            <div className="flex flex-wrap gap-4 text-[13px]">
              {DEFAULT_WORLDS[open] && (
                <button type="button" onClick={() => setWorld(open, DEFAULT_WORLDS[open])} className="font-semibold underline underline-offset-4">
                  Back to the first colours
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setV((cur) => {
                    const brands = { ...cur.brands };
                    delete brands[open];
                    return { ...cur, brands };
                  })
                }
                className="font-semibold text-[#d70015] underline underline-offset-4"
              >
                Remove {label(open)}&apos;s colours
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title="The Vault's own blue" note="What the Vault wears on its own page under All brands, on the home page, and on any brand without colours.">
        <ThemeEditor name="The Vault" theme={v.cold} onChange={(t) => setV((cur) => ({ ...cur, cold: { ...cur.cold, ...t } }))} />
        <button type="button" onClick={() => setV((cur) => ({ ...cur, cold: COLD }))} className="mt-3 text-[13px] font-semibold underline underline-offset-4">
          Back to the first blue
        </button>
      </Card>

      <Card title="Words on the Vault page" note="A brand's own page uses its line and story instead.">
        <Text label="Opening line" long value={v.copy.intro} onChange={(intro) => setCopy({ intro })} max={200} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Text label="Left of the three pieces, first" value={v.copy.left[0]} onChange={(a) => setCopy({ left: [a, v.copy.left[1]] })} max={40} />
          <Text label="Left of the three pieces, second" value={v.copy.left[1]} onChange={(b) => setCopy({ left: [v.copy.left[0], b] })} max={40} />
          <Text label="Right of the three pieces, first" value={v.copy.right[0]} onChange={(a) => setCopy({ right: [a, v.copy.right[1]] })} max={40} />
          <Text label="Right of the three pieces, second" value={v.copy.right[1]} onChange={(b) => setCopy({ right: [v.copy.right[0], b] })} max={40} />
          <Text label="List title" value={v.copy.listTitle} onChange={(listTitle) => setCopy({ listTitle })} max={60} />
          <Text label="List note" value={v.copy.listNote} onChange={(listNote) => setCopy({ listNote })} max={160} />
        </div>
      </Card>

      <Card title="Pieces it opens on" note="Up to five, in this order, at the top of the Vault page. Leave it empty and the Vault picks: one from each brand, what can still be bought first.">
        {v.featured.length > 0 ? (
          <ol className="space-y-2">
            {v.featured.map((slug, i) => {
              const p = bySlug.get(slug);
              return (
                <li key={slug} className="flex items-center gap-3 rounded-2xl bg-white p-2 pr-3">
                  <span className="grid h-12 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f2f2f0]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a small thumbnail */}
                    {p?.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1 text-[14px]">
                    <span className="block truncate font-semibold">{p?.name ?? slug}</span>
                    <span className="text-[12px] text-[#6b6d72]">{p ? `${p.brand}${p.sold ? " · sold" : ""}` : "No longer in the Vault; it's skipped"}</span>
                  </span>
                  <RowTools i={i} n={v.featured.length} name={p?.name ?? slug} onMove={(a, b) => setV((cur) => ({ ...cur, featured: moved(cur.featured, a, b) }))} onRemove={() => setV((cur) => ({ ...cur, featured: cur.featured.filter((s) => s !== slug) }))} />
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-2xl bg-white px-4 py-3 text-[14px] text-[#55575c]">The Vault picks for you.</p>
        )}
        {v.featured.length < 5 && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="block min-w-0 flex-1">
              <span className="text-[13px] font-semibold">Add a piece</span>
              <select value={pick} onChange={(e) => setPick(e.target.value)} className={input}>
                <option value="">Choose a Vault piece…</option>
                {pieces
                  .filter((p) => !v.featured.includes(p.slug))
                  .map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.brand ? `${p.brand} · ` : ""}
                      {p.name}
                      {p.sold ? " (sold)" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <AddButton
              disabled={!pick}
              onClick={() => {
                setV((cur) => ({ ...cur, featured: [...cur.featured, pick] }));
                setPick("");
              }}
            >
              Add piece
            </AddButton>
          </div>
        )}
      </Card>

      <SaveBar pending={pending} dirty={dirty} message={state.status === "idle" ? undefined : state.message} error={state.status === "error"} onReset={() => setV(saved)} />
    </form>
  );
}
