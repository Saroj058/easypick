import Link from "next/link";

import { hourLabel, type StoreInfo } from "@/lib/store-state";

// Our store, as one line with a way to come in person (owner, 27 Oct 2026: "make it even short; the
// home story already tells how the store and self-checkout work, so just an option to visit"). Where
// and when, and one button to the Visit page. Lime only on the open dot.

function hoursLine(info: StoreInfo) {
  const open = info.hours.filter((h) => !h.closed);
  if (open.length === 0) return null;
  const same = open.every((h) => h.open === open[0].open && h.close === open[0].close);
  if (!same) return "Hours on the Visit page";
  const range = `${hourLabel(open[0].open)} to ${hourLabel(open[0].close)}`;
  return open.length === 7 ? `Every day, ${range}` : range;
}

function badge(info: StoreInfo) {
  if (info.opened) return "Open every day";
  if (info.openingDate) {
    const d = new Date(`${info.openingDate}T12:00:00+05:45`);
    return `Opens ${d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Kathmandu" })}`;
  }
  return "Opening soon";
}

const pill = "inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-paper transition-colors hover:bg-[#333]";

/** `checkout` is kept for the admin switch; how checkout works is told in the home story now. */
export function StoreBand({ info, store = true, checkout = true }: { info: StoreInfo; store?: boolean; checkout?: boolean }) {
  if (!store && !checkout) return null;
  const hours = hoursLine(info);
  const where = info.area || info.address;
  return (
    <section aria-labelledby="store-title" className="border-t border-mist py-4 md:py-5">
      <div className="container-ep flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="min-w-0 text-[13px] text-steel-dark">
          <span id="store-title" role="heading" aria-level={2} className="mr-2 inline-flex items-center gap-2 text-[15px] font-bold text-ink">
            <span className={`h-1.5 w-1.5 rounded-full ${info.opened ? "bg-volt ring-1 ring-ink/30" : "bg-ink"}`} aria-hidden />
            Come in person
          </span>
          {[where, info.opened ? hours : badge(info)].filter(Boolean).join(" · ")}
        </p>
        <Link href="/visit" className={pill}>
          Visit the store <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
