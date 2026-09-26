// "Today" for gift dates is the Kathmandu calendar day, on the server (UTC) and in the
// browser alike. Safe to import from client components.

const ktmDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" });

/** yyyy-mm-dd in Kathmandu. */
export function kathmanduToday(now: Date = new Date()): string {
  return ktmDay.format(now);
}

/** True when a yyyy-mm-dd date is after today in Kathmandu. */
export function isFutureKathmanduDate(day: string | null | undefined, now: Date = new Date()): boolean {
  return Boolean(day) && day! > kathmanduToday(now);
}
