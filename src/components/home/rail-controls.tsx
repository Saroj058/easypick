"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { MY_SIZES, setMySize, useMySize } from "@/lib/my-size";

// The rail. The cards are rendered by the server and handed over as a list; this decides
// which show and in what order: My size (remembered in this browser), a budget, a tab for
// new, sale or one kind of piece, and newest or cheapest first. The tab, budget, sort and
// how many are open are kept for this visit, so coming back from a product page finds the
// rail as it was. "See these in the shop" opens the shop with the same filters.

/** What the filters need to know about each live piece, newest first. */
export interface RailItem {
  id: string;
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

type Sort = "new" | "price";
interface View {
  tab: string;
  budget: number | null;
  sort: Sort;
  limit: number;
}

const VIEW_KEY = "ep-rail-v1";
const VIEW_EVENT = "ep-rail-view";
let cachedRaw: string | null = null;
let cachedView: View | null = null;

/** This visit's rail choices. The same object comes back until the stored text changes. */
function readView(): View | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(VIEW_KEY);
  } catch {
    // storage blocked
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedView = raw ? (JSON.parse(raw) as View) : null;
    } catch {
      cachedView = null;
    }
  }
  return cachedView;
}

function writeView(view: View) {
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(view));
  } catch {
    // storage blocked: the choice still holds until the page is left
    cachedRaw = JSON.stringify(view);
    cachedView = view;
  }
  window.dispatchEvent(new Event(VIEW_EVENT));
}

function subscribeView(fn: () => void) {
  window.addEventListener(VIEW_EVENT, fn);
  return () => window.removeEventListener(VIEW_EVENT, fn);
}

const inTab = (it: RailItem, tab: string) => tab === "all" || (tab === "new" ? it.isNew : tab === "sale" ? it.sale : it.category === tab);
// One-size pieces fit everyone.
const inSize = (it: RailItem, size: string | null) => !size || it.sizes.includes(size) || it.sizes.includes("ONE");
const inBudget = (it: RailItem, budget: number | null) => !budget || it.price < budget;

const caption = "mb-1.5 font-mono text-[10px] uppercase leading-none tracking-[0.16em] text-steel-dark xl:mb-0";
const cell = "-ml-px grid h-11 place-items-center border font-mono text-[13px] font-semibold first:ml-0";
const cellOff = "border-mist bg-paper hover:z-10 hover:border-ink";
const cellOn = "z-10 border-ink bg-ink text-paper";
const cellNone = "border-mist bg-photo text-[#8e8e93] line-through";

