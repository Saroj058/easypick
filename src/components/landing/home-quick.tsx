"use client";

import { MY_SIZES, setMySize, useMySize } from "@/lib/my-size";
import { formatPrice } from "@/lib/format";

export type HomeStats = { live: number; from: number | null; fresh: number; offers: number; nextDrop: string | null };

const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * Under the logo at the end of the home intro: the store in numbers (worked out from the stock, never made up),
 * and what someone can do right here that the menu doesn't already offer: say their size once, so the rail
 * below shows what fits, and jump to the offers on this page.
 */
export function HomeQuick({ stats }: { stats: HomeStats }) {
  const size = useMySize();
  const facts = [
    { k: "Pieces in stock", v: String(stats.live) },
    stats.from !== null && { k: "Prices from", v: formatPrice(stats.from) },
    stats.fresh > 0 && { k: "New this month", v: String(stats.fresh) },
    stats.nextDrop && { k: "Next drop", v: stats.nextDrop },
  ].filter((x): x is { k: string; v: string } => !!x);
  return (
    <div className="sf-quick">
      <dl className="sf-stats">
        {facts.map((f) => (
          <div key={f.k}>
            <dt>{f.k}</dt>
            <dd>{f.v}</dd>
          </div>
        ))}
      </dl>
      <div className="sf-acts">
        <div className="sf-sizes" role="group" aria-label="Your size: we'll show what fits">
          <span>Your size</span>
          {MY_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={size === s}
              onClick={() => {
                setMySize(s);
                goTo("rail-title");
              }}
            >
              {s}
            </button>
          ))}
        </div>
        {stats.offers > 0 && (
          <button type="button" className="sf-act" onClick={() => goTo("pick-offer-title")}>
            {stats.offers} on offer <span aria-hidden>↓</span>
          </button>
        )}
      </div>
    </div>
  );
}
