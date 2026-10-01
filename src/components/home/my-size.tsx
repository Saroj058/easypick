"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

// "My size" on the home rail: pick a size once and the rail only shows pieces that can be
// bought in it. The choice is remembered in this browser and carried into the shop links.

const KEY = "ep-rail-size-v1";
const EVENT = "ep-rail-size";
const SIZES = ["S", "M", "L", "XL"];

/** Shows or hides the server-rendered rail cards and points the rail's links at the same size. Returns how many show. */
function apply(size: string | null, limit: number) {
  const items = Array.from(document.querySelectorAll<HTMLLIElement>("#rail-grid > li"));
  let shown = 0;
  for (const li of items) {
    const has = (li.dataset.sizes ?? "").split(" ");
    const fits = !size || has.includes(size) || has.includes("ONE"); // one-size pieces fit everyone
    li.hidden = !fits || shown >= limit;
    if (!li.hidden) shown++;
  }
  const empty = document.getElementById("rail-empty");
  if (empty) empty.hidden = shown > 0;

  for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-rail-link]")) {
    const url = new URL(a.href);
    if (size) url.searchParams.set("size", size);
    else url.searchParams.delete("size");
    a.setAttribute("href", url.pathname + url.search);
  }
  return shown;
}

function read(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && SIZES.includes(v) ? v : null;
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

export function MySize({ limit }: { limit: number }) {
  const size = useSyncExternalStore(subscribe, read, () => null);
  const [said, setSaid] = useState("");
  const router = useRouter();

  // The rail's links are rendered by the server without a size, so a tap follows the
  // link as it reads now (with the size added by apply()).
  useEffect(() => {
    if (!size) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[data-rail-link]");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      router.push(a.getAttribute("href") ?? "/shop");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [size, router]);

  useEffect(() => {
    const shown = apply(size, limit);
    // Told to screen readers only after someone picks; the first load stays quiet.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the count comes from the DOM just updated
    setSaid(size ? (shown ? `Showing ${shown} ${shown === 1 ? "piece" : "pieces"} in ${size}` : `Nothing on the rail in ${size} right now`) : "");
  }, [size, limit]);

  function choose(next: string | null) {
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      // storage blocked
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div role="group" aria-label="My size" className="flex h-11 items-center border border-ink">
      <span className="whitespace-nowrap px-3 text-sm font-semibold">My size</span>
      {SIZES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={size === s}
          aria-controls="rail-grid"
          onClick={() => choose(size === s ? null : s)}
          className={`h-full min-w-10 border-l border-mist px-2 font-mono text-[13px] font-semibold ${size === s ? "bg-ink text-paper" : "hover:bg-photo"}`}
        >
          {s}
        </button>
      ))}
      <span role="status" className="sr-only">
        {said}
      </span>
    </div>
  );
}
