"use client";

import { useEffect, useId, useState } from "react";

import { saveMyFit } from "@/app/auth-actions";
import { hasFit, onFitChange, readFit, saveFit, type FitProfile } from "@/lib/fit-profile";
import { useMe } from "./session";

/** The saved fit profile, kept in sync across components and tabs. */
export function useFitProfile() {
  const [profile, setProfile] = useState<FitProfile>({});
  const me = useMe();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage once mounted
    setProfile(readFit());
    return onFitChange(setProfile);
  }, []);
  // Signed in on a new phone: bring the size saved on the account.
  useEffect(() => {
    if (me?.fit && hasFit(me.fit) && !hasFit(readFit())) saveFit(me.fit);
  }, [me]);
  return profile;
}

function Field({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-[13px] text-steel-dark">
        {hint}
      </p>
      <div className="relative mt-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={40}
          max={200}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${id}-hint`}
          className="h-14 w-full rounded-[2px] border border-steel-dark bg-paper pl-4 pr-12 font-mono text-lg tabular-nums"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm text-steel-dark">cm</span>
      </div>
    </div>
  );
}

/**
 * Measure a piece you already love, once. Every product then marks the size
 * closest to it. Stored only in this browser.
 */
export function FitFinder({ compact = false, onSaved }: { compact?: boolean; onSaved?: () => void }) {
  const profile = useFitProfile();
  const me = useMe();
  const id = useId();
  const [draft, setDraft] = useState<Record<keyof FitProfile, string> | null>(null);
  const [saved, setSaved] = useState(false);

  const values = draft ?? {
    chest: profile.chest ? String(profile.chest) : "",
    length: profile.length ? String(profile.length) : "",
    waist: profile.waist ? String(profile.waist) : "",
  };
  const set = (k: keyof FitProfile) => (v: string) => {
    setDraft({ ...values, [k]: v });
    setSaved(false);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = (v: string) => {
      const n = Number(v);
      return n >= 40 && n <= 200 ? Math.round(n) : undefined;
    };
    const next = { chest: num(values.chest), length: num(values.length), waist: num(values.waist) };
    saveFit(next);
    void saveMyFit(next); // no-op when signed out
    setDraft(null);
    setSaved(true);
    onSaved?.();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!compact && (
        <ol className="grid gap-3 text-[15px] text-steel-dark sm:grid-cols-3">
          <li>
            Take a tee or trousers that fit you well.
          </li>
          <li>
            Lay it flat. Measure straight across, then double it.
          </li>
          <li>
            Save. Every product marks your size.
          </li>
        </ol>
      )}
      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <Field id={`${id}-chest`} label="Chest of your top" hint="Armpit to armpit × 2" value={values.chest} onChange={set("chest")} />
        {!compact && <Field id={`${id}-length`} label="Length of your top" hint="Shoulder to hem" value={values.length} onChange={set("length")} />}
        <Field id={`${id}-waist`} label="Waist of your trousers" hint="Side to side × 2" value={values.waist} onChange={set("waist")} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-ink">
          Save my fit
        </button>
        {hasFit(profile) && (
          <button
            type="button"
            onClick={() => {
              saveFit({});
              void saveMyFit({});
              setDraft(null);
            }}
            className="min-h-11 text-sm underline underline-offset-2"
          >
            Clear
          </button>
        )}
        <p role="status" className="text-sm font-semibold">
          {saved ? "Saved. Sizes now show your match." : ""}
        </p>
      </div>
      <p className="text-[13px] text-steel-dark">
        {me ? "Saved to your account, so it follows you to any phone you sign in on." : "Saved on this phone only. Sign in to keep it on your account."}
      </p>
    </form>
  );
}
