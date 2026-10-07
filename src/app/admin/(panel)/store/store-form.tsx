"use client";

import { useActionState, useState } from "react";

import type { SaveState } from "@/app/admin/actions";
import { saveStore } from "@/app/admin/store-actions";
import { formatBS } from "@/lib/nepali-date";
import { DAY_NAMES, type StoreInfo } from "@/lib/store-state";
import { StartPointsFields } from "./start-points-fields";

const input = "mt-1 h-[52px] w-full rounded-[2px] border border-mist bg-paper px-3 text-base outline-none focus:border-ink";
const lbl = "text-sm font-semibold";
const hint = "mt-1 text-[12px] text-steel-dark";

function Field({ id, label, note, ...rest }: { id: string; label: string; note?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className={lbl}>
        {label}
      </label>
      <input id={id} name={id} className={input} {...rest} />
      {note && <p className={hint}>{note}</p>}
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border border-mist p-5">
      <legend className="px-1 text-lg font-semibold">{title}</legend>
      {note && <p className="mb-4 text-[14px] text-steel-dark">{note}</p>}
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

type SpecialRow = { key: number; date: string; kind: "closed" | "hours"; open: string; close: string; note: string };
type RouteRow = { key: number; text: string; minutes: string };

export function StoreForm({ initial }: { initial: StoreInfo }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveStore, { status: "idle" });
  const [opened, setOpened] = useState(initial.opened);
  const [special, setSpecial] = useState<SpecialRow[]>(
    initial.special.map((s, i) => ({ key: i, date: s.date, kind: s.closed ? "closed" : "hours", open: s.open ?? "11:00", close: s.close ?? "20:00", note: s.note })),
  );
  const [route, setRoute] = useState<RouteRow[]>(
    (initial.route.length ? initial.route : [{ text: "", minutes: 0 }]).map((r, i) => ({ key: i, text: r.text, minutes: String(r.minutes) })),
  );
  // The map pin, kept here so the start points can be checked against it as it's typed.
  const [lat, setLat] = useState(initial.geo ? String(initial.geo.lat) : "");
  const [lng, setLng] = useState(initial.geo ? String(initial.geo.lng) : "");
  const pin = Number(lat) > 26 && Number(lat) < 31 && Number(lng) > 80 && Number(lng) < 89 ? { lat: Number(lat), lng: Number(lng) } : null;
  const setS = (key: number, p: Partial<SpecialRow>) => setSpecial((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const setR = (key: number, p: Partial<RouteRow>) => setRoute((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const bs = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? formatBS(new Date(`${d}T12:00:00+05:45`), true) : "");

  return (
    <form action={action} className="mt-8 space-y-8">
      <Group title="Opening day" note="Until the store is switched to Open, the Visit page shows Coming soon with the opening list. Staff can see the open page any time at /visit?preview=open.">
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="opened" checked={opened} onChange={(e) => setOpened(e.target.checked)} className="h-5 w-5 accent-[#0a0a0a]" />
          <span className="font-semibold">The store is open</span>
        </label>
        {opened && !initial.opened && <p className="bg-volt px-3 py-2 text-[14px] font-semibold">Saving this rolls the shutter up for everyone.</p>}
        <Field id="openingDate" label="Opening day" type="date" defaultValue={initial.openingDate ?? ""} note="For “Opening February 2027” and the countdown." />
      </Group>

      <Group title="Where">
        <Field id="area" label="Area" defaultValue={initial.area} placeholder="Jhamsikhel, Lalitpur" />
        <Field id="address" label="Full address" defaultValue={initial.address ?? ""} note="Needed before switching to Open." />
        <Field id="landmark" label="Landmark" defaultValue={initial.landmark ?? ""} placeholder="Next to …, black shutter with a lime dot" />
        <Field id="mapUrl" label="Google Maps link" defaultValue={initial.mapUrl ?? ""} placeholder="https://maps.app.goo.gl/…" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="lat" label="Map pin latitude" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="27.6844" />
          <Field id="lng" label="Map pin longitude" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="85.3066" />
        </div>
        <p className={hint}>In Google Maps, long-press the door and copy the two numbers.</p>
      </Group>

      <Group title="Route receipt" note="Directions by landmark, printed on the Visit page like a kiosk receipt. Up to 6 steps.">
        <ul className="space-y-3">
          {route.map((r, i) => (
            <li key={r.key} className="grid grid-cols-[1fr_6rem_auto] items-end gap-3">
              <div>
                <label htmlFor={`rt-${r.key}`} className={lbl}>
                  Step {i + 1}
                </label>
                <input id={`rt-${r.key}`} name="rText" maxLength={40} value={r.text} onChange={(e) => setR(r.key, { text: e.target.value })} placeholder="Jhamsikhel Chowk" className={input} />
              </div>
              <div>
                <label htmlFor={`rm-${r.key}`} className={lbl}>
                  Minutes
                </label>
                <input id={`rm-${r.key}`} name="rMin" inputMode="numeric" value={r.minutes} onChange={(e) => setR(r.key, { minutes: e.target.value.replace(/\D/g, "") })} className={input} />
              </div>
              <button type="button" onClick={() => setRoute((rs) => rs.filter((x) => x.key !== r.key))} className="min-h-11 text-[14px] underline" aria-label={`Remove step ${i + 1}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        {route.length < 6 && (
          <button type="button" onClick={() => setRoute((rs) => [...rs, { key: Date.now(), text: "", minutes: "" }])} className="btn btn-outline">
            Add a step
          </button>
        )}
      </Group>

      <Group title="Start points" note="Where people come from, each with a route drawn on the Visit page map and its own receipt. Up to 6; the first is shown first.">
        <StartPointsFields initial={initial} pin={pin} />
      </Group>

      <Group title="Weekly hours" note="Kathmandu time.">
        <ul className="space-y-3">
          {initial.hours.map((h) => (
            <li key={h.day} className="grid grid-cols-[6.5rem_1fr_1fr_auto] items-center gap-3">
              <span className="font-semibold">{DAY_NAMES[h.day]}</span>
              <input name={`open-${h.day}`} type="time" defaultValue={h.open} aria-label={`${DAY_NAMES[h.day]} opens`} className={input} />
              <input name={`close-${h.day}`} type="time" defaultValue={h.close} aria-label={`${DAY_NAMES[h.day]} closes`} className={input} />
              <label className="flex min-h-11 items-center gap-2 text-[14px]">
                <input type="checkbox" name={`closed-${h.day}`} defaultChecked={h.closed} className="h-5 w-5 accent-[#0a0a0a]" />
                Closed
              </label>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Special days" note="Festivals and holidays: closed, or different hours. The note shows on the site, e.g. “Closed for Tika”.">
        <ul className="space-y-4">
          {special.map((s) => (
            <li key={s.key} className="grid gap-3 border border-mist p-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`sd-${s.key}`} className={lbl}>
                  Date
                </label>
                <input id={`sd-${s.key}`} name="sDate" type="date" value={s.date} onChange={(e) => setS(s.key, { date: e.target.value })} className={input} />
                <p className={hint}>{bs(s.date)}</p>
              </div>
              <div>
                <label htmlFor={`sn-${s.key}`} className={lbl}>
                  Note
                </label>
                <input id={`sn-${s.key}`} name="sNote" maxLength={80} value={s.note} onChange={(e) => setS(s.key, { note: e.target.value })} placeholder="Closed for Tika" className={input} />
              </div>
              <div>
                <label htmlFor={`sk-${s.key}`} className={lbl}>
                  That day
                </label>
                <select id={`sk-${s.key}`} name="sKind" value={s.kind} onChange={(e) => setS(s.key, { kind: e.target.value as SpecialRow["kind"] })} className={input}>
                  <option value="closed">Closed</option>
                  <option value="hours">Different hours</option>
                </select>
              </div>
              <div className={`grid grid-cols-2 gap-3 ${s.kind === "closed" ? "invisible" : ""}`}>
                <input name="sOpen" type="time" value={s.open} onChange={(e) => setS(s.key, { open: e.target.value })} aria-label="Opens" className={`${input} self-end`} />
                <input name="sClose" type="time" value={s.close} onChange={(e) => setS(s.key, { close: e.target.value })} aria-label="Closes" className={`${input} self-end`} />
              </div>
              <button type="button" onClick={() => setSpecial((rs) => rs.filter((x) => x.key !== s.key))} className="min-h-11 justify-self-start text-[14px] underline">
                Remove this day
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setSpecial((rs) => [...rs, { key: Date.now(), date: "", kind: "closed", open: "11:00", close: "20:00", note: "" }])} className="btn btn-outline">
          Add a special day
        </button>
      </Group>

      <Group title="Notice" note="One line on the Visit page, e.g. “Closed for Tika, back on Oct 14”. Leave empty for none.">
        <Field id="notice" label="Notice" maxLength={120} defaultValue={initial.notice} />
      </Group>

      <Group title="Getting here" note="Shown on the Visit page and in the FAQ. Leave a line empty to hide it.">
        <Field id="transport" label="Bus or tempo" maxLength={200} defaultValue={initial.transport} />
        <Field id="parking" label="Parking" maxLength={200} defaultValue={initial.parking} />
        <Field id="access" label="Accessibility" maxLength={200} defaultValue={initial.access} />
      </Group>

      <Group title="Contact">
        <Field id="phone" label="Phone" type="tel" defaultValue={initial.phone ?? ""} />
        <Field id="whatsapp" label="WhatsApp" inputMode="numeric" defaultValue={initial.whatsapp ?? ""} note="Digits with country code, e.g. 9779800000000." />
        <Field id="email" label="Email" type="email" defaultValue={initial.email ?? ""} />
        <Field id="instagram" label="Instagram link" defaultValue={initial.instagram ?? ""} placeholder="https://www.instagram.com/easypick" />
      </Group>

      <div className="sticky bottom-0 flex items-center gap-4 border-t border-mist bg-paper py-4">
        <button type="submit" disabled={pending} className="btn btn-volt min-w-40">
          {pending ? "Saving…" : "Save"}
        </button>
        <p role="status" className={`text-[14px] ${state.status === "error" ? "text-error-light" : "text-steel-dark"}`}>
          {state.status === "idle" ? "" : state.message}
        </p>
      </div>
    </form>
  );
}
