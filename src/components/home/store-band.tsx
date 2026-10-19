import Link from "next/link";

import { hourLabel, type StoreInfo } from "@/lib/store-state";

// Our store and self-checkout, in one quiet band (owner, 19 Oct 2026: "too big; we're only showing
// that we have a store and how checkout works"): where and when on the left, the RFID checkout in
// four short lines on the right. Hairlines, no pictures, lime only on the open dot.

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

const STEPS = [
  ["Put your pieces on the counter", "the RFID tags scan themselves."],
  ["Check the list", "every piece, with its price."],
  ["Scan the QR and pay", "with eSewa, right on the screen."],
  ["Walk out", "the bill comes by SMS."],
] as const;

const pill = "inline-flex h-11 items-center rounded-full border border-mist px-4 text-[14px] font-semibold transition-colors hover:border-ink";

export function StoreBand({ info, store = true, checkout = true }: { info: StoreInfo; store?: boolean; checkout?: boolean }) {
  const hours = hoursLine(info);
  const where = info.address ? `${info.address}${info.area && !info.address.includes(info.area) ? `, ${info.area}` : ""}` : info.area;
  const both = store && checkout;

  return (
    <section aria-labelledby={store ? "store-title" : "checkout-title"} className="border-y border-mist py-9 md:py-11">
      <div className={`container-ep grid gap-8 ${both ? "lg:grid-cols-12 lg:gap-12" : ""}`}>
        {store && (
          <div className={both ? "lg:col-span-5" : ""}>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">
              <span className={`h-1.5 w-1.5 rounded-full ${info.opened ? "bg-volt ring-1 ring-ink/30" : "bg-ink"}`} aria-hidden />
              {badge(info)}
            </p>
            <h2 id="store-title" className="display mt-2 text-[34px] leading-[0.9] md:text-[40px]">
              Our store
            </h2>
            <p className="mt-3 text-[15px]">
              {where}
              {hours ? ` · ${hours}` : ""}
            </p>
            {info.landmark && <p className="mt-0.5 text-[13px] text-steel-dark">{info.landmark}</p>}
            <p className="mt-1 text-[13px] text-steel-dark">Try-on rooms · online pickup · a helper on the floor.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {info.mapUrl ? (
                <a href={info.mapUrl} target="_blank" rel="noopener" className={pill}>
                  Directions
                </a>
              ) : (
                <Link href="/visit" className={pill}>
                  Visit details
                </Link>
              )}
              <Link href="/visit/tour" className={pill}>
                Walk it in 3D
              </Link>
            </div>
          </div>
        )}

        {checkout && (
          <div className={both ? "lg:col-span-7 lg:border-l lg:border-mist lg:pl-12" : ""}>
            <h2 id="checkout-title" className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">
              How self-checkout works
            </h2>
            <ol aria-label="How to pay at the kiosk" className="mt-3">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[28px_1fr] gap-3 border-b border-mist py-2.5 last:border-0">
                  <span className="pt-0.5 font-mono text-[12px] text-steel-dark">{i === STEPS.length - 1 ? "✓" : String(i + 1).padStart(2, "0")}</span>
                  <p className="text-[13px] text-steel-dark">
                    <span className="text-[15px] font-semibold text-ink">{t}:</span> {d}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[13px] text-steel-dark">No bargaining · No queue · A helper is always in store.</p>
          </div>
        )}
      </div>
    </section>
  );
}
