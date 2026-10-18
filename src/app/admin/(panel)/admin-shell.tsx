"use client";

import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  CalendarHeart,
  ClipboardList,
  Flame,
  Gift,
  Home,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  Package,
  Search,
  Shirt,
  Store,
  TrendingUp,
  UserCog,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { signOutAdmin } from "@/app/admin/actions";
import type { StaffRole } from "@/lib/db/schema";

// The admin's frame (owner, 17 Oct 2026, after a reference: a light, calm control room). A pill
// sidebar with every part of the shop in three groups; a top bar with one search across orders,
// pieces and customers, the live counts (to pack, needs you) and a notifications list; the page on
// a soft white panel. Phones get the same sidebar as a drawer.

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; owner?: boolean };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Run the shop",
    items: [
      { href: "/admin", label: "Today", icon: Home },
      { href: "/admin/orders", label: "Orders", icon: ClipboardList },
      { href: "/admin/products", label: "Products", icon: Shirt },
      { href: "/admin/stock", label: "Stock count", icon: Boxes },
    ],
  },
  {
    title: "Selling",
    items: [
      { href: "/admin/drops", label: "Drops", icon: Flame, owner: true },
      { href: "/admin/looks", label: "Looks", icon: LayoutGrid, owner: true },
      { href: "/admin/trending", label: "Trending", icon: TrendingUp, owner: true },
      { href: "/admin/gift-cards", label: "Gift cards", icon: Gift, owner: true },
      { href: "/admin/festivals", label: "Festivals", icon: CalendarHeart, owner: true },
      { href: "/admin/alerts", label: "Alerts", icon: Mail, owner: true },
    ],
  },
  {
    title: "People & store",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users, owner: true },
      { href: "/admin/reports", label: "Reports", icon: BarChart3, owner: true },
      { href: "/admin/store", label: "Store", icon: Store, owner: true },
      { href: "/admin/staff", label: "Staff", icon: UserCog, owner: true },
      { href: "/admin/activity", label: "Activity", icon: Activity, owner: true },
      { href: "/admin/account", label: "Account", icon: Package },
    ],
  },
];

export interface Notice {
  label: string;
  href: string;
  count: number;
  urgent?: boolean;
}

