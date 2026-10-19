"use client";

import { useEffect, useState } from "react";

import { saveMyFit } from "@/app/auth-actions";
import { fitSummary, hasFit, onFitChange, readFit, saveFit, type FitProfile } from "@/lib/fit-profile";
import { openSizeFinder } from "./size-finder";
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
  // Signed in on a new phone: bring the size saved on the account, unless this one's is newer.
  useEffect(() => {
    if (!me?.fit || !hasFit(me.fit)) return;
    const here = readFit();
    if (!hasFit(here) || (me.fit.updatedAt && (!here.updatedAt || me.fit.updatedAt > here.updatedAt))) saveFit(me.fit);
  }, [me]);
  return profile;
}

/**
 * Their size, saved once (owner, 19 Oct 2026): what it's based on, and Find my size to set or
 * change it in the pop-up. The finding itself is the pop-up (size-finder.tsx).
 */
export function FitFinder({ compact = false }: { compact?: boolean; onSaved?: () => void }) {
  const profile = useFitProfile();
  const me = useMe();
  const has = hasFit(profile);
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {has ? (
        <p className="text-[15px]">
          <span className="font-semibold">Your size is saved.</span> <span className="text-steel-dark">{fitSummary(profile)}</span>
        </p>
      ) : (
        !compact && <p className="text-[15px] text-steel-dark">Height and weight, a size you wear elsewhere, or a piece you own: about 20 seconds, once.</p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => openSizeFinder()} className="btn btn-ink">
          {has ? "Change my size" : "Find my size"}
        </button>
        {has && (
          <button
            type="button"
            onClick={() => {
              saveFit({});
              void saveMyFit({});
            }}
            className="min-h-11 text-sm underline underline-offset-2"
          >
            Forget it
          </button>
        )}
      </div>
      {!compact && <p className="text-[13px] text-steel-dark">{me ? "Saved to your account, so it follows you to any phone you sign in on." : "Saved on this phone. Sign in to keep it on your account."}</p>}
    </div>
  );
}
