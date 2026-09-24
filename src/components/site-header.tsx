"use client";

import { MotionConfig, motion, useMotionValueEvent, useScroll, type Variants } from "framer-motion";
import { Ellipsis } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useBag } from "./bag-provider";
import { BagIcon, BellIcon, DropIcon, GiftIcon, PinIcon, ShopIcon, UserIcon } from "./icons";
import { useMe } from "./session";
import { AnimatedNavFramer, useScrollCollapse } from "./ui/navigation-menu";
import { TwentyTwelveOne as SmoothDropdown, type SmoothDropdownItem } from "./ui/smooth-dropdown";
import { signOut } from "@/app/auth-actions";
import {
  HangerIcon,
  HelpCircleIcon,
  InformationCircleIcon,
  Login01Icon,
  LogoutIcon,
  Notification01Icon,
  RulerIcon,
  UserIcon as UserHugeIcon,
} from "@hugeicons/core-free-icons";

const primary = [
  { href: "/drops", label: "Drops" },
  { href: "/shop", label: "Shop" },
  { href: "/gift", label: "Send a gift" },
  { href: "/visit", label: "Visit" },
];

// Everything that isn't in the main links, shown in the dropdown once the header becomes pills.
const menu: SmoothDropdownItem[] = [
  { id: "/fit", href: "/fit", label: "Build a fit", icon: HangerIcon },
  { id: "/how-it-works", href: "/how-it-works", label: "How it works", icon: HelpCircleIcon },
  { id: "/size-guide", href: "/size-guide", label: "Your size in cm", icon: RulerIcon },
  { id: "/alerts", href: "/alerts", label: "Drop alerts", icon: Notification01Icon },
  { id: "/about", href: "/about", label: "About", icon: InformationCircleIcon },
];

/** Pill look once scrolled; flat (part of the full-width bar) at the very top. */
function pillChrome(atTop: boolean) {
  return `transition-[background-color,border-color,box-shadow] duration-300 ${
    atTop ? "border-transparent bg-transparent shadow-none" : "border-mist bg-paper shadow-[0_6px_24px_rgba(0,0,0,0.08)]"
  }`;
}

// Side pills slide up and fade out while the centre pill collapses to a circle.
const sideVariants: Variants = {
  shown: { y: 0, opacity: 1, scale: 1, transition: { type: "spring", damping: 22, stiffness: 320 } },
  hidden: { y: -72, opacity: 0, scale: 0.96, transition: { duration: 0.22, ease: "easeIn" } },
};

