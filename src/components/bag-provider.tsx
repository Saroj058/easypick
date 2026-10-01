"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { bagStorageKey, GUEST_BAG_KEY, LEGACY_BAG_KEY } from "@/lib/bag-storage";
import type { BagLine } from "@/lib/types";
import { useMe } from "./session";

// The bag lives in the browser until checkout. Prices and stock are re-checked on
// the server when the order is placed, so nothing here is trusted.
// Guests have a bag too (no account needed until checkout). Logging in moves the guest
// bag into the account's bag; logging out hides the account's bag, and someone else
// logging in on the same phone gets their own.

const MAX_QTY = 5;

interface BagContextValue {
  lines: BagLine[];
  /** True once we know who's signed in and their bag is loaded. */
  ready: boolean;
  count: number;
  subtotal: number;
  add: (line: Omit<BagLine, "qty">) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
}

type Change = (prev: BagLine[]) => BagLine[];

const BagContext = createContext<BagContextValue | null>(null);

function read(key: string): BagLine[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as BagLine[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(key: string, lines: BagLine[]) {
  try {
    localStorage.setItem(key, JSON.stringify(lines));
  } catch {
    // Private mode or storage blocked: the bag still works for this visit.
  }
}

/** This account's bag. A bag from before bags were per account goes to the first account that loads it. */
function loadFor(key: string): BagLine[] {
  try {
    if (localStorage.getItem(key) === null && localStorage.getItem(LEGACY_BAG_KEY) !== null) {
      const lines = read(LEGACY_BAG_KEY);
      write(key, lines);
      localStorage.removeItem(LEGACY_BAG_KEY);
      return lines;
    }
  } catch {
    // storage blocked: fall through to an empty bag
  }
  return read(key);
}

/** Moves what a guest put in the bag into the account they just logged in to. */
function takeGuestBag(key: string, lines: BagLine[]): BagLine[] {
  const guest = read(GUEST_BAG_KEY);
  if (guest.length === 0) return lines;
  const merged = [...lines];
  for (const g of guest) {
    const i = merged.findIndex((l) => l.sku === g.sku);
    if (i >= 0) merged[i] = { ...merged[i], qty: Math.min(merged[i].qty + g.qty, MAX_QTY) };
    else merged.push(g);
  }
  write(key, merged);
  try {
    localStorage.removeItem(GUEST_BAG_KEY);
  } catch {
    // storage blocked
  }
  return merged;
}

export function BagProvider({ children }: { children: React.ReactNode }) {
  const me = useMe();
  // undefined while the session loads, the guest key when signed out, else this account's key.
  const key = me === undefined ? undefined : me ? bagStorageKey(me.id) : GUEST_BAG_KEY;
  const [state, setState] = useState<{ key: string | null; lines: BagLine[] } | null>(null);
  const keyRef = useRef<string | null | undefined>(undefined);
  // Changes made before we knew who's signed in (e.g. a tap right after the page opened).
  const queued = useRef<Change[]>([]);

  useEffect(() => {
    if (key === undefined) return;
    keyRef.current = key;
    let lines = key ? loadFor(key) : [];
    if (key && key !== GUEST_BAG_KEY) lines = takeGuestBag(key, lines);
    if (key && queued.current.length) {
      for (const fn of queued.current) lines = fn(lines);
      write(key, lines);
    }
    queued.current = [];
    setState({ key, lines });
    if (!key) return;
    const onStorage = (e: StorageEvent) => e.key === key && setState({ key, lines: read(key) });
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const update = useCallback((fn: Change) => {
    const current = keyRef.current;
    if (current === undefined) {
      queued.current.push(fn);
      return;
    }
    if (current === null) return;
    setState((prev) => {
      if (!prev || prev.key !== current) return prev;
      const next = fn(prev.lines);
      write(current, next);
      return { key: current, lines: next };
    });
  }, []);

  // Actions never change identity, so effects that call them (e.g. clearing the
  // bag after an order) don't re-run when the bag updates.
  const actions = useMemo(
    () => ({
      add: (line: Omit<BagLine, "qty">) =>
        update((prev) => {
          const existing = prev.find((l) => l.sku === line.sku);
          if (existing) return prev.map((l) => (l.sku === line.sku ? { ...l, qty: Math.min(l.qty + 1, MAX_QTY) } : l));
          return [...prev, { ...line, qty: 1 }];
        }),
      setQty: (sku: string, qty: number) =>
        update((prev) =>
          qty <= 0 ? prev.filter((l) => l.sku !== sku) : prev.map((l) => (l.sku === sku ? { ...l, qty: Math.min(qty, MAX_QTY) } : l)),
        ),
      remove: (sku: string) => update((prev) => prev.filter((l) => l.sku !== sku)),
      clear: () => update((prev) => (prev.length ? [] : prev)),
    }),
    [update],
  );

  const ready = key !== undefined && state !== null && state.key === key;
  const lines = useMemo(() => (ready && state ? state.lines : []), [ready, state]);

  const value = useMemo<BagContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((n, l) => n + l.qty * l.price, 0),
      ...actions,
    }),
    [lines, ready, actions],
  );

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag() {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error("useBag must be used inside <BagProvider>");
  return ctx;
}