export function RailControls({
  items,
  cards,
  tabs,
  budgets,
  step,
}: {
  /** Every live piece, newest first. */
  items: RailItem[];
  /** The cards for the first of those (the rail holds the newest; the shop holds them all). */
  cards: React.ReactNode[];
  tabs: RailTab[];
  /** "Under" amounts that narrow the rail. */
  budgets: number[];
  /** How many cards show at first, and how many more each "Show more" adds. */
  step: number;
}) {
  const size = useMySize();
  const stored = useSyncExternalStore(subscribeView, readView, () => null);
  // What was stored may no longer exist (a sale ended, a kind sold through).
  const tab = stored && tabs.some((t) => t.key === stored.tab) ? stored.tab : "all";
  const budget = stored?.budget && budgets.includes(stored.budget) ? stored.budget : null;
  const sort: Sort = stored?.sort === "price" ? "price" : "new";
  const limit = Math.max(step, stored?.limit ?? step);
  const set = (next: Partial<View>) => writeView({ tab, budget, sort, limit: step, ...next });

  const counts = useMemo(
    () => ({
      tab: Object.fromEntries(tabs.map((t) => [t.key, items.filter((it) => inSize(it, size) && inBudget(it, budget) && inTab(it, t.key)).length])),
      size: Object.fromEntries(MY_SIZES.map((s) => [s, items.filter((it) => inSize(it, s) && inBudget(it, budget) && inTab(it, tab)).length])),
      budget: Object.fromEntries(budgets.map((b) => [b, items.filter((it) => inSize(it, size) && inBudget(it, b) && inTab(it, tab)).length])),
    }),
    [items, tabs, budgets, size, budget, tab],
  );

  const matched = items.flatMap((it, i) => (inSize(it, size) && inBudget(it, budget) && inTab(it, tab) ? [i] : []));
  // Cheapest first keeps newest first among equal prices.
  const byOrder = (list: number[]) => (sort === "price" ? [...list].sort((a, b) => items[a].price - items[b].price || a - b) : list);
  const onRail = byOrder(matched.filter((i) => i < cards.length));
  const shown = onRail.slice(0, limit);
  const visible = new Set(shown);
  // Every card stays in the list (hidden ones keep their place in the order), so nothing remounts.
  const order = byOrder(cards.map((_, i) => i));
  const more = Math.min(step, onRail.length - shown.length);

  // After "Show more", move focus to the first card it added; after clearing, to the heading.
  const list = useRef<HTMLUListElement>(null);
  const focusAt = useRef<number | "title" | null>(null);
  useEffect(() => {
    const at = focusAt.current;
    focusAt.current = null;
    if (at === "title") document.getElementById("rail-title")?.focus({ preventScroll: true });
    else if (at !== null) list.current?.querySelectorAll<HTMLAnchorElement>(":scope > li:not([hidden]) a[href]")[at]?.focus({ preventScroll: true });
  });

  function clear() {
    focusAt.current = "title";
    writeView({ tab: "all", budget: null, sort, limit: step });
    setMySize(null);
  }

  // The shop, opened with the same filters.
  const query = new URLSearchParams();
  if (tab === "new") query.set("new", "1");
  else if (tab === "sale") query.set("sale", "1");
  else if (tab !== "all") query.set("category", tab);
  if (budget) query.set("price", `u${budget}`);
  if (size) query.set("size", size);
  if (sort === "price") query.set("sort", "price-asc");
  const qs = query.toString();
  const shopHref = qs ? `/shop?${qs}` : "/shop";

  const filtered = Boolean(size || budget || tab !== "all");
  const words = [tab !== "all" && tabs.find((t) => t.key === tab)?.label, size && `size ${size}`, budget && `under Rs ${budget.toLocaleString("en-IN")}`].filter(Boolean).join(" · ");

  return (
    <div data-size={size ?? undefined} className="group/rail">
      {/* The heading, with what's showing and the order beside it. */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="rail-title" tabIndex={-1} className="display text-[clamp(2.25rem,1.6rem+2.4vw,3.75rem)] leading-[0.92] outline-none">
          The rail
        </h2>
        <div className="flex items-center gap-1">
          <p role="status" className="pr-2 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">
            {filtered ? (
              <>
                <span className="text-ink">{matched.length}</span> of {items.length}
                <span className="sr-only"> pieces · {words}</span>
              </>
            ) : (
              <>
                {items.length} {items.length === 1 ? "piece" : "pieces"}
              </>
            )}
          </p>
          {filtered && (
            <button type="button" onClick={clear} className="h-11 px-2 text-[13px] font-semibold underline underline-offset-4">
              Clear
            </button>
          )}
          {matched.length > 1 && (
            <button
              type="button"
              aria-label={sort === "price" ? "Sorted by price, low to high. Switch to newest first" : "Sorted newest first. Switch to price, low to high"}
              onClick={() => set({ sort: sort === "price" ? "new" : "price", limit })}
              className="flex h-11 items-center gap-1.5 border border-mist px-3 text-[13px] font-semibold hover:border-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M7 4v16M7 20l-4-4M17 20V4M17 4l4 4" />
              </svg>
              {sort === "price" ? "Price" : "Newest"}
            </button>
          )}
        </div>
      </div>

      {/* Phones: size and budget on one row, the tabs under it. Wide screens: one row, tabs first. */}
      <div className="mt-4 flex flex-col gap-2 xl:flex-row-reverse xl:items-end xl:justify-between xl:gap-6 xl:border-b xl:border-mist">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 xl:flex xl:shrink-0 xl:gap-5 xl:pb-2">
          <div role="group" aria-label="My size" className="xl:flex xl:items-center xl:gap-2.5">
            <p className={caption}>My size{size ? " · saved" : ""}</p>
            <div className="flex">
              {MY_SIZES.map((s) => {
                const active = size === s;
                const none = !active && counts.size[s] === 0;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={active}
                    aria-controls="rail-grid"
                    disabled={none}
                    onClick={() => {
                      set({});
                      setMySize(active ? null : s);
                    }}
                    className={`${cell} w-11 ${active ? cellOn : none ? cellNone : cellOff}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          {budgets.length > 0 && (
            <div role="group" aria-label="Budget" className="xl:flex xl:items-center xl:gap-2.5">
              <p className={caption}>Under Rs</p>
              <div className="flex">
                {budgets.map((b) => {
                  const active = budget === b;
                  const none = !active && counts.budget[b] === 0;
                  return (
                    <button
                      key={b}
                      type="button"
                      aria-pressed={active}
                      aria-controls="rail-grid"
                      aria-label={`Under Rs ${b.toLocaleString("en-IN")}`}
                      disabled={none}
                      onClick={() => set({ budget: active ? null : b })}
                      className={`${cell} min-w-11 flex-1 px-1 xl:flex-none xl:px-3 ${active ? cellOn : none ? cellNone : cellOff}`}
                    >
                      {b.toLocaleString("en-IN")}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* What kind, with how many pieces each holds under the filters above. */}
        <div role="group" aria-label="Show" className="no-scrollbar -mx-4 flex min-w-0 overflow-x-auto border-b border-mist px-4 md:mx-0 md:px-0 xl:border-b-0">
          {tabs.map((t, i) => {
            const active = tab === t.key;
            const n = counts.tab[t.key] ?? 0;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={active}
                aria-controls="rail-grid"
                disabled={n === 0 && !active}
                onClick={() => set({ tab: t.key })}
                className={`relative flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-[14px] font-semibold disabled:text-[#8e8e93] ${i === 0 ? "pl-0" : ""} ${active ? "text-ink" : "text-steel-dark enabled:hover:text-ink"}`}
              >
                {t.label}
                <span className="font-mono text-[11px] font-normal tabular-nums">
                  {n}
                  <span className="sr-only"> {n === 1 ? "piece" : "pieces"}</span>
                </span>
                {active && <span aria-hidden className={`absolute bottom-0 right-3 h-0.5 bg-ink ${i === 0 ? "left-0" : "left-3"}`} />}
              </button>
            );
          })}
        </div>
      </div>

      <ul ref={list} id="rail-grid" className="mt-5 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 md:gap-y-12 lg:grid-cols-4">
        {order.map((i) => (
          <li key={items[i].id} data-sizes={items[i].sizes.join(" ")} hidden={!visible.has(i)}>
            {cards[i]}
          </li>
        ))}
      </ul>

      {matched.length === 0 ? (
        <div id="rail-empty" className="py-16 text-center">
          <p className="text-steel-dark">Nothing {words ? `in ${words}` : "here"} right now.</p>
          <button type="button" onClick={clear} className="btn btn-outline mt-5">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-2">
          {more > 0 && (
            <button
              type="button"
              onClick={() => {
                focusAt.current = shown.length;
                set({ limit: limit + step });
              }}
              className="btn btn-ink w-full sm:w-auto"
            >
              Show {more} more
            </button>
          )}
          <Link href={shopHref} className={more > 0 ? "flex h-11 items-center text-[15px] font-semibold underline underline-offset-4" : "btn btn-outline w-full sm:w-auto"}>
            {filtered ? "See these in the shop" : "Shop all"}
          </Link>
        </div>
      )}
    </div>
  );
}
