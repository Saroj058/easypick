// components/animated-nav-framer.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { MotionConfig, motion, useScroll, useMotionValueEvent, type Variants } from "framer-motion";
import { Navigation, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnimatedNavItem {
  name: string;
  href: string;
  active?: boolean;
}

const defaultItems: AnimatedNavItem[] = [
  { name: "Home", href: "#" },
  { name: "About", href: "#" },
  { name: "Services", href: "#" },
  { name: "Contact", href: "#" },
];

const EXPAND_SCROLL_THRESHOLD = 80;

const containerVariants: Variants = {
  expanded: {
    y: 0,
    opacity: 1,
    width: "auto",
    transition: {
      y: { type: "spring", damping: 18, stiffness: 250 },
      opacity: { duration: 0.3 },
      type: "spring",
      damping: 20,
      stiffness: 300,
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
  collapsed: {
    y: 0,
    opacity: 1,
    width: "3rem",
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 300,
      when: "afterChildren",
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const logoVariants: Variants = {
  expanded: { opacity: 1, x: 0, rotate: 0, transition: { type: "spring", damping: 15 } },
  collapsed: { opacity: 0, x: -25, rotate: -180, transition: { duration: 0.3 } },
};

const itemVariants: Variants = {
  expanded: { opacity: 1, x: 0, scale: 1, transition: { type: "spring", damping: 15 } },
  collapsed: { opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.2 } },
};

const collapsedIconVariants: Variants = {
  expanded: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
  collapsed: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      damping: 15,
      stiffness: 300,
      delay: 0.15,
    },
  },
};

const MotionLink = motion.create(Link);

const COLLAPSE_AFTER = 150; // px from the top before anything hides
const JITTER = 6; // ignore tiny scroll movements (trackpad bounce, iOS rubber-band)

/**
 * Scroll-driven "open or collapsed" state shared by the nav pieces.
 * Collapses when scrolling down past COLLAPSE_AFTER; reopens after scrolling back
 * up EXPAND_SCROLL_THRESHOLD px from the lowest point reached, or near the top.
 */
export function useScrollCollapse() {
  const [expanded, setExpanded] = React.useState(true);
  const { scrollY } = useScroll();
  const lastScrollY = React.useRef(0);
  const lowestSinceCollapse = React.useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = lastScrollY.current;
    const delta = latest - previous;
    if (Math.abs(delta) < JITTER) return; // wait until the movement is meaningful
    lastScrollY.current = latest;

    if (latest <= COLLAPSE_AFTER) {
      if (!expanded) setExpanded(true);
      return;
    }
    if (expanded && delta > 0) {
      setExpanded(false);
      lowestSinceCollapse.current = latest;
      return;
    }
    if (!expanded) {
      if (latest > lowestSinceCollapse.current) lowestSinceCollapse.current = latest;
      else if (lowestSinceCollapse.current - latest > EXPAND_SCROLL_THRESHOLD) setExpanded(true);
    }
  });

  return [expanded, setExpanded] as const;
}

function Wrapper({ bare, children }: { bare: boolean; children: React.ReactNode }) {
  if (bare) return <>{children}</>;
  return <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3 md:top-5">{children}</div>;
}

/**
 * Floating pill navigation. Collapses to a round button when scrolling down and
 * expands again when scrolling back up or when the button is pressed.
 */
export function AnimatedNavFramer({
  items = defaultItems,
  logo,
  actions,
  linksClassName,
  label = "Main",
  bare = false,
  collapsedIcon,
  expanded,
  onExpandedChange,
  flat = false,
}: {
  items?: AnimatedNavItem[];
  /** Shown at the start of the pill. Defaults to a generic icon. */
  logo?: React.ReactNode | null;
  /** Shown at the end of the pill (e.g. bag, account, menu). */
  actions?: React.ReactNode;
  /** Extra classes for the links row, e.g. to hide it on small screens. */
  linksClassName?: string;
  label?: string;
  /** Render just the pill, without its own fixed full-width wrapper (for custom layouts). */
  bare?: boolean;
  /** Icon shown when collapsed to a circle. Defaults to a menu icon. */
  collapsedIcon?: React.ReactNode;
  /** Control the open/collapsed state from outside (see useScrollCollapse). */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** No pill background, border or shadow (e.g. while sitting inside a full-width bar). */
  flat?: boolean;
}) {
  // Controlled when the parent passes `expanded` (e.g. to move other pieces in sync); otherwise self-managed.
  const own = useScrollCollapse();
  const isExpanded = expanded ?? own[0];
  const setExpanded = React.useCallback(
    (v: boolean) => (onExpandedChange ? onExpandedChange(v) : own[1](v)),
    [onExpandedChange, own],
  );

  const handleNavClick = (e: React.MouseEvent) => {
    if (!isExpanded) {
      e.preventDefault();
      setExpanded(true);
    }
  };

  // Hidden parts of a collapsed pill must not be reachable by keyboard.
  const hiddenWhenCollapsed = !isExpanded ? { inert: true } : {};

  return (
    // Respect the device's "reduce motion" setting.
    <MotionConfig reducedMotion="user">
      {/* Full-width row so the pill can grow to its content; clicks pass through the empty sides. */}
      <Wrapper bare={bare}>
        <motion.nav
          aria-label={label}
          initial={{ y: -80, opacity: 0 }}
          animate={isExpanded ? "expanded" : "collapsed"}
          variants={containerVariants}
          whileHover={!isExpanded ? { scale: 1.1 } : {}}
          whileTap={!isExpanded ? { scale: 0.95 } : {}}
          onClick={handleNavClick}
          className={cn(
            "pointer-events-auto relative flex h-12 max-w-full items-center overflow-hidden rounded-full border transition-[background-color,border-color,box-shadow] duration-300",
            flat ? "border-transparent bg-transparent shadow-none" : "border-border bg-background shadow-[0_6px_24px_rgba(0,0,0,0.08)]",
            !isExpanded && "cursor-pointer justify-center",
          )}
        >
          {logo !== null && (
            <motion.div variants={logoVariants} className="flex flex-shrink-0 items-center pl-4 pr-2 font-semibold" {...hiddenWhenCollapsed}>
              {logo ?? <Navigation className="h-6 w-6" />}
            </motion.div>
          )}

          {/* The links: unclickable while the nav is collapsed */}
          <motion.div
            className={cn("flex items-center gap-1 pr-2 sm:gap-2 lg:gap-4", logo === null && "pl-3", !isExpanded && "pointer-events-none", linksClassName)}
            {...hiddenWhenCollapsed}
          >
            {items.map((item) => (
              <MotionLink
                key={item.name}
                href={item.href}
                variants={itemVariants}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap px-2 py-1 text-sm font-semibold uppercase tracking-[0.06em] transition-colors hover:text-foreground",
                  item.active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {item.name}
              </MotionLink>
            ))}
          </motion.div>

          {actions && (
            <motion.div variants={itemVariants} className={cn("flex items-center pr-2", !isExpanded && "pointer-events-none")} {...hiddenWhenCollapsed}>
              {actions}
            </motion.div>
          )}

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <motion.div variants={collapsedIconVariants} animate={isExpanded ? "expanded" : "collapsed"}>
              {collapsedIcon ?? <Menu className="h-6 w-6" aria-hidden />}
            </motion.div>
          </div>

          {/* A real button while collapsed, so keyboard and screen-reader users can open it too. */}
          {!isExpanded && (
            <button type="button" aria-label="Show navigation" onClick={() => setExpanded(true)} className="absolute inset-0 rounded-full" />
          )}
        </motion.nav>
      </Wrapper>
    </MotionConfig>
  );
}
