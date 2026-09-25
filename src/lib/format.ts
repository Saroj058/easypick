import { site } from "./site";
import { formatBS } from "./nepali-date";

const npr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** "Rs 1,999". Nepali/Indian digit grouping: 10,50,000. */
export function formatPrice(amount: number) {
  return `Rs ${npr.format(amount)}`;
}

/** "Fri 2 Oct, 6 PM" in Kathmandu time. */
/** "Fri 2 Oct, 6 PM", or with `bs` "Fri 2 Oct (Asoj 16), 6 PM". */
export function formatDropTime(iso: string, opts?: { bs?: boolean }) {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, weekday: "short", day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: site.timezone, hour: "numeric", minute: "2-digit" })
    .format(d)
    .replace(":00", "");
  return opts?.bs ? `${day} (${formatBS(d)}), ${time}` : `${day}, ${time}`;
}

/** "11 AM" from "11:00". */
export function formatHour(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

/** Nepali mobile numbers: 10 digits starting 96, 97 or 98. Accepts +977 / spaces. */
export function normaliseNepaliMobile(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "").replace(/^977/, "");
  return /^9[678]\d{8}$/.test(digits) ? digits : null;
}
