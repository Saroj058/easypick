"use client";

import { MotionConfig, motion, useMotionValueEvent, useScroll, type Variants } from "framer-motion";
import { Ellipsis, Shirt } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useBag } from "./bag-provider";
import { BagIcon, GiftIcon, ShopIcon, UserIcon } from "./icons";
import { MobileMenu } from "./mobile-menu";
import { SearchButton } from "./search";
import { useMe } from "./session";
import { AnimatedNavFramer, useScrollCollapse } from "./ui/navigation-menu";
import { TwentyTwelveOne as SmoothDropdown, type SmoothDropdownItem } from "./ui/smooth-dropdown";
import { signOut } from "@/app/auth-actions";
import {
  Calendar03Icon,
  DashboardSquare01Icon,
  DeliveryTracking01Icon,
  FavouriteIcon,
  FireIcon,
  GiftCardIcon,
  HangerIcon,
  HelpCircleIcon,
  InformationCircleIcon,
  Login01Icon,
  LogoutIcon,
  Notification01Icon,
  RulerIcon,
  UserIcon as UserHugeIcon,
} from "@hugeicons/core-free-icons";

// One menu, named for what customers want to do (docs/BLUEPRINT.md, section 05).
const primary = [
  { href: "/shop", label: "Shop" },
  { href: "/fits", label: "Fits" },
  { href: "/gift", label: "Gift" },
  { href: "/vault", label: "The Vault" },
  { href: "/visit", label: "Visit" },
];

// Everything inside those five, shown in the dropdown once the header becomes pills.
const menu: SmoothDropdownItem[] = [
  { id: "/new", href: "/new", label: "New in", icon: Calendar03Icon },
  { id: "/trending", href: "/trending", label: "Trending", icon: FireIcon },
  { id: "/drops", href: "/drops", label: "Drops", icon: Calendar03Icon },
  { id: "/fit", href: "/fit", label: "Build a fit", icon: HangerIcon },
  { id: "/gift-cards", href: "/gift-cards", label: "Gift cards", icon: GiftCardIcon },
  { id: "/saved", href: "/saved", label: "Saved", icon: FavouriteIcon },
  { id: "/size-guide", href: "/size-guide", label: "Your size in cm", icon: RulerIcon },
  { id: "/how-it-works", href: "/how-it-works", label: "How the store works", icon: HelpCircleIcon },
  { id: "/alerts", href: "/alerts", label: "Drop alerts", icon: Notification01Icon },
  { id: "/track", href: "/track", label: "Track an order", icon: DeliveryTracking01Icon },
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

  // The visit page is one full screen of the store: there the header starts tucked away (a back
  // button and the three dots) and opens when the dots are pressed.
  const visit = pathname === "/visit";
  const flat = atTop && !visit;

  // A new page starts at the top, so everything shows (except on the visit page).
  useEffect(() => setExpanded(pathname !== "/visit"), [pathname, setExpanded]);

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
    ...(me?.staff ? [me.staff === "helper" ? { id: "/helper", href: "/helper", label: "Helper", icon: DashboardSquare01Icon } : { id: "/admin", href: "/admin", label: "Admin", icon: DashboardSquare01Icon }] : []),
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
      {pathname !== "/" && !visit && <div className="h-[72px] md:h-[88px]" aria-hidden />}

      {/* Three floating pills: logo · links · actions. Clicks pass through the gaps. */}
      <MotionConfig reducedMotion="user">
        {/* Full-width bar behind the three sections, only at the very top of the page */}
        <motion.div
          aria-hidden
          initial={false}
          animate={flat ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[72px] border-b border-mist bg-paper pt-[env(safe-area-inset-top)] md:h-[88px]"
        />
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 md:top-5">
          <div className="container-ep relative flex items-center justify-between gap-3">
            {/* Logo: slides away while scrolling down */}
            {/* Not inert while tucked away: tabbing to it brings it back (onFocus below). */}
            <div className="relative">
              <motion.div variants={sideVariants} animate={expanded ? "shown" : "hidden"} onFocus={() => setExpanded(true)}>
                <Link href="/" aria-label="Easypick home" className={`${expanded ? "pointer-events-auto" : "pointer-events-none"} ${pillChrome(flat)} flex h-12 items-center rounded-full border px-5`}>
                  <Image src="/brand/logo.png" alt="Easypick" width={611} height={161} priority className="h-5 w-[76px]" />
                </Link>
              </motion.div>
              {/* The visit page, header tucked away: the way back home, where the logo was. */}
              {visit && !expanded && (
                <Link href="/" data-visit-back className="pointer-events-auto absolute left-0 top-0 flex h-12 items-center gap-2 whitespace-nowrap rounded-full border border-mist bg-paper px-5 text-sm font-semibold uppercase tracking-[0.06em] shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
                  <span aria-hidden>←</span> Home
                </Link>
              )}
            </div>

            {/* Links (large screens; phones and tablets use the bottom tab bar). Collapses to a circle on scroll. */}
            <div className="pointer-events-auto absolute left-1/2 hidden -translate-x-1/2 lg:block">
              <AnimatedNavFramer
                bare
                logo={null}
                expanded={expanded}
                onExpandedChange={setExpanded}
                flat={flat}
                collapsedIcon={<Ellipsis className="h-6 w-6" aria-hidden />}
                items={primary.map((l) => ({ name: l.label, href: l.href, active: pathname === l.href || pathname.startsWith(`${l.href}/`) }))}
              />
            </div>

            {/* Account, bag, menu: slides away while scrolling down */}
            <div className="relative">
            {/* Phones have no centre pill: on the visit page the three dots sit here instead. */}
            {visit && !expanded && (
              <button type="button" aria-label="Show navigation" onClick={() => setExpanded(true)} className="pointer-events-auto absolute right-0 top-0 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-mist bg-paper shadow-[0_6px_24px_rgba(0,0,0,0.08)] lg:hidden">
                <Ellipsis className="h-6 w-6" aria-hidden />
              </button>
            )}
            <motion.div variants={sideVariants} animate={expanded ? "shown" : "hidden"} onFocus={() => setExpanded(true)}>
              <div className={`${expanded ? "pointer-events-auto" : "pointer-events-none"} ${pillChrome(flat)} flex h-12 items-center rounded-full border px-1.5`}>
                <SearchButton />
                {account}
                <Link href="/bag" className="relative flex h-10 w-10 items-center justify-center" aria-label={`Bag, ${ready ? count : 0} items`}>
                  <BagIcon className="h-5 w-5" />
                  {ready && count > 0 && (
                    <span className="absolute right-0.5 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-volt px-1 font-mono text-[11px] font-semibold text-ink">
                      {count}
                    </span>
                  )}
                </Link>
                <MobileMenu />
                {/* Large screens: at the top, no menu button; as pills, the smooth dropdown with everything else. */}
                {!atTop && (
                  <div className="ml-0.5 mr-0.5 hidden lg:block">
                    <SmoothDropdown items={dropdownItems} activeId={pathname} label="More" />
                  </div>
                )}
              </div>
            </motion.div>
            </div>
          </div>
        </div>
      </MotionConfig>

    </header>
  );
}

