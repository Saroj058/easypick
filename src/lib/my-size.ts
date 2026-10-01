"use client";

import { useSyncExternalStore } from "react";

// "My size": the letter size someone picked on the home rail. Kept in this browser and used
// wherever a size is chosen for them (the rail's filter, Quick buy), so they say it once.

const KEY = "ep-rail-size-v1";
const EVENT = "ep-rail-size";
export const MY_SIZES = ["S", "M", "L", "XL"];

function read(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && MY_SIZES.includes(v) ? v : null;
  } catch {
    return null; // storage blocked
  }
}

function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** The saved size, or null. Null on the server and on the first paint. */
export function useMySize(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function setMySize(next: string | null) {
  try {
    if (next) localStorage.setItem(KEY, next);
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked
  }
  window.dispatchEvent(new Event(EVENT));
}
