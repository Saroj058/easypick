import Link from "next/link";

import type { OfferSummary } from "@/lib/offer-rules";
import { site } from "@/lib/site";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short" });

/**
 * The festival offers running now, two or three side by side: each its name, one line, how many
 * pieces and the biggest cut, and when it ends. The first is set in ink; the others are light.
 */
export function OfferCards({ offers, active }: { offers: OfferSummary[]; active?: string }) {
  if (!offers.length) return null;
  return (
    <ul aria-label="Festival offers" className={`grid gap-3 ${offers.length === 1 ? "" : offers.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      {offers.map(({ offer, count, upTo }, i) => {
        const dark = active ? active === offer.id : i === 0;
        return (
          <li key={offer.id}>
            <Link
              href={`/shop?offer=${offer.id}`}
              scroll={false}
              aria-current={active === offer.id ? "true" : undefined}
              className={`group flex h-full flex-col justify-between gap-6 rounded-2xl border p-5 transition-colors ${dark ? "on-dark border-ink bg-ink text-paper" : "border-ink/15 bg-paper hover:border-ink"}`}
            >
              <span>
                <span className={`font-mono text-[11px] uppercase tracking-[0.14em] ${dark ? "text-paper/60" : "text-steel-dark"}`}>
                  {upTo > 0 ? `Up to ${upTo}% off` : "Marked down"}
                  {offer.endsOn ? ` · ends ${day.format(new Date(`${offer.endsOn}T12:00:00+05:45`))}` : ""}
                </span>
                <span className="display mt-2 block text-[30px] leading-[0.9] md:text-[34px]">{offer.name}</span>
                {offer.note && <span className={`mt-2 block text-[14px] ${dark ? "text-paper/75" : "text-steel-dark"}`}>{offer.note}</span>}
              </span>
              <span className="flex items-center justify-between text-[13px] font-semibold">
                <span className="font-mono tabular-nums">
                  {count} {count === 1 ? "piece" : "pieces"}
                </span>
                <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
