"use client";

import { useEffect, useState } from "react";

import { site } from "@/lib/site";
import { hourLabel, hoursOn, ktmNow, storeState, type StoreInfo } from "@/lib/store-state";

/** Open/closed now, today's hours, map, landmark and a one-tap call or WhatsApp. Details come from /admin/store. */
export function VisitCard({ info, compact = false, dark = false }: { info: StoreInfo; compact?: boolean; dark?: boolean }) {
  // Worked out after mount so cached server HTML never shows a stale open/closed state.
  const [label, setLabel] = useState<{ text: string; open: boolean; today: string } | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const s = storeState(info, now);
      const h = hoursOn(info, ktmNow(now).date);
      setLabel({
        text: s.kind === "soon" ? s.headline : s.kind === "closed" ? "Closed now" : "Open now",
        open: s.kind === "open" || s.kind === "drop",
        today: h ? `Today ${hourLabel(h.open)} – ${hourLabel(h.close)}` : "Closed today",
      });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [info]);

  const muted = dark ? "text-paper/70" : "text-steel-dark";
  const soon = !info.opened;

  return (
    <div className={`${dark ? "bg-graphite text-paper" : "bg-photo text-ink"} p-6`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${label?.open ? "bg-[#34c759]" : "bg-steel"}`} aria-hidden />
        <p className="eyebrow">{label?.text ?? (soon ? "Opening soon" : "Store hours")}</p>
      </div>
      <p className={`mt-3 ${compact ? "text-base" : "text-lg"} font-semibold`}>{info.address ?? `${site.name}, ${info.area}`}</p>
      {info.landmark && <p className={`text-[15px] ${muted}`}>{info.landmark}</p>}
      {!soon && <p className={`mt-1 min-h-5 font-mono text-[14px] ${muted}`}>{label?.today ?? ""}</p>}
      {!compact && (
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/visit" className={`btn ${dark ? "btn-volt" : "btn-ink"}`}>
            {soon ? "Opening details" : "Directions and hours"}
          </a>
          {info.whatsapp && (
            <a href={`https://wa.me/${info.whatsapp}`} target="_blank" rel="noopener" className="btn btn-outline">
              WhatsApp
            </a>
          )}
          {!info.whatsapp && info.phone && (
            <a href={`tel:${info.phone}`} className="btn btn-outline">
              Call
            </a>
          )}
        </div>
      )}
    </div>
  );
}