export function AdminShell({ role, username, toPack, attention, notices, children }: { role: StaffRole; username: string; toPack: number; attention: number; notices: Notice[]; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const bellBox = useRef<HTMLDivElement>(null);
  const current = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const waiting = notices.reduce((n, x) => n + x.count, 0);

  // Close the drawer on a new page; close the notifications on a tap elsewhere or Escape.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new page closes the drawer
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!bell) return;
    const away = (e: PointerEvent) => !bellBox.current?.contains(e.target as Node) && setBell(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setBell(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [bell]);

  const nav = (
    <nav aria-label="Admin sections" className="flex flex-col gap-4">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.owner || role === "owner");
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <p className="px-4 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#6b6d72]">{g.title}</p>
            <ul className="flex flex-col gap-0.5">
              {items.map((i) => {
                const on = current(i.href);
                const Icon = i.icon;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={on ? "page" : undefined}
                      className={`flex h-9 items-center gap-3 rounded-full px-4 text-[14px] transition-colors ${on ? "bg-ink font-semibold text-paper" : "text-ink/75 hover:bg-ink/5 hover:text-ink"}`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} />
                      {i.label}
                      {i.href === "/admin/orders" && toPack > 0 && (
                        <span className={`ml-auto rounded-full px-2 font-mono text-[11px] ${on ? "bg-paper/15" : "bg-ink text-paper"}`}>{toPack}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const signOut = (
    <form action={signOutAdmin}>
      <button type="submit" className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-full px-4 text-[14px] text-ink/75 hover:bg-ink/5 hover:text-ink">
        <LogOut className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden />
        Sign out
      </button>
    </form>
  );

  return (
    <div className="admin-ui min-h-dvh bg-[#e9e9e7] text-ink">
      <div className="mx-auto flex max-w-[1680px] gap-4 p-3 md:p-4">
        {/* The sidebar (wide screens) */}
        <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-[232px] shrink-0 flex-col rounded-[28px] bg-white/80 px-3 py-5 shadow-[0_20px_50px_-36px_rgba(0,0,0,0.35)] backdrop-blur lg:flex">
          <Link href="/admin" className="flex items-center gap-2.5 px-4" aria-label="Easypick admin, today">
            <Image src="/brand/logo.png" alt="" width={611} height={161} className="h-5 w-[76px]" priority />
            <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-paper">Admin</span>
          </Link>
          <div className="no-scrollbar mt-6 flex-1 overflow-y-auto">{nav}</div>
          <div className="mt-3 flex items-center gap-1 border-t border-ink/10 pt-3">
            <Link href="/admin/account" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full px-2 py-1.5 hover:bg-ink/5" title="Your login">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-semibold uppercase text-paper">{username.slice(0, 1)}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{username}</span>
                <span className="block text-[11px] capitalize text-[#6b6d72]">{role}</span>
              </span>
            </Link>
            <form action={signOutAdmin}>
              <button type="submit" aria-label="Sign out" title="Sign out" className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-ink/70 hover:bg-ink/5 hover:text-ink">
                <LogOut className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden />
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* The top bar */}
          <header className="sticky top-3 z-40 flex items-center gap-2 rounded-full bg-white/80 p-1.5 shadow-[0_14px_40px_-30px_rgba(0,0,0,0.35)] backdrop-blur md:top-4 md:gap-3">
            <button type="button" onClick={() => setOpen(true)} aria-label="Open the menu" className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-ink/5 lg:hidden">
              <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </button>
            <form action="/admin/search" role="search" className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[#f2f2f0] pl-1.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-paper">
                <Search className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Search orders, pieces and customers</span>
                <input name="q" type="search" placeholder="Search orders, pieces, customers…" className="h-11 w-full bg-transparent pr-4 text-[14px] outline-none placeholder:text-ink/45" />
              </label>
            </form>
            {/* Live counts */}
            <Link href="/admin/orders?view=pack" className="hidden h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-paper md:flex">
              <ClipboardList className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              {toPack} to pack
            </Link>
            {attention > 0 && (
              <Link href="/admin/orders?view=attention" className="hidden h-11 shrink-0 items-center rounded-full bg-[#fdecee] px-4 text-[13px] font-semibold text-[#9b0010] md:flex">
                {attention} need{attention === 1 ? "s" : ""} you
              </Link>
            )}
            {/* Notifications */}
            <div ref={bellBox} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setBell((b) => !b)}
                aria-expanded={bell}
                aria-label={waiting ? `Notifications, ${waiting}` : "Notifications"}
                className="relative grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-[#f2f2f0] hover:bg-ink/10"
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                {waiting > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 font-mono text-[10px] font-semibold text-paper">{waiting > 99 ? "99+" : waiting}</span>}
              </button>
              {bell && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-24px))] rounded-3xl bg-white p-2 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)] ring-1 ring-ink/5">
                  <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#6b6d72]">Waiting on you</p>
                  {notices.length === 0 ? (
                    <p className="px-3 py-4 text-[14px] text-[#6b6d72]">All clear. Nothing is waiting.</p>
                  ) : (
                    <ul>
                      {notices.map((n) => (
                        <li key={n.label}>
                          <Link href={n.href} onClick={() => setBell(false)} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-[14px] hover:bg-ink/5">
                            <span className="flex items-center gap-2">
                              <span aria-hidden className={`h-2 w-2 rounded-full ${n.urgent ? "bg-[#d70015]" : "bg-ink/40"}`} />
                              {n.label}
                            </span>
                            <span className="font-mono text-[13px] tabular-nums">{n.count}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <Link href="/" target="_blank" rel="noopener" className="hidden h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold text-ink/70 hover:bg-ink/5 hover:text-ink sm:flex">
              View site ↗
            </Link>
          </header>

          {/* The page */}
          <main className="mt-4 min-h-[calc(100dvh-7rem)] rounded-[28px] bg-white/85 px-4 py-6 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.3)] sm:px-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>

      {/* Phones and tablets: the sidebar as a drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close the menu" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default bg-ink/30" />
          <div className="absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col bg-white px-3 py-5 shadow-2xl">
            <div className="flex items-center justify-between px-4">
              <span className="text-[15px] font-semibold">{username}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close the menu" className="grid h-11 w-11 cursor-pointer place-items-center rounded-full hover:bg-ink/5">
                <X className="h-5 w-5" strokeWidth={1.8} aria-hidden />
              </button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto">{nav}</div>
            <div className="mt-4 border-t border-ink/10 pt-3">{signOut}</div>
          </div>
        </div>
      )}
    </div>
  );
}
