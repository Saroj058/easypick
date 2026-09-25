"use client";

import { useEffect, useSyncExternalStore } from "react";

// Saved pieces and recently viewed, kept in this browser (no account needed).
// Every hook on the page stays in sync, and other tabs catch up through "storage" events.

const KEYS = { saved: "ep-saved-v1", recent: "ep-recent-v1" } as const;
type ListName = keyof typeof KEYS;
const RECENT_MAX = 12;
const EMPTY: string[] = [];

const listeners = new Set<() => void>();
const cache: Partial<Record<ListName, { raw: string | null; value: string[] }>> = {};

function read(name: ListName): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEYS[name]);
  } catch {
    return EMPTY;
  }
  const hit = cache[name];
  if (hit && hit.raw === raw) return hit.value; // same array each time until it changes
  let value = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    value = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : EMPTY;
  } catch {
    // unreadable: start again
  }
  cache[name] = { raw, value };
  return value;
}

function write(name: ListName, list: string[]) {
  try {
    localStorage.setItem(KEYS[name], JSON.stringify(list));
  } catch {
    // private mode or storage full: the change just won't stick
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEYS.saved || e.key === KEYS.recent) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useList(name: ListName) {
  return useSyncExternalStore(
    subscribe,
    () => read(name),
    () => EMPTY,
  );
}

export function toggleSaved(slug: string) {
  const list = read("saved");
  write("saved", list.includes(slug) ? list.filter((s) => s !== slug) : [slug, ...list]);
}

function recordView(slug: string) {
  write("recent", [slug, ...read("recent").filter((s) => s !== slug)].slice(0, RECENT_MAX));
}

const Heart = ({ filled, className }: { filled: boolean; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
    <path d="M12 20.5s-7.5-4.6-9.2-9.1C1.6 8.2 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.6 3.7 4.4 6.9-1.7 4.5-9.2 9.1-9.2 9.1Z" />
  </svg>
);

/**
 * Save for later. "chip" sits on a product photo (hover-only on desktop unless saved);
 * "inline" sits next to the price.
 */
export function SaveButton({ slug, name, variant = "inline", className = "" }: { slug: string; name: string; variant?: "chip" | "inline"; className?: string }) {
  const saved = useList("saved").includes(slug);
  const label = saved ? `Remove ${name} from saved` : `Save ${name}`;
  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={() => toggleSaved(slug)}
        aria-pressed={saved}
        aria-label={label}
        className={`flex h-11 w-11 items-center justify-end outline-none transition-opacity duration-200 ${saved ? "" : "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"} ${className}`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-paper/80 text-ink ring-1 ring-ink/10 backdrop-blur-md [button:focus-visible_&]:outline [button:focus-visible_&]:outline-2 [button:focus-visible_&]:outline-offset-2 [button:focus-visible_&]:outline-ink">
          <Heart filled={saved} className={`h-4 w-4 ${saved ? "text-[#d70015]" : ""}`} />
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => toggleSaved(slug)}
      aria-pressed={saved}
      aria-label={label}
      className={`inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold ${className}`}
    >
      <Heart filled={saved} className={`h-5 w-5 ${saved ? "text-[#d70015]" : ""}`} />
      {saved ? "Saved" : "Save"}
    </button>
  );
}

/** Put on a product page: remembers it for "Recently viewed". */
export function RecordView({ slug }: { slug: string }) {
  useEffect(() => recordView(slug), [slug]);
  return null;
}
