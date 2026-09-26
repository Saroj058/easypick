// PostgreSQL hands timestamps back as text like "2026-10-01 12:15:00+00". Chrome reads that,
// Safari doesn't (Date.parse gives NaN), so everything the data layer returns goes through here.

/** Any timestamp text from the database → "2026-10-01T12:15:00.000Z". Leaves unreadable text as it is. */
export function isoTime(t: string): string {
  const d = new Date(t.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  return Number.isNaN(d.getTime()) ? t : d.toISOString();
}

export function isoTimeOrNull(t: string | null | undefined): string | null {
  return t ? isoTime(t) : null;
}
