"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { BagLine } from "@/lib/types";

// The bag lives in the browser until checkout. Prices and stock are re-checked on
// the server when the order is placed, so nothing here is trusted.

const KEY = "ep-bag-v1";
const MAX_QTY = 5;

interface BagContextValue {
  lines: BagLine[];
  ready: boolean;
  count: number;
  subtotal: number;
  add: (line: Omit<BagLine, "qty">) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
}

const BagContext = createContext<BagContextValue | null>(null);

function read(): BagLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as BagLine[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(lines: BagLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Private mode or storage blocked: the bag still works for this visit.
  }
}

export function BagProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<BagLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load persisted bag once after hydration
    setLines(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => e.key === KEY && setLines(read());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((fn: (prev: BagLine[]) => BagLine[]) => {
    setLines((prev) => {
      const next = fn(prev);
      write(next);
      return next;
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
