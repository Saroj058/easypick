import { festivals } from "@/lib/catalogue";
import { formatBS } from "@/lib/nepali-date";
import { site } from "@/lib/site";

const ktmDay = new Intl.DateTimeFormat("en-CA", { timeZone: site.timezone });
const nice = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, weekday: "short", day: "numeric", month: "short" });
const SHOW_FROM_DAYS = 21;

const at = (ymd: string) => new Date(`${ymd}T12:00:00+05:45`);
const both = (ymd: string) => `${nice.format(at(ymd))} (${formatBS(at(ymd))})`;

/**
 * "Order by … for delivery before Dashain." Shows from three weeks before the
 * order-by day until the festival itself. Dates are set in the admin screen.
 */
export async function FestivalNotice({ className = "" }: { className?: string }) {
  const today = ktmDay.format(new Date());
  const soon = new Date(`${today}T12:00:00+05:45`);
  soon.setDate(soon.getDate() + SHOW_FROM_DAYS);
  const horizon = ktmDay.format(soon);

  const f = (await festivals()).find((x) => today <= x.date && x.orderBy <= horizon);
  if (!f) return null;
  const open = today <= f.orderBy;

  return (
    <p className={`flex gap-3 bg-photo px-4 py-3 text-[14px] ${className}`}>
      <span className="mt-1.5 h-2 w-2 shrink-0 bg-volt ring-1 ring-ink" aria-hidden />
      <span>
        <span className="font-semibold">{f.name}</span> is {both(f.date)}.{" "}
        {open ? (
          <>
            Order by <span className="font-semibold">{both(f.orderBy)}</span> for delivery in time.
          </>
        ) : (
          <>Delivery before it has closed, but store pickup still works.</>
        )}
      </span>
    </p>
  );
}
