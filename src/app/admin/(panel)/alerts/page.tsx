import type { Metadata } from "next";
import Link from "next/link";

import { dropAlertList, dropAlertStopped, restockWaiting } from "@/lib/admin-views";
import { dropAlertCounts } from "@/lib/drop-alerts";
import { site } from "@/lib/site";
import { requireOwner } from "@/lib/staff";

export const metadata: Metadata = { title: "Alerts" };
export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", year: "numeric" });
const label = "font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]";

/** Masks the middle of a number or address: "98•••4521", "s•••@gmail.com". */
function mask(contact: string) {
  if (contact.includes("@")) return contact.replace(/^(.).*(@.*)$/, "$1•••$2");
  return `${contact.slice(0, 2)}•••${contact.slice(-4)}`;
}

/**
 * Who's waiting to hear from the shop (owner only): the drop-alert list (one message before each
 * drop, on WhatsApp or by email) and the "tell me when it's back" requests, by size. Read-only;
 * the messages themselves go out on their own (drops) or when stock is added (restocks).
 */
export default async function AdminAlerts() {
  await requireOwner();
  const [counts, list, stopped, waiting] = await Promise.all([dropAlertCounts(), dropAlertList(), dropAlertStopped(), restockWaiting()]);
  const sources = Array.from(list.reduce((m, s) => m.set(s.source ?? "site", (m.get(s.source ?? "site") ?? 0) + 1), new Map<string, number>())).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      <div>
        <p className={label}>Selling</p>
        <h1 className="mt-1 text-[40px] font-light leading-none tracking-[-0.02em]">Alerts</h1>
        <p className="mt-2 text-[14px] text-[#55575c]">People who asked to hear from the shop. Contacts are partly hidden here.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["On WhatsApp", counts.whatsapp],
          ["By email", counts.email],
          ["Stopped", stopped],
          ["Waiting on a restock", waiting.reduce((n, w) => n + w.n, 0)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[22px] bg-[#f4f4f2] p-4">
            <dt className="text-[13px] text-[#55575c]">{k}</dt>
            <dd className="mt-2 font-mono text-[26px] font-semibold leading-none tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-labelledby="restock" className="rounded-[24px] bg-[#f4f4f2] p-5">
          <h2 id="restock" className="text-[18px] font-semibold">
            Waiting on a restock
          </h2>
          <p className="mt-1 text-[13px] text-[#55575c]">They get one message the moment that size is back in stock.</p>
          {waiting.length === 0 ? (
            <p className="mt-4 text-[14px] text-[#55575c]">Nobody is waiting.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {waiting.map((w) => (
                <li key={w.sku}>
                  <Link href={`/admin/products/${w.slug}`} className="flex items-center gap-3 rounded-full bg-white px-4 py-2.5 text-[14px] hover:ring-1 hover:ring-ink/15">
                    <span className="min-w-0 flex-1 truncate font-semibold">{w.name}</span>
                    <span className="shrink-0 text-[12.5px] text-[#55575c]">
                      {w.colour} · {w.size === "ONE" ? "One size" : w.size}
                    </span>
                    <span className="shrink-0 font-mono text-[12.5px] tabular-nums">{w.n} asked</span>
                    <span className={`shrink-0 font-mono text-[12px] tabular-nums ${w.stock ? "" : "text-[#d70015]"}`}>{w.stock} left</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="drop-list" className="rounded-[24px] bg-[#f4f4f2] p-5">
          <h2 id="drop-list" className="text-[18px] font-semibold">
            Drop-alert list
          </h2>
          <p className="mt-1 text-[13px] text-[#55575c]">One message before each drop. Where they signed up:</p>
          {sources.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {sources.map(([s, n]) => (
                <span key={s} className="rounded-full bg-white px-3 py-1 text-[12px]">
                  {s} <span className="font-mono text-[#55575c]">{n}</span>
                </span>
              ))}
            </p>
          )}
          {list.length === 0 ? (
            <p className="mt-4 text-[14px] text-[#55575c]">Nobody yet.</p>
          ) : (
            <ul className="mt-3 max-h-[480px] space-y-1.5 overflow-y-auto">
              {list.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-full bg-white px-4 py-2.5 text-[14px]">
                  <span className="w-20 shrink-0 text-[12px] text-[#55575c]">{s.channel === "email" ? "Email" : "WhatsApp"}</span>
                  <span className="min-w-0 flex-1 truncate font-mono">{mask(s.contact)}</span>
                  <span className="shrink-0 text-[12px] text-[#55575c]">{day.format(new Date(s.consentAt))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
