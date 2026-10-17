import type { Metadata } from "next";

import { listCustomers } from "@/lib/admin-views";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { requireOwner } from "@/lib/staff";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", year: "numeric" });
const label = "font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]";

/** Customer accounts (owner only): who they are, how they sign in, what they've spent, whether they get drop alerts. Read-only. */
export default async function AdminCustomers({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 60);
  const list = await listCustomers(q, 300);
  const buyers = list.filter((c) => c.orders > 0).length;
  const spent = list.reduce((n, c) => n + c.spent, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={label}>People</p>
          <h1 className="mt-1 text-[40px] font-light leading-none tracking-[-0.02em]">Customers</h1>
          <p className="mt-2 text-[14px] text-[#55575c]">Accounts on the site. Guests who bought with Buy now don&apos;t have one; find them by phone in Search.</p>
        </div>
        <form className="flex gap-2">
          <label>
            <span className="sr-only">Find a customer</span>
            <input name="q" type="search" defaultValue={q} placeholder="Name, phone or email" className="h-11 w-64 rounded-full border border-ink/15 bg-white px-4 text-[14px] outline-none focus:border-ink" />
          </label>
          <button type="submit" className="h-11 cursor-pointer rounded-full bg-ink px-5 text-[13px] font-semibold text-paper">
            Find
          </button>
        </form>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {[
          ["Accounts", list.length],
          ["Have bought", buyers],
          ["Spent in all", formatPrice(spent)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[22px] bg-[#f4f4f2] p-4">
            <dt className="text-[13px] text-[#55575c]">{k}</dt>
            <dd className="mt-2 font-mono text-[26px] font-semibold leading-none tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {list.length === 0 ? (
        <p className="text-[#55575c]">{q ? `No customer matches “${q}”.` : "No accounts yet."}</p>
      ) : (
        <div className="overflow-x-auto rounded-[22px] bg-[#f4f4f2] p-2">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="text-[12px] text-[#55575c]">
              <tr>
                <th className="px-3 py-2 font-normal">Name</th>
                <th className="px-3 py-2 font-normal">Phone · email</th>
                <th className="px-3 py-2 text-right font-normal">Orders</th>
                <th className="px-3 py-2 text-right font-normal">Spent</th>
                <th className="px-3 py-2 font-normal">Alerts</th>
                <th className="px-3 py-2 font-normal">Joined</th>
                <th className="px-3 py-2 font-normal">Last in</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t border-ink/5 bg-white first:border-t-0">
                  <td className="px-3 py-2.5 font-semibold">
                    {c.name || <span className="font-normal text-[#55575c]">No name yet</span>}
                    {c.google && <span className="ml-2 rounded-full bg-[#f4f4f2] px-2 py-0.5 text-[11px] font-normal">Google</span>}
                  </td>
                  <td className="px-3 py-2.5 text-[#55575c]">{[c.phone, c.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{c.orders}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{c.spent ? formatPrice(c.spent) : "—"}</td>
                  <td className="px-3 py-2.5">{c.alerts ? "On" : "—"}</td>
                  <td className="px-3 py-2.5 text-[#55575c]">{day.format(new Date(c.createdAt))}</td>
                  <td className="px-3 py-2.5 text-[#55575c]">{day.format(new Date(c.lastLoginAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