const tabClass = "flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]";

/** Bottom tab bar on phones: Shop · Fits · Gift · Bag · Account. The Vault and Visit are in the menu. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { count, ready } = useBag();
  const me = useMe();
  const [typing, setTyping] = useState(false);
  const tabs = [
    { href: "/shop", label: "Shop", icon: <ShopIcon className="h-5 w-5" /> },
    { href: "/fits", label: "Fits", icon: <Shirt className="h-5 w-5" strokeWidth={1.8} aria-hidden /> },
    { href: "/gift", label: "Gift", icon: <GiftIcon className="h-5 w-5" /> },
  ];

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

  // Purchase flows have their own pay bar at the bottom instead.
  // …and the store walk-through needs the whole screen.
  if (pathname.startsWith("/checkout") || pathname.startsWith("/gift/") || pathname === "/gift-cards" || pathname === "/visit/tour") return null;
  return (
    <nav
      aria-label="Quick links"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-mist bg-paper pb-[env(safe-area-inset-bottom)] transition-transform duration-200 lg:hidden ${typing ? "translate-y-full" : ""}`}
    >
      <ul className="grid grid-cols-5">
        {tabs.map((t) => (
          <Tab key={t.href} {...t} active={pathname === t.href || pathname.startsWith(`${t.href}/`) || (t.href === "/fits" && pathname === "/fit")} />
        ))}
        <li>
          <Link
            href="/bag"
            aria-current={pathname.startsWith("/bag") ? "page" : undefined}
            aria-label={`Bag, ${ready ? count : 0} items`}
            className={`${tabClass} relative ${pathname.startsWith("/bag") ? "text-ink" : "text-steel-dark"}`}
          >
            <BagIcon className="h-5 w-5" />
            Bag
            {ready && count > 0 && (
              <span className="absolute left-1/2 top-1.5 ml-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-volt px-1 font-mono text-[11px] font-semibold text-ink">
                {count}
              </span>
            )}
          </Link>
        </li>
        <Tab href={me ? "/account" : "/login"} label="Account" icon={<UserIcon className="h-5 w-5" />} active={pathname.startsWith("/account") || pathname.startsWith("/login")} />
      </ul>
    </nav>
  );
}

function Tab({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <li>
      <Link href={href} aria-current={active ? "page" : undefined} className={`${tabClass} ${active ? "text-ink" : "text-steel-dark"}`}>
        {icon}
        {label}
      </Link>
    </li>
  );
}
