// Calendar days in Kathmandu, for "today", reports and CSV files. Nepal is UTC+5:45 all
// year (no daylight saving), so a day's midnight is a fixed offset from UTC.

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" });
const stampFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** yyyy-mm-dd of that moment in Kathmandu (default: now). */
export const ktmDay = (at: Date | number | string = Date.now()) => dayFmt.format(new Date(at));

/** The moment a Kathmandu day (yyyy-mm-dd) starts. */
export const ktmMidnight = (day: string) => new Date(`${day}T00:00:00+05:45`);

/** yyyy-mm-dd plus (or minus) whole calendar days. */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "2026-09-26 14:05:09" in Kathmandu time, for spreadsheets. */
export function ktmStamp(at: Date | number | string) {
  const p = Object.fromEntries(stampFmt.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
