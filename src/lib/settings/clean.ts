// Small helpers for cleaning saved settings: every field falls back to its default when missing or
// the wrong shape, text is trimmed and capped, numbers are clamped. Pure, so tests can use them.

export type Obj = Record<string, unknown>;

export const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

export function text(v: unknown, fallback: string, max = 200): string {
  if (typeof v !== "string") return fallback;
  return v.trim().slice(0, max);
}

/** Like text(), but an empty value falls back too (for labels that must never be blank). */
export function label(v: unknown, fallback: string, max = 80): string {
  const t = text(v, fallback, max);
  return t || fallback;
}

export function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** A list of strings from a fixed set, in the saved order, without repeats. */
export function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T[]): T[] {
  if (!Array.isArray(v)) return fallback;
  const out: T[] = [];
  for (const x of v) if (typeof x === "string" && (allowed as readonly string[]).includes(x) && !out.includes(x as T)) out.push(x as T);
  return out;
}

/** Numbers, sorted and without repeats; any outside min…max is dropped. Falls back when nothing usable is left. */
export function numbers(v: unknown, fallback: number[], min: number, max: number, cap = 8): number[] {
  if (!Array.isArray(v)) return fallback;
  const out = [...new Set(v.map((x) => num(x, NaN, -Infinity, Infinity)).filter((x) => Number.isFinite(x) && x >= min && x <= max).map((x) => Math.round(x)))].sort((a, b) => a - b).slice(0, cap);
  return out.length ? out : fallback;
}
