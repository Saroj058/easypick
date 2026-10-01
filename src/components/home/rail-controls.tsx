"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

// The rail's controls. The cards are rendered by the server (passed in as children); this
// filters them in place: My size (remembered in this browser), a budget, and a tab for
// new, sale or one kind of piece. Nothing leaves the page until "See all in the shop",
// which opens the shop with the same filters.

const KEY = "ep-rail-size-v1";
const EVENT = "ep-rail-size";
const SIZES = ["S", "M", "L", "XL"];

/** What the filters need to know about each card, in the same order as the cards. */
export interface RailItem {
  sizes: string[]; // sizes that can be bought online
  category: string;
  price: number;
  isNew: boolean;
  sale: boolean;
}

export interface RailTab {
  key: string; // "all", "new", "sale" or a category
  label: string;
}

function readSize(): string | null {
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

const inTab = (it: RailItem, tab: string) => tab === "all" || (tab === "new" ? it.isNew : tab === "sale" ? it.sale : it.category === tab);

const label = "font-mono text-[10px] uppercase leading-none tracking-[0.16em] text-steel-dark";
const square = "grid h-11 min-w-11 shrink-0 place-items-center border px-2.5 font-mono text-[13px] font-semibold";
const off = "border-mist bg-paper hover:border-ink";
const on = "border-ink bg-volt text-ink";

export function RailControls({
  items,
  tabs,
  budgets,
  step,
  children,
}: {
  items: RailItem[];
  tabs: RailTab[];
  /** "Under" amounts that at least one piece meets. */
  budgets: number[];
  /** How many cards show at first, and how many more each "Show more" adds. */
  step: number;
  children: React.ReactNode;
}) {
  const size = useSyncExternalStore(subscribe, readSize, () => null);
  const [tab, setTab] = useState("all");
  const [budget, setBudget] = useState<number | null>(null);
  const [limit, setLimit] = useState(step);
  const grid = useRef<HTMLDivElement>(null);

  // One-size pieces fit everyone.
  const fits = (it: RailItem) => (!size || it.sizes.includes(size) || it.sizes.includes("ONE")) && (!budget || it.price < budget);
  const counts = useMemo(
    () => Object.fromEntries(tabs.map((t) => [t.key, items.filter((it) => fits(it) && inTab(it, t.key)).length])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fits() changes only with size and budget
    [items, tabs, size, budget],
  );
  const matched = items.flatMap((it, i) => (fits(it) && inTab(it, tab) ? [i] : []));
  const shown = matched.slice(0, limit);
  const showKey = shown.join(",");

  // Show or hide the server-rendered cards to match.
  useEffect(() => {
    const visible = new Set(showKey ? showKey.split(",").map(Number) : []);
    grid.current?.querySelectorAll<HTMLLIElement>("#rail-grid > li").forEach((li, i) => {
      li.hidden = !visible.has(i);
    });
  }, [showKey]);

  function chooseSize(next: string | null) {
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      // storage blocked
    }
    setLimit(step);
    window.dispatchEvent(new Event(EVENT));
  }
  function clear() {
    setTab("all");
    setBudget(null);
    chooseSize(null);
  }

  // The shop, opened with the same filters.
  const query = new URLSearchParams();
  if (tab === "new") query.set("new", "1");
  else if (tab === "sale") query.set("sale", "1");
  else if (tab !== "all") query.set("category", tab);
  if (budget) query.set("price", `u${budget}`);
  if (size) query.set("size", size);
  const shopHref = query.size ? `/shop?${query}` : "/shop";

  const filtered = Boolean(size || budget || tab !== "all");
  const words = [tab !== "all" && tabs.find((t) => t.key === tab)?.label, size && `size ${size}`, budget && `under Rs ${budget.toLocaleString("en-IN")}`].filter(Boolean).join(" · ");
  const more = Math.min(step, matched.length - shown.length);

  return (
    <div ref={grid}>
      {/* The deck: who it's for (size) and how much (budget). */}
      <div className="mt-6 grid border border-ink md:grid-cols-[auto_minmax(0,1fr)]">
        <div role="group" aria-label="My size" className="flex items-center gap-4 border-b border-mist p-2 pl-4 md:border-b-0 md:border-r">
          <p className="mr-auto md:mr-0">
            <span className={`block ${label}`}>My size</span>
            <span className="mt-1.5 block whitespace-nowrap text-[13px] font-semibold leading-none">{size ? "Saved on this phone" : "Pick it once"}</span>
          </p>
          <div className="flex gap-1">
            {SIZES.map((s) => (
              <button key={s} type="button" aria-pressed={size === s} aria-controls="rail-grid" onClick={() => chooseSize(size === s ? null : s)} className={`${square} ${size === s ? on : off}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        {budgets.length > 0 && (
          <div role="group" aria-label="Budget" className="no-scrollbar flex items-center gap-4 overflow-x-auto p-2 pl-4">
            <p>
              <span className={`block ${label}`}>Budget</span>
              <span className="mt-1.5 block whitespace-nowrap text-[13px] font-semibold leading-none">Under</span>
            </p>
            <div className="flex gap-1">
              {budgets.map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={budget === b}
                  aria-controls="rail-grid"
                  onClick={() => {
                    setBudget(budget === b ? null : b);
                    setLimit(step);
                  }}
                  className={`${square} whitespace-nowrap ${budget === b ? on : off}`}
                >
                  Rs {b.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* What kind: tabs with how many pieces each holds under the filters above. */}
      <div role="group" aria-label="Show" className="no-scrollbar -mx-4 mt-3 flex overflow-x-auto border-b border-mist px-4 md:mx-0 md:px-0">
        {tabs.map((t, i) => {
          const active = tab === t.key;
          const n = counts[t.key] ?? 0;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={active}
              aria-controls="rail-grid"
              disabled={n === 0 && !active}
              onClick={() => {
                setTab(t.key);
                setLimit(step);
              }}
              className={`relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[14px] font-semibold first:pl-0 disabled:text-[#aeaeb2] ${active ? "text-ink" : "text-steel-dark enabled:hover:text-ink"}`}
            >
              {t.label}
              <span className="font-mono text-[11px] font-normal tabular-nums">{n}</span>
              {active && <span aria-hidden className={`absolute bottom-0 right-3 h-[3px] bg-ink ${i === 0 ? "left-0" : "left-3"}`} />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex min-h-11 items-center justify-between gap-4">
        <p role="status" className="text-[13px] text-steel-dark">
          <span className="font-mono tabular-nums text-ink">
            {shown.length} of {matched.length}
          </span>{" "}
          {matched.length === 1 ? "piece" : "pieces"}
          {words ? ` · ${words}` : " · newest first"}
        </p>
        {filtered && (
          <button type="button" onClick={clear} className="h-11 shrink-0 px-1 text-[13px] font-semibold underline underline-offset-4">
            Clear
          </button>
        )}
      </div>

      {children}

      {matched.length === 0 && (
        <p id="rail-empty" className="py-12 text-center text-steel-dark">
          Nothing on the rail matches that right now.{" "}
          <button type="button" onClick={clear} className="font-semibold text-ink underline underline-offset-4">
            Clear the filters
          </button>
        </p>
      )}

      <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {more > 0 && (
          <button type="button" onClick={() => setLimit(limit + step)} className="btn btn-ink w-full sm:w-auto">
            Show {more} more
          </button>
        )}
        <Link href={shopHref} className="btn btn-outline w-full sm:w-auto">
          {filtered ? "See these in the shop" : "Shop all"}
        </Link>
      </div>
    </div>
  );
}
