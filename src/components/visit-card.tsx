"use client";

import { useEffect, useState } from "react";

import { formatHour } from "@/lib/format";
import { isStoreOpen } from "@/lib/hours";
import { site } from "@/lib/site";

/** Open/closed now, hours, map, landmark and a one-tap call or WhatsApp. */
export function VisitCard({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  // Computed after mount so server HTML never shows a stale open/closed state.
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => setOpen(isStoreOpen());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const { store } = site;
  const hours = `${formatHour(store.hours.open)} – ${formatHour(store.hours.close)}, every day`;
  const muted = dark ? "text-paper/70" : "text-steel-dark";
  const hasAddress = Boolean(store.address);

  return (
    <div className={`${dark ? "bg-graphite text-paper" : "bg-photo text-ink"} p-6`}>
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${open === null ? "bg-steel" : open && hasAddress ? "bg-[#34c759]" : "bg-steel"}`}
          aria-hidden
        />
        <p className="eyebrow">{!hasAddress ? "Opening soon" : open === null ? "Store hours" : open ? "Open now" : "Closed now"}</p>
      </div>
      <p className={`mt-3 ${compact ? "text-base" : "text-lg"} font-semibold`}>
        {store.address ?? `${site.name}, ${store.area}`}
      </p>
      {store.landmark && <p className={`text-[15px] ${muted}`}>{store.landmark}</p>}
      <p className={`mt-1 font-mono text-[14px] ${muted}`}>{hours}</p>
      {!compact && (
        <div className="mt-5 flex flex-wrap gap-3">
          {store.mapUrl ? (
            <a href={store.mapUrl} target="_blank" rel="noopener" className={`btn ${dark ? "btn-volt" : "btn-ink"}`}>
              Open map
            </a>
          ) : (
            <p className={`text-[14px] ${muted}`}>Address and map coming soon.</p>
          )}
          {store.whatsapp && (
            <a href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noopener" className="btn btn-outline">
              WhatsApp
            </a>
          )}
          {!store.whatsapp && store.phone && (
            <a href={`tel:${store.phone}`} className="btn btn-outline">
              Call
            </a>
          )}
        </div>
      )}
    </div>
  );
}
