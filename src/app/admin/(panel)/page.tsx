import { ArrowUpRight, Boxes, CalendarHeart, Flame, Plus, Printer } from "lucide-react";
import Link from "next/link";

import { customerCount } from "@/lib/admin-views";
import { allDrops, allProducts, festivals, restockDemand } from "@/lib/catalogue";
import { dropAlertCounts } from "@/lib/drop-alerts";
import { formatDropTime, formatPrice } from "@/lib/format";
import { addDays, ktmDay, ktmMidnight } from "@/lib/ktm-day";
import { activeOrders, ordersWithPaymentAttempts, paidOrdersBetween } from "@/lib/orders";
import { countsAsOrder, netSales } from "@/lib/reports";
import { site } from "@/lib/site";
import { requireOwner, staffList } from "@/lib/staff";
import { activityFor } from "@/lib/staff-activity";
import { effectiveStatus } from "@/lib/store";
import { inView, statusLabel, time } from "./orders/order-bits";

export const dynamic = "force-dynamic";

const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, hour: "numeric", hourCycle: "h23" });
const dayName = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, weekday: "long", day: "numeric", month: "long" });
const short = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

const card = "rounded-[24px] bg-[#f4f4f2] p-5 md:p-6";
const label = "font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]";

// Today, the admin's home (owner, 17 Oct 2026, after a reference): what needs doing now, today's
// orders on a timeline, sales over two weeks, what's running low, the next drop and the team.
// Every number links to the list behind it.
export default async function AdminToday({ searchParams }: PageProps<"/admin">) {
  const who = await requireOwner();
  const { denied } = await searchParams;
  const today = ktmDay();
  const from = addDays(today, -27);
  const [orders, recent, toCheck, demand, products, drops, fests, alerts, staff, events, customers] = await Promise.all([
    activeOrders(),
    paidOrdersBetween(ktmMidnight(from)),
    ordersWithPaymentAttempts(7),
    restockDemand(),
    allProducts(),
    allDrops(),
    festivals(),
    dropAlertCounts(),
    staffList(),
    activityFor(60),
    customerCount(),
  ]);

  // The lists the tiles link to.
  const toPack = orders.filter((o) => inView(o, "pack"));
  const toHandOver = orders.filter((o) => inView(o, "handover"));
  const attention = orders.filter((o) => inView(o, "attention"));
  const late = orders.filter((o) => inView(o, "late"));
  const waitingGifts = orders.filter((o) => inView(o, "gifts"));
  const noFestival = !fests.some((f) => f.date > today);

  // Sales by day for four weeks: the last two against the two before.
  const byDay = new Map<string, number>();
  for (const o of recent) if (o.paidAt) byDay.set(ktmDay(o.paidAt), (byDay.get(ktmDay(o.paidAt)) ?? 0) + netSales(o));
  const days = Array.from({ length: 28 }, (_, i) => addDays(from, i));
  const last14 = days.slice(14).map((d) => byDay.get(d) ?? 0);
  const prev14 = days.slice(0, 14).map((d) => byDay.get(d) ?? 0);
  const sum = (a: number[]) => a.reduce((n, x) => n + x, 0);
  const change = sum(prev14) ? Math.round(((sum(last14) - sum(prev14)) / sum(prev14)) * 1000) / 10 : null;
  const todays = recent.filter((o) => o.paidAt && ktmDay(o.paidAt) === today);
  const salesToday = sum(todays.map(netSales));

  // Today's orders on a timeline, 9 am to 9 pm.
  const H0 = 9;
  const H1 = 21;
  const pos = (at: string) => {
    const h = Number(hourFmt.format(new Date(at))) + new Date(at).getUTCMinutes() / 60;
    return Math.min(1, Math.max(0, (h - H0) / (H1 - H0)));
  };

  const low = products
    .filter((p) => effectiveStatus(p, drops) === "live" || (p.status === "live" && effectiveStatus(p, drops) === "sold_out"))
    .flatMap((p) => p.variants.map((v) => ({ p, v })))
    .filter(({ v }) => v.stock <= 2)
    .sort((a, b) => a.v.stock - b.v.stock || (demand[b.v.sku] ?? 0) - (demand[a.v.sku] ?? 0))
    .slice(0, 8);
  const next = drops.filter((d) => d.releaseAt > new Date().toISOString()).sort((a, b) => a.releaseAt.localeCompare(b.releaseAt))[0];
  const actionsToday = events.filter((e) => ktmDay(e.at) === today).length;

  // The two-week line, drawn in a 300×90 box.
  const peak = Math.max(1, ...last14, ...prev14);
  const line = (vals: number[]) => vals.map((v, i) => `${(i / 13) * 300},${86 - (v / peak) * 76}`).join(" ");

  const tiles = [
    { label: "Needs you", value: attention.length, href: "/admin/orders?view=attention", alert: attention.length > 0 },
    { label: "To pack", value: toPack.length, href: "/admin/orders?view=pack" },
    { label: "Packed, to hand over", value: toHandOver.length, href: "/admin/orders?view=handover" },
    { label: "Gifts waiting on a size", value: waitingGifts.length, href: "/admin/orders?view=gifts" },
    { label: "Not collected, 5+ days", value: late.length, href: "/admin/orders?view=late", alert: late.length > 0 },
  ];

  return (
    <div className="space-y-6">
      {denied && <p role="alert" className="rounded-2xl bg-[#f4f4f2] px-4 py-3 text-[15px]">That page is for the owner. Ask them if you need something changed there.</p>}

      {/* The head: the day, and what you'd do next */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={label}>{dayName.format(new Date())}</p>
          <h1 className="mt-1 text-[40px] font-light leading-none tracking-[-0.02em] md:text-[52px]">Good to see you, {who.username}.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/products/new" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-paper hover:bg-[#2c2c2e]">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New product
          </Link>
          <Link href="/admin/stock" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f4f4f2] px-4 text-[13px] font-semibold hover:bg-ink/10">
            <Boxes className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Count stock
          </Link>
          <Link href="/admin/drops" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f4f4f2] px-4 text-[13px] font-semibold hover:bg-ink/10">
            <Flame className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Drops
          </Link>
          <Link href="/admin/stock/sheet" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#f4f4f2] px-4 text-[13px] font-semibold hover:bg-ink/10">
            <Printer className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Count sheet
          </Link>
        </div>
      </div>

      {noFestival && (
        <p className="rounded-2xl bg-[#fff1e0] px-4 py-3 text-[15px] text-[#7a3e00]">
          <CalendarHeart className="mr-1.5 inline h-4 w-4 align-[-2px]" strokeWidth={1.8} aria-hidden />
          No festival is dated after today, so customers see no upcoming festival or &ldquo;order by&rdquo; date.{" "}
          <Link href="/admin/festivals" className="font-semibold underline underline-offset-2">
            Add the next festivals
          </Link>
        </p>
      )}

      {/* What needs doing now */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className={`group flex h-full flex-col justify-between rounded-[22px] p-4 transition-colors ${t.alert ? "bg-[#fdecee] text-[#9b0010] hover:bg-[#fbd9dd]" : "bg-[#f4f4f2] hover:bg-ink/[0.07]"}`}>
              <span className="flex items-start justify-between gap-2 text-[13px]">
                {t.label}
                <ArrowUpRight className="h-4 w-4 shrink-0 opacity-40 transition-opacity group-hover:opacity-100" strokeWidth={1.8} aria-hidden />
              </span>
              <span className="mt-3 font-mono text-[34px] font-semibold leading-none tabular-nums">{t.value}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Today's orders, on a timeline */}
        <section aria-labelledby="timeline" className={`${card} xl:col-span-8`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="timeline" className="text-[18px] font-semibold">
              Today&apos;s orders
            </h2>
            <p className="font-mono text-[13px] tabular-nums">
              {formatPrice(salesToday)} · {todays.filter(countsAsOrder).length} {todays.filter(countsAsOrder).length === 1 ? "order" : "orders"}
            </p>
          </div>
          <div className="relative mt-5 h-[180px]">
            {/* The hours */}
            {Array.from({ length: H1 - H0 + 1 }, (_, i) => (
              <span key={i} className="absolute bottom-0 top-0 border-l border-dashed border-ink/10" style={{ left: `${(i / (H1 - H0)) * 100}%` }}>
                {i % 2 === 0 && <span className="absolute -bottom-0.5 -translate-x-1/2 translate-y-full font-mono text-[10px] text-[#6b6d72]">{((H0 + i - 1) % 12) + 1}{H0 + i < 12 ? "am" : "pm"}</span>}
              </span>
            ))}
            {todays.length === 0 ? (
              <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[14px] text-[#6b6d72]">No paid orders yet today.</p>
            ) : (
              todays
                .sort((a, b) => (a.paidAt ?? "").localeCompare(b.paidAt ?? ""))
                .slice(-10)
                .map((o, k) => (
                  <Link
                    key={o.id}
                    href={`/admin/orders/${o.id}`}
                    className="absolute flex h-8 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-ink pl-3 pr-1 text-[12px] font-semibold text-paper shadow-[0_8px_20px_-12px_rgba(0,0,0,0.6)] hover:bg-[#2c2c2e]"
                    style={{ left: `${pos(o.paidAt!) * 100}%`, top: `${(k % 4) * 40 + 4}px` }}
                  >
                    {o.number}
                    <span className="rounded-full bg-paper/15 px-2 py-0.5 font-mono text-[11px]">{formatPrice(o.total)}</span>
                  </Link>
                ))
            )}
          </div>
          <div className="h-5" />
        </section>

        {/* Sales, two weeks against the two before */}
        <section aria-labelledby="trend" className={`${card} flex flex-col xl:col-span-4`}>
          <h2 id="trend" className="text-[18px] font-semibold">
            Sales trend
          </h2>
          <p className={`mt-1 ${label}`}>Last 14 days</p>
          <p className="mt-3 text-[34px] font-light leading-none tabular-nums">{formatPrice(sum(last14))}</p>
          <p className="mt-1 text-[13px] text-[#55575c]">{change === null ? "Nothing to compare with yet." : `${change >= 0 ? "+" : ""}${change}% on the 14 days before`}</p>
          <svg viewBox="0 0 300 90" className="mt-auto h-[90px] w-full pt-3" aria-hidden preserveAspectRatio="none">
            <polyline points={line(prev14)} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <polyline points={line(last14)} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="mt-2 flex justify-between font-mono text-[10px] text-[#6b6d72]">
            <span>{short.format(new Date(`${days[14]}T00:00:00Z`))}</span>
            <Link href="/admin/reports" className="font-semibold text-ink underline-offset-2 hover:underline">
              Reports →
            </Link>
            <span>{short.format(new Date(`${today}T00:00:00Z`))}</span>
          </p>
        </section>

        {/* Running low */}
        <section id="low" aria-labelledby="low-h" className={`${card} scroll-mt-28 xl:col-span-5`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="low-h" className="text-[18px] font-semibold">
              Running low
            </h2>
            <Link href="/admin/alerts" className="text-[13px] font-semibold underline-offset-2 hover:underline">
              Restock requests →
            </Link>
          </div>
          <p className="mt-1 text-[13px] text-[#55575c]">Live sizes with 2 or fewer left; &ldquo;asked&rdquo; is people waiting for a restock message.</p>
          {low.length === 0 ? (
            <p className="mt-4 text-[14px] text-[#55575c]">Nothing is running low.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {low.map(({ p, v }) => (
                <li key={v.sku}>
                  <Link href={`/admin/products/${p.slug}`} className="flex items-center gap-3 rounded-full bg-white px-4 py-2.5 text-[14px] hover:ring-1 hover:ring-ink/15">
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="shrink-0 text-[12.5px] text-[#55575c]">
                      {v.colour} · {v.size === "ONE" ? "One size" : v.size}
                    </span>
                    <span className={`w-8 shrink-0 text-right font-mono tabular-nums ${v.stock === 0 ? "text-[#d70015]" : ""}`}>{v.stock}</span>
                    <span className="w-14 shrink-0 text-right font-mono text-[12px] tabular-nums text-[#55575c]">{demand[v.sku] ?? 0} asked</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* The next drop, on black */}
        <section aria-labelledby="next-drop" className="flex flex-col rounded-[24px] bg-ink p-5 text-paper md:p-6 xl:col-span-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-paper/60">Next drop</p>
          <h2 id="next-drop" className="mt-2 text-[28px] font-light leading-tight">
            {next ? next.name : "Nothing scheduled"}
          </h2>
          <p className="mt-1 text-[14px] text-paper/70">{next ? formatDropTime(next.releaseAt, { bs: true }) : "Set the next one up when it's ready."}</p>
          <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
            <Link href="/admin/alerts" className="rounded-2xl bg-paper/10 p-3 hover:bg-paper/15">
              <span className="block font-mono text-[24px] tabular-nums">{alerts.whatsapp}</span>
              <span className="text-[12px] text-paper/70">on WhatsApp</span>
            </Link>
            <Link href="/admin/alerts" className="rounded-2xl bg-paper/10 p-3 hover:bg-paper/15">
              <span className="block font-mono text-[24px] tabular-nums">{alerts.email}</span>
              <span className="text-[12px] text-paper/70">by email</span>
            </Link>
          </div>
          <Link href="/admin/drops" className="mt-3 inline-flex h-11 items-center justify-center rounded-full bg-paper text-[13px] font-semibold text-ink hover:bg-paper/90">
            {next ? "Open the drop" : "Plan a drop"}
          </Link>
        </section>

        {/* The team and the customers */}
        <section aria-labelledby="team" className={`${card} xl:col-span-3`}>
          <div className="flex items-baseline justify-between">
            <h2 id="team" className="text-[18px] font-semibold">
              Team
            </h2>
            <Link href="/admin/staff" className="text-[13px] font-semibold underline-offset-2 hover:underline">
              Staff →
            </Link>
          </div>
          <ul className="mt-4 flex -space-x-2">
            {staff.slice(0, 6).map((s) => (
              <li key={s.id} title={`${s.username} (${s.role})`} className="grid h-10 w-10 place-items-center rounded-full bg-ink text-[14px] font-semibold uppercase text-paper ring-4 ring-[#f4f4f2]">
                {s.username.slice(0, 1)}
              </li>
            ))}
          </ul>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <Link href="/admin/activity" className="rounded-2xl bg-white p-3 hover:ring-1 hover:ring-ink/15">
              <dt className="text-[12px] text-[#55575c]">Done today</dt>
              <dd className="font-mono text-[22px] tabular-nums">{actionsToday}</dd>
            </Link>
            <Link href="/admin/customers" className="rounded-2xl bg-white p-3 hover:ring-1 hover:ring-ink/15">
              <dt className="text-[12px] text-[#55575c]">Customers</dt>
              <dd className="font-mono text-[22px] tabular-nums">{customers}</dd>
            </Link>
          </dl>
        </section>
      </div>

      {toCheck.length > 0 && (
        <section id="pay-check" aria-labelledby="pay-check-h" className={`${card} scroll-mt-28`}>
          <h2 id="pay-check-h" className="text-[18px] font-semibold">
            Payments to check
          </h2>
          <p className="mt-1 text-[13px] text-[#55575c]">
            Not paid in time or cancelled, but the customer opened the payment page in the last 7 days. Check the eSewa merchant portal in case money arrived.
          </p>
          <ul className="mt-3 space-y-1.5">
            {toCheck.map((o) => {
              const tries = o.payments ?? (o.payment ? [o.payment] : []);
              return (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] hover:ring-1 hover:ring-ink/15">
                    <span className="font-mono font-semibold">{o.number}</span>
                    <span className="text-[13px] text-[#55575c]">
                      {statusLabel(o)} · {formatPrice(o.total)} · {tries.length} {tries.length === 1 ? "try" : "tries"} · placed {time.format(new Date(o.createdAt))}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
