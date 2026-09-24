"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { FitProfile } from "@/lib/fit-profile";

export interface Me {
  name: string | null;
  phone: string | null;
  fit: FitProfile | null;
}

// One shared request per page; re-checked on navigation so logging in or out
// (both end in a redirect) shows up in the header straight away.
let cached: { path: string; req: Promise<Me | null> } | null = null;

function load(path: string): Promise<Me | null> {
  if (cached?.path !== path) {
    cached = {
      path,
      req: fetch("/api/me", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { user: null }))
        .then((b: { user: Me | null }) => b.user)
        .catch(() => null),
    };
  }
  return cached.req;
}

/** The signed-in person (or null), fetched client-side so pages stay cached. `undefined` while loading. */
export function useMe() {
  const path = usePathname();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    load(path).then((m) => live && setMe(m));
    return () => {
      live = false;
    };
  }, [path]);
  return me;
}

/**
 * A text field that fills in a saved value (e.g. your phone) once it loads,
 * but never overwrites what the person has already typed.
 */
export function usePrefilled(saved: string | null | undefined) {
  const [value, setValue] = useState("");
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current && saved) setValue(saved);
  }, [saved]);
  const onChange = (e: { target: { value: string } }) => {
    touched.current = true;
    setValue(e.target.value);
  };
  return { value, onChange };
}
