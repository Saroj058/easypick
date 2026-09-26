import "server-only";

import { eq } from "drizzle-orm";

import { moveStock, StockShortError } from "./catalogue";
import { getDb, schema } from "./db";
import type { Product } from "./types";

// A stock count: staff count every piece in the shop (on the floor and in the back),
// paste "SKU,count" lines, check the differences, then apply exactly what they checked.

/** More than this in one size is surely a typo. */
const MAX_COUNT = 100_000;

export type ParsedCounts = {
  counts: Map<string, number>;
  /** Lines that couldn't be read (as typed, shortened). */
  bad: string[];
  /** SKUs that appear more than once (the last line wins). */
  duplicates: string[];
};

/** Strips spreadsheet leftovers around a cell: spaces, quotes, a leading ' (text marker). */
const cell = (s: string) =>
  s
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .trim()
    .replace(/^'/, "")
    .trim();

/**
 * Reads "SKU,count" lines (comma, tab or semicolon; extra columns from the count sheet are
 * ignored). A header line and lines with an empty count (not counted) are skipped quietly;
 * anything else that isn't a whole number of 0 or more is reported.
 */
export function parseCounts(text: string): ParsedCounts {
  const counts = new Map<string, number>();
  const bad: string[] = [];
  const duplicates = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [skuCell = "", nCell] = line.split(/[,\t;]/).map(cell);
    const sku = skuCell.toUpperCase();
    if (sku === "SKU") continue;
    if (nCell === "") continue;
    if (!sku || nCell === undefined || !/^\d+$/.test(nCell) || Number(nCell) > MAX_COUNT) {
      bad.push(line.slice(0, 60));
      continue;
    }
    if (counts.has(sku)) duplicates.add(sku);
    counts.set(sku, Number(nCell));
  }
  return { counts, bad, duplicates: [...duplicates] };
}

export type CountRow = {
  sku: string;
  name: string;
  /** Free to sell now. */
  now: number;
  /** Pieces counted in the shop. */
  counted: number;
  /** Of those, held for orders (placed, paid or waiting at the counter). */
  held: number;
  /** Free to sell after the count: counted − held. */
  target: number;
  delta: number;
};

export type CountPlan = {
  /** Sizes that change. */
  rows: CountRow[];
  /** SKUs not in the catalogue. */
  unknown: string[];
  /** Counted fewer than are held for orders: some held pieces are missing. */
  short: { sku: string; name: string; counted: number; held: number }[];
};

/** Works out what a count changes. `held` comes from heldBySku(). */
export function planCount(counts: Map<string, number>, products: Product[], held: Map<string, number>): CountPlan {
  const bySku = new Map(products.flatMap((p) => p.variants.map((v) => [v.sku.toUpperCase(), { p, v }] as const)));
  const rows: CountRow[] = [];
  const unknown: string[] = [];
  const short: CountPlan["short"] = [];
  for (const [key, counted] of counts) {
    const hit = bySku.get(key);
    if (!hit) {
      unknown.push(key);
      continue;
    }
    const { p, v } = hit;
    const name = `${p.name} · ${v.colour} ${v.size}`;
    const h = held.get(v.sku) ?? 0;
    if (counted < h) short.push({ sku: v.sku, name, counted, held: h });
    const target = Math.max(0, counted - h);
    if (target !== v.stock) rows.push({ sku: v.sku, name, now: v.stock, counted, held: h, target, delta: target - v.stock });
  }
  return { rows, unknown, short };
}

export type PlanItem = { sku: string; now: number; delta: number };

/** Reads the checked changes back from the form (sent as JSON); null if they don't make sense. */
export function readPlan(json: string): PlanItem[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || !raw.length || raw.length > 5000) return null;
  const items: PlanItem[] = [];
  const seen = new Set<string>();
  for (const x of raw as Record<string, unknown>[]) {
    const { sku, now, delta } = x ?? {};
    if (typeof sku !== "string" || !sku || sku.length > 64 || seen.has(sku)) return null;
    if (!Number.isInteger(now) || !Number.isInteger(delta) || (now as number) < 0 || delta === 0 || (now as number) + (delta as number) < 0) return null;
    seen.add(sku);
    items.push({ sku, now: now as number, delta: delta as number });
  }
  return items;
}

export type ApplyResult = {
  applied: PlanItem[];
  /** Stock moved since the check (a sale, an expiry, another change): not changed, count again. */
  moved: { sku: string; expected: number; actual: number }[];
  /** Couldn't be changed (e.g. the size was deleted). */
  failed: { sku: string; message: string }[];
  /** SKUs that came back from none (for restock alerts). */
  restocked: string[];
};

/**
 * Applies exactly the checked changes, one size at a time: each size is locked and only
 * changed if its stock is still what the check showed.
 */
export async function applyCount(plan: PlanItem[], actor: string): Promise<ApplyResult> {
  const db = await getDb();
  const res: ApplyResult = { applied: [], moved: [], failed: [], restocked: [] };
  for (const item of [...plan].sort((a, b) => a.sku.localeCompare(b.sku))) {
    try {
      const outcome = await db.transaction(async (tx) => {
        const [row] = await tx.select({ stock: schema.variants.stock }).from(schema.variants).where(eq(schema.variants.sku, item.sku)).for("update");
        if (!row) return { kind: "gone" as const };
        if (row.stock !== item.now) return { kind: "moved" as const, actual: row.stock };
        const back = await moveStock(tx, [{ sku: item.sku, delta: item.delta }], { reason: "count", source: "admin", ref: "stock count", actor });
        return { kind: "ok" as const, back };
      });
      if (outcome.kind === "gone") res.failed.push({ sku: item.sku, message: "no longer exists" });
      else if (outcome.kind === "moved") res.moved.push({ sku: item.sku, expected: item.now, actual: outcome.actual });
      else {
        res.applied.push(item);
        res.restocked.push(...outcome.back);
      }
    } catch (e) {
      if (!(e instanceof StockShortError)) console.error("[stock count] couldn't change", item.sku, e);
      res.failed.push({ sku: item.sku, message: "couldn't be changed" });
    }
  }
  return res;
}
