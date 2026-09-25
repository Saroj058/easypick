"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BagIcon, ShopIcon, UserIcon } from "@/components/icons";

const SearchIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className={className} aria-hidden>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

const tabs = [
  { href: "/helper", label: "Orders", Icon: BagIcon },
  { href: "/helper/find", label: "Find", Icon: SearchIcon },
  { href: "/helper/stock", label: "Stock", Icon: ShopIcon },
  { href: "/helper/me", label: "Me", Icon: UserIcon },
];

const isCurrent = (path: string, href: string) =>
  href === "/helper" ? path === "/helper" || path.startsWith("/helper/order") : href === "/helper/stock" ? path.startsWith("/helper/stock") || path.startsWith("/helper/count") : path.startsWith(href);

/** Tabs: across the top on a big screen, a thumb bar at the bottom on a phone. */
export function HelperNav({ waiting }: { waiting: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Helper sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-mist bg-paper pb-[env(safe-area-inset-bottom)] md:static md:border-t-0 md:bg-transparent md:pb-0">
      <ul className="mx-auto grid max-w-xl grid-cols-4 md:mx-0 md:flex md:max-w-none md:gap-2">
        {tabs.map(({ href, label, Icon }) => {
          const on = isCurrent(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] md:min-h-11 md:flex-row md:gap-2 md:border-b-2 md:px-3 md:text-[15px] ${on ? "font-semibold text-ink md:border-ink" : "text-steel-dark md:border-transparent"}`}
              >
                <Icon className="h-6 w-6 md:h-5 md:w-5" />
                {label}
                {href === "/helper" && waiting > 0 && (
                  <span className="absolute right-[calc(50%-22px)] top-2 grid h-5 min-w-5 place-items-center rounded-full bg-volt px-1 font-mono text-[11px] font-semibold text-ink md:static">
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
