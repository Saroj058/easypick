"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { MenuIcon } from "./icons";
import { useMe } from "./session";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";

// The full menu on phones and tablets: everything grouped by what people come to do.

const GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Shop",
    links: [
      { href: "/new", label: "New in" },
      { href: "/shop", label: "Shop all" },
      { href: "/shop?vault=1", label: "The Vault" },
      { href: "/shop?sale=1", label: "Sale" },
      { href: "/gift", label: "Gifts and gift cards" },
    ],
  },
  {
    title: "Help me choose",
    links: [
      { href: "/size-guide", label: "Your size in cm" },
      { href: "/fit", label: "Build a fit" },
    ],
  },
  {
    title: "Orders",
    links: [
      { href: "/track", label: "Track an order" },
      { href: "/returns", label: "Returns" },
      { href: "/delivery", label: "Delivery and pickup" },
    ],
  },
  {
    title: "The store",
    links: [
      { href: "/visit", label: "Visit" },
      { href: "/visit/tour", label: "Walk the store in 3D" },
      { href: "/alerts", label: "Drop alerts" },
    ],
  },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const me = useMe();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className="flex h-10 w-10 items-center justify-center lg:hidden" aria-label="Menu">
          <MenuIcon className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" hideClose className="flex w-full flex-col gap-0 border-mist bg-paper p-0 pt-[env(safe-area-inset-top)] sm:max-w-sm">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-mist px-4">
          <SheetTitle asChild>
            <Link href="/" onClick={() => setOpen(false)} aria-label="Easypick home">
              <Image src="/brand/logo.png" alt="Easypick" width={611} height={161} className="h-5 w-[76px]" />
            </Link>
          </SheetTitle>
          <SheetClose className="grid h-11 w-11 place-items-center" aria-label="Close menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </SheetClose>
        </div>
        <nav aria-label="Menu" className="flex-1 overflow-y-auto px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-2">
          {GROUPS.map((g) => (
            <div key={g.title} className="mt-5">
              <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-steel-dark">{g.title}</p>
              <ul>
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      aria-current={pathname === l.href ? "page" : undefined}
                      className="flex min-h-11 items-center text-[17px] font-semibold hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="mt-8 border-t border-mist pt-4">
            <Link href={me ? "/account" : "/login"} onClick={() => setOpen(false)} className="flex min-h-11 items-center text-[17px] font-semibold">
              {me ? "Your account" : "Log in / Sign up"}
            </Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