export function SiteHeader() {
  const { count, ready } = useBag();
  const me = useMe();
  const pathname = usePathname();
  const [expanded, setExpanded] = useScrollCollapse();

  // At the very top the header is one full-width bar; once scrolled it splits into floating pills.
  const [atTop, setAtTop] = useState(true);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setAtTop(y < 24));

  // A new page starts at the top, so everything shows.
  useEffect(() => setExpanded(true), [pathname, setExpanded]);

  // Adding to the bag brings the header back so the new count is seen.
  const lastCount = useRef(count);
  useEffect(() => {
    if (ready && count > lastCount.current) setExpanded(true);
    lastCount.current = count;
  }, [count, ready, setExpanded]);

  const dropdownItems: SmoothDropdownItem[] = [
    ...menu,
    { id: "divider", label: "", icon: null },
    me
      ? { id: "/account", href: "/account", label: "Account", icon: UserHugeIcon }
      : { id: "/login", href: "/login", label: "Log in / Sign up", icon: Login01Icon },
    ...(me ? [{ id: "logout", label: "Log out", icon: LogoutIcon, danger: true, onSelect: () => void signOut() }] : []),
  ];

  const account = me ? (
    <Link href="/account" className="flex h-10 w-10 items-center justify-center" aria-label={`Account${me.name ? `, ${me.name}` : ""}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-[12px] font-semibold uppercase text-paper">
        {(me.name ?? "E").trim().charAt(0)}
      </span>
    </Link>
  ) : (
    <Link href="/login" className="flex h-10 items-center justify-center px-2 text-sm font-semibold uppercase tracking-[0.06em]" aria-label="Log in or sign up">
      <UserIcon className="h-5 w-5 md:hidden" />
      <span className="hidden md:inline">Log in</span>
    </Link>
  );

  return (
    <header className="pt-[env(safe-area-inset-top)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[70] focus:bg-paper focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Keeps page content clear of the floating nav. The home hero runs full-bleed under it instead. */}
      {pathname !== "/" && <div className="h-[72px] md:h-[88px]" aria-hidden />}

      {/* Three floating pills: logo · links · actions. Clicks pass through the gaps. */}
      <MotionConfig reducedMotion="user">
        {/* Full-width bar behind the three sections, only at the very top of the page */}
        <motion.div
          aria-hidden
          initial={false}
          animate={atTop ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[72px] border-b border-mist bg-paper pt-[env(safe-area-inset-top)] md:h-[88px]"
        />
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 md:top-5">
          <div className="container-ep relative flex items-center justify-between gap-3">
            {/* Logo: slides away while scrolling down */}
            <motion.div variants={sideVariants} animate={expanded ? "shown" : "hidden"} {...(!expanded && { inert: true })}>
              <Link href="/" aria-label="Easypick home" className={`${expanded ? "pointer-events-auto" : "pointer-events-none"} ${pillChrome(atTop)} flex h-12 items-center rounded-full border px-5`}>
                <Image src="/brand/logo.png" alt="Easypick" width={611} height={161} priority className="h-5 w-[76px]" />
              </Link>
            </motion.div>

            {/* Links (large screens; phones and tablets use the bottom tab bar). Collapses to a circle on scroll. */}
            <div className="pointer-events-auto absolute left-1/2 hidden -translate-x-1/2 lg:block">
              <AnimatedNavFramer
                bare
                logo={null}
                expanded={expanded}
                onExpandedChange={setExpanded}
                flat={atTop}
                collapsedIcon={<Ellipsis className="h-6 w-6" aria-hidden />}
                items={primary.map((l) => ({ name: l.label, href: l.href, active: pathname.startsWith(l.href) }))}
              />
            </div>

            {/* Account, bag, menu: slides away while scrolling down */}
            <motion.div variants={sideVariants} animate={expanded ? "shown" : "hidden"} {...(!expanded && { inert: true })}>
              <div className={`${expanded ? "pointer-events-auto" : "pointer-events-none"} ${pillChrome(atTop)} flex h-12 items-center rounded-full border px-1.5`}>
                {account}
                <Link href="/bag" className="relative flex h-10 w-10 items-center justify-center" aria-label={`Bag, ${ready ? count : 0} items`}>
                  <BagIcon className="h-5 w-5" />
                  {ready && count > 0 && (
                    <span className="absolute right-0.5 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-volt px-1 font-mono text-[11px] font-semibold text-ink">
                      {count}
                    </span>
                  )}
                </Link>
                {/* Full-width bar: no menu button. Pills: the smooth dropdown with everything else. */}
                {!atTop && (
                  <div className="ml-0.5 mr-0.5">
                    <SmoothDropdown items={dropdownItems} activeId={pathname} label="More" />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </MotionConfig>

    </header>
  );
}

const tabs = [
  { href: "/drops", label: "Drops", Icon: DropIcon },
  { href: "/shop", label: "Shop", Icon: ShopIcon },
  { href: "/gift", label: "Gift", Icon: GiftIcon },
  { href: "/visit", label: "Visit", Icon: PinIcon },
  { href: "/alerts", label: "Alerts", Icon: BellIcon },
];

/** Bottom tab bar on phones: Drops · Shop · Gift · Visit · Alerts. */
export function MobileTabBar() {
  const pathname = usePathname();
  const [typing, setTyping] = useState(false);

  // Slide away while a text field has focus, so it never floats above the keyboard.
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && t.matches("input:not([type=checkbox]):not([type=radio]), textarea, select");
    const onIn = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const onOut = (e: FocusEvent) => isField(e.target) && setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  if (pathname.startsWith("/checkout")) return null;
  return (
    <nav
      aria-label="Quick links"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-mist bg-paper pb-[env(safe-area-inset-bottom)] transition-transform duration-200 lg:hidden ${typing ? "translate-y-full" : ""}`}
    >
      <ul className="grid grid-cols-5">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${active ? "text-ink" : "text-steel-dark"}`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
