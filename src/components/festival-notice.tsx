import { bothDates, currentFestival } from "@/lib/festival";

/**
 * "Order by … for delivery before Dashain." Shows from three weeks before the
 * order-by day until the festival itself. Dates are set in the admin screen.
 */
export async function FestivalNotice({ className = "" }: { className?: string }) {
  const f = await currentFestival();
  if (!f) return null;

  return (
    <p className={`flex gap-3 bg-photo px-4 py-3 text-[14px] ${className}`}>
      <span className="mt-1.5 h-2 w-2 shrink-0 bg-volt ring-1 ring-ink" aria-hidden />
      <span>
        <span className="font-semibold">{f.name}</span> is {bothDates(f.date)}.{" "}
        {f.open ? (
          <>
            Order by <span className="font-semibold">{bothDates(f.orderBy)}</span> for delivery in time.
          </>
        ) : (
          <>Delivery before it has closed, but store pickup still works.</>
        )}
      </span>
    </p>
  );
}
