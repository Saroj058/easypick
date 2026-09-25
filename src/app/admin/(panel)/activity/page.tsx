import type { Metadata } from "next";
import Link from "next/link";

import { staffActivity } from "@/lib/admin-data";
import { site } from "@/lib/site";
import { requireOwner, staffList } from "@/lib/staff";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Short readable version of an entry's details (e.g. price 2500 → 2200). */
function describe(detail: Record<string, unknown> | null) {
  if (!detail) return "";
  return Object.entries(detail)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false)
    .map(([k, v]) => {
      if (Array.isArray(v) && v.length === 2) return `${k} ${v[0] ?? "none"} → ${v[1] ?? "none"}`;
      if (v && typeof v === "object") return `${k} ${Object.entries(v).map(([a, b]) => `${a} ${Number(b) > 0 ? "+" : ""}${b}`).join(", ")}`;
      return v === true ? k : `${k} ${v}`;
    })
    .join(" · ");
}

export default async function AdminActivity({ searchParams }: PageProps<"/admin/activity">) {
  await requireOwner();
  const sp = await searchParams;
  const who = typeof sp.who === "string" ? sp.who : undefined;
  const [rows, staff] = await Promise.all([staffActivity(200, who), staffList()]);

  return (
    <div className="max-w-4xl">
      <h2 className="display text-[32px] md:text-[40px]">Activity</h2>
      <p className="mt-2 text-steel-dark">Who changed what in the admin: sign-ins, prices, stock, refunds, exchanges. The latest 200.</p>
      <ul className="mt-6 flex flex-wrap gap-2" aria-label="Show">
        {[{ username: undefined as string | undefined, label: "Everyone" }, ...staff.map((s) => ({ username: s.username as string | undefined, label: s.username }))].map((s) => (
          <li key={s.label}>
            <Link
              href={s.username ? `/admin/activity?who=${encodeURIComponent(s.username)}` : "/admin/activity"}
              aria-current={who === s.username ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[14px] ${who === s.username ? "border-ink bg-ink text-paper" : "border-mist hover:border-ink"}`}
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <p className="mt-10 text-steel-dark">Nothing recorded yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead className="text-[12px] text-steel-dark">
              <tr className="border-b border-mist">
                <th className="py-2 font-normal">When</th>
                <th className="py-2 font-normal">Who</th>
                <th className="py-2 font-normal">What</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-mist align-top">
                  <td className="whitespace-nowrap py-2 pr-4 text-steel-dark">{when.format(new Date(r.at))}</td>
                  <td className="py-2 pr-4 font-semibold">{r.staffName}</td>
                  <td className="py-2">
                    {r.action}
                    {r.target ? <span className="font-mono text-[13px]"> {r.target}</span> : null}
                    {r.detail ? <span className="block text-[13px] text-steel-dark">{describe(r.detail)}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
