"use client";

import { useActionState, useState } from "react";

import { saveHomeAction } from "@/app/admin/settings-actions";
import type { SaveState } from "@/app/admin/actions";
import { SECTION_NAMES, type HomeSettings } from "@/lib/settings/home-rules";
import type { Category } from "@/lib/types";
import { AddButton, Card, moved, Num, RowTools, SaveBar, Switch, Text } from "../kit";

/** Every home page setting on one page, in the order the page reads (owner, 18 Oct 2026). */
export function HomeForm({ initial, kinds }: { initial: HomeSettings; kinds: { id: Category; label: string }[] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveHomeAction, { status: "idle" });
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const set = <K extends keyof HomeSettings>(k: K, patch: Partial<HomeSettings[K]>) => setV((cur) => ({ ...cur, [k]: { ...(cur[k] as object), ...patch } }));
  const kindName = (k: Category) => kinds.find((x) => x.id === k)?.label ?? k;

  return (
    <form
      action={(fd) => {
        setSaved(v);
        action(fd);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="data" value={JSON.stringify(v)} />

      <Card title="Sections" note="What the home page shows, top to bottom. Switch one off to hide it; the arrows move it.">
        <ul className="divide-y divide-ink/[0.06] rounded-2xl bg-white px-3">
          {v.sections.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 py-1.5">
              <span className="w-6 text-center font-mono text-[12px] text-[#8a8c91]">{i + 1}</span>
              <span className={`min-w-0 flex-1 text-[14.5px] ${s.on ? "font-semibold" : "text-[#8a8c91] line-through"}`}>{SECTION_NAMES[s.id]}</span>
              <span className="w-24">
                <Switch label="" on={s.on} onChange={(on) => setV((cur) => ({ ...cur, sections: cur.sections.map((x) => (x.id === s.id ? { ...x, on } : x)) }))} />
              </span>
              <RowTools i={i} n={v.sections.length} name={SECTION_NAMES[s.id]} onMove={(a, b) => setV((cur) => ({ ...cur, sections: moved(cur.sections, a, b) }))} />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Hero" note="The first screen: the line over the headline, the words under it, the buttons, and how the pieces turn.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Small line over the headline" hint="empty hides it" value={v.hero.eyebrow} onChange={(eyebrow) => set("hero", { eyebrow })} max={60} />
          <Num label="Seconds per piece" min={2} max={20} value={v.hero.seconds} onChange={(seconds) => set("hero", { seconds })} />
          <Text label="Headline, line 1" hint="when there's no drop" value={v.hero.fallback[0]} onChange={(a) => set("hero", { fallback: [a, v.hero.fallback[1]] })} max={30} />
          <Text label="Headline, line 2" value={v.hero.fallback[1]} onChange={(b) => set("hero", { fallback: [v.hero.fallback[0], b] })} max={30} />
          <Text label="Big line" value={v.hero.pitch} onChange={(pitch) => set("hero", { pitch })} max={120} />
          <Text label="Big line, grey part" value={v.hero.pitchQuiet} onChange={(pitchQuiet) => set("hero", { pitchQuiet })} max={120} />
          <Text label="Small text, line 1" value={v.hero.line1} onChange={(line1) => set("hero", { line1 })} max={80} />
          <Text label="Small text, line 2" value={v.hero.line2} onChange={(line2) => set("hero", { line2 })} max={80} />
          <Text label="Visit button" value={v.hero.visitLabel} onChange={(visitLabel) => set("hero", { visitLabel })} max={30} />
          <Text label="Drop button" hint="{n} is the drop number" value={v.hero.dropButton} onChange={(dropButton) => set("hero", { dropButton })} max={30} />
          <Text label="Button when there's no drop" value={v.hero.noDropButton} onChange={(noDropButton) => set("hero", { noDropButton })} max={30} />
        </div>
        <div className="mt-4 rounded-2xl bg-white p-4">
          <Switch label="Show sold-out and coming-soon pieces" note="Off: only pieces you can buy now turn in the hero." on={v.hero.showUnavailable} onChange={(showUnavailable) => set("hero", { showUnavailable })} />
        </div>
        <p className="mt-4 text-[13px] font-semibold">Kinds, taken in turn</p>
        <p className="text-[12.5px] text-[#6b6d72]">The hero takes one piece of each kind in this order, then goes round again.</p>
        <ul className="mt-2 divide-y divide-ink/[0.06] rounded-2xl bg-white px-3">
          {v.hero.kinds.map((k, i) => (
            <li key={k} className="flex items-center gap-3 py-1">
              <span className="w-6 text-center font-mono text-[12px] text-[#8a8c91]">{i + 1}</span>
              <span className="flex-1 text-[14px]">{kindName(k)}</span>
              <RowTools i={i} n={v.hero.kinds.length} name={kindName(k)} onMove={(a, b) => set("hero", { kinds: moved(v.hero.kinds, a, b) })} onRemove={v.hero.kinds.length > 1 ? () => set("hero", { kinds: v.hero.kinds.filter((x) => x !== k) }) : undefined} />
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {kinds
            .filter((k) => !v.hero.kinds.includes(k.id))
            .map((k) => (
              <button key={k.id} type="button" onClick={() => set("hero", { kinds: [...v.hero.kinds, k.id] })} className="h-9 cursor-pointer rounded-full border border-ink/15 bg-white px-3 text-[13px] hover:border-ink">
                + {k.label}
              </button>
            ))}
        </div>
      </Card>

      <Card title="The rail" note="The product wall: its name, its sections top to bottom with the kinds in each, the budget buttons and how many pieces each section shows.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Text label="Name" value={v.rail.title} onChange={(title) => set("rail", { title })} max={30} />
          <Num label="Pieces per section" min={2} max={12} value={v.rail.perSection} onChange={(perSection) => set("rail", { perSection })} />
          <Text
            label="Budget buttons"
            hint="Rs, with commas"
            value={v.rail.budgets.join(", ")}
            onChange={(t) => set("rail", { budgets: t.split(/[,\s]+/).map(Number).filter((n) => n > 0) })}
            max={60}
          />
        </div>
        <ul className="mt-4 space-y-2">
          {v.rail.bays.map((b, i) => (
            <li key={i} className="rounded-2xl bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <Text label="Section name" value={b.name} onChange={(name) => set("rail", { bays: v.rail.bays.map((x, j) => (j === i ? { ...x, name } : x)) })} max={40} />
                  <Text label="Small line" value={b.caption} onChange={(caption) => set("rail", { bays: v.rail.bays.map((x, j) => (j === i ? { ...x, caption } : x)) })} max={60} />
                </div>
                <RowTools i={i} n={v.rail.bays.length} name={b.name} onMove={(a, c) => set("rail", { bays: moved(v.rail.bays, a, c) })} onRemove={v.rail.bays.length > 1 ? () => set("rail", { bays: v.rail.bays.filter((_, j) => j !== i) }) : undefined} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {kinds.map((k) => {
                  const inIt = b.kinds.includes(k.id);
                  return (
                    <button
                      key={k.id}
                      type="button"
                      aria-pressed={inIt}
                      onClick={() => set("rail", { bays: v.rail.bays.map((x, j) => (j === i ? { ...x, kinds: inIt ? x.kinds.filter((y) => y !== k.id) : [...x.kinds, k.id] } : x)) })}
                      className={`h-8 cursor-pointer rounded-full px-3 text-[12.5px] ${inIt ? "bg-ink text-paper" : "border border-ink/15 hover:border-ink"}`}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        <AddButton disabled={v.rail.bays.length >= 8} onClick={() => set("rail", { bays: [...v.rail.bays, { name: "New section", caption: "", kinds: [] }] })}>
          Add a section
        </AddButton>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Designer Fits strip">
          <div className="grid gap-3">
            <Text label="Name" value={v.fits.title} onChange={(title) => set("fits", { title })} max={40} />
            <Text label="Button" value={v.fits.button} onChange={(button) => set("fits", { button })} max={30} />
          </div>
        </Card>
        <Card title="Pick your offer">
          <div className="grid gap-3">
            <Text label="Small line" value={v.offers.eyebrow} onChange={(eyebrow) => set("offers", { eyebrow })} max={40} />
            <Text label="Headline" value={v.offers.title} onChange={(title) => set("offers", { title })} max={60} />
            <Text label="Grey line" value={v.offers.line} onChange={(line) => set("offers", { line })} max={60} />
          </div>
        </Card>
        <Card title="The Vault">
          <div className="grid gap-3">
            <Text label="Name" value={v.vault.title} onChange={(title) => set("vault", { title })} max={40} />
            <Text label="Line" value={v.vault.line} onChange={(line) => set("vault", { line })} max={120} />
            <Text label="Button" value={v.vault.button} onChange={(button) => set("vault", { button })} max={30} />
          </div>
        </Card>
        <Card title="Buying for someone?">
          <div className="grid gap-3">
            <Text label="Headline" value={v.gift.title} onChange={(title) => set("gift", { title })} max={60} />
            <Text label="Line" value={v.gift.line} onChange={(line) => set("gift", { line })} max={140} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label="Gift button" value={v.gift.send} onChange={(send) => set("gift", { send })} max={30} />
              <Text label="Gift card button" value={v.gift.cards} onChange={(cards) => set("gift", { cards })} max={30} />
            </div>
          </div>
        </Card>
        <Card title="Track an order">
          <div className="grid gap-3">
            <Text label="Headline" value={v.track.title} onChange={(title) => set("track", { title })} max={40} />
            <Text label="Line" value={v.track.line} onChange={(line) => set("track", { line })} max={80} />
          </div>
        </Card>
      </div>

      <SaveBar pending={pending} dirty={dirty} message={state.status === "idle" ? undefined : state.message} error={state.status === "error"} onReset={() => setV(saved)} />
    </form>
  );
}
