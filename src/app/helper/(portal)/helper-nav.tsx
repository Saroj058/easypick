"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, PackageCheck, Search, UserRound } from "lucide-react";

const tabs = [
  { href: "/helper", label: "Orders", Icon: PackageCheck },
  { href: "/helper/find", label: "Find", Icon: Search },
  { href: "/helper/stock", label: "Stock", Icon: Boxes },
  { href: "/helper/me", label: "Me", Icon: UserRound },
];

const isCurrent = (path: string, href: string) =>
  href === "/helper" ? path === "/helper" || path.startsWith("/helper/order") : href === "/helper/stock" ? path.startsWith("/helper/stock") || path.startsWith("/helper/count") : path.startsWith(href);

/** Tabs: pills in the top bar on a big screen, a floating thumb dock on a phone. */
export function HelperNav({ waiting, dock }: { waiting: number; dock?: boolean }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Helper sections"
      className={dock ? "fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 rounded-full bg-white/90 p-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)] ring-1 ring-ink/10 backdrop-blur" : ""}
    >
      <ul className={dock ? "grid grid-cols-4 gap-1" : "flex gap-1"}>
        {tabs.map(({ href, label, Icon }) => {
          const on = isCurrent(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`relative flex items-center justify-center rounded-full transition-colors ${
                  dock ? "h-14 flex-col gap-0.5 text-[11.5px]" : "h-9 gap-2 px-4 text-[14px]"
                } ${on ? "bg-ink font-semibold text-paper" : "text-[#55575c] hover:bg-ink/[0.06] hover:text-ink"}`}
              >
                <Icon className={dock ? "h-5 w-5" : "h-4 w-4"} strokeWidth={1.75} aria-hidden />
                {label}
                {href === "/helper" && waiting > 0 && (
                  <span
                    className={`grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-[11px] font-semibold ${on ? "bg-paper text-ink" : "bg-ink text-paper"} ${dock ? "absolute right-[calc(50%-24px)] top-1" : ""}`}
                  >
                    {waiting}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
