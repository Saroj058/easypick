import "server-only";

import { festivals } from "./catalogue";
import { formatBS } from "./nepali-date";
import { site } from "./site";

const ktmDay = new Intl.DateTimeFormat("en-CA", { timeZone: site.timezone });
const nice = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, weekday: "short", day: "numeric", month: "short" });
/** Festival mode starts three weeks before the order-by day. */
const SHOW_FROM_DAYS = 21;

const at = (ymd: string) => new Date(`${ymd}T12:00:00+05:45`);
/** "Thu 9 Oct (२३ असोज)": the AD day with the Bikram Sambat date beside it. */
export const bothDates = (ymd: string) => `${nice.format(at(ymd))} (${formatBS(at(ymd))})`;

export interface FestivalNow {
  name: string;
  /** yyyy-mm-dd */
  date: string;
  orderBy: string;
  /** Delivery in time is still possible (today is on or before the order-by day). */
  open: boolean;
}

/**
 * The festival coming up, from three weeks before its order-by day until the day itself,
 * or null. Dates are set in the admin screen.
 */
export async function currentFestival(now: Date = new Date()): Promise<FestivalNow | null> {
  const today = ktmDay.format(now);
  const soon = at(today);
  soon.setDate(soon.getDate() + SHOW_FROM_DAYS);
  const horizon = ktmDay.format(soon);
  const f = (await festivals()).find((x) => today <= x.date && x.orderBy <= horizon);
  return f ? { name: f.name, date: f.date, orderBy: f.orderBy, open: today <= f.orderBy } : null;
}
