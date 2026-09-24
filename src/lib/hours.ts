import { site } from "./site";

function kathmanduParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: site.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Whether the store is open right now, in Kathmandu time. */
export function isStoreOpen(now = new Date()) {
  const { weekday, minutes } = kathmanduParts(now);
  const { open, close } = site.store.hours;
  return (site.store.openDays as readonly number[]).includes(weekday) && minutes >= toMinutes(open) && minutes < toMinutes(close);
}
