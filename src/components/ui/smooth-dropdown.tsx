"use client";

import { useState, useRef, useEffect, useId } from "react";
import Link from "next/link";
// Same library as "motion/react" (motion is framer-motion's new name); reusing the
// copy already in the app so it isn't bundled twice.
import { motion } from "framer-motion";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import useMeasure from "react-use-measure";
import {
  UserIcon,
  CreditCardIcon,
  FolderIcon,
  File01Icon,
  SettingsIcon,
  HelpCircleIcon,
  LogoutIcon,
  MoreHorizontalCircle01Icon,
} from "@hugeicons/core-free-icons";

export interface SmoothDropdownItem {
  id: string;
  label: string;
  icon: IconSvgElement | null;
  /** Navigate to this page when chosen. */
  href?: string;
  /** Or run this when chosen. */
  onSelect?: () => void;
  /** Red styling, e.g. for "Log out". */
  danger?: boolean;
}

// Change Here (defaults, used by the demo)
const menuItems: SmoothDropdownItem[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "upgrade", label: "Upgrade", icon: CreditCardIcon },
  { id: "projects", label: "Projects", icon: FolderIcon },
  { id: "documentation", label: "Documentation", icon: File01Icon },
  { id: "divider", label: "", icon: null },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "help", label: "Get Help", icon: HelpCircleIcon },
  { id: "logout", label: "Logout", icon: LogoutIcon, danger: true },
];

const easeOutQuint: [number, number, number, number] = [0.23, 1, 0.32, 1];

export function TwentyTwelveOne({
  items = menuItems,
  activeId,
  label = "Menu",
  width = 220,
}: {
  items?: SmoothDropdownItem[];
  /** Item to highlight when nothing is hovered (e.g. the current page). */
  activeId?: string;
  /** Accessible name of the button. */
  label?: string;
  width?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const [contentRef, contentBounds] = useMeasure();

  const close = (returnFocus = false) => {
    setIsOpen(false);
    setHoveredItem(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) close();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    // Move focus into the menu for keyboard users.
    const first = containerRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  // Arrow keys move between items.
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const els = [...(containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % els.length : (i - 1 + els.length) % els.length;
    els[next]?.focus();
  };

  const openHeight = Math.max(40, Math.ceil(contentBounds.height));
  return (
    <div ref={containerRef} className="relative h-10 w-10 not-prose">
      <motion.div
        layout
        initial={false}
        animate={{
          width: isOpen ? width : 40,
          height: isOpen ? openHeight : 40,
          borderRadius: isOpen ? 14 : 12,
        }}
        transition={{
          type: "spring" as const,
          damping: 34,
          stiffness: 380,
          mass: 0.8,
        }}
        className={`absolute top-0 right-0 z-10 overflow-hidden origin-top-right ${
          isOpen ? "bg-popover border border-border shadow-lg" : "border border-transparent"
        }`}
      >
        {/* The closed state: a real button */}
        <motion.button
          ref={triggerRef}
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={menuId}
          onClick={() => setIsOpen(true)}
          initial={false}
          animate={{
            opacity: isOpen ? 0 : 1,
            scale: isOpen ? 0.8 : 1,
          }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-[12px]"
          style={{
            pointerEvents: isOpen ? "none" : "auto",
            willChange: "transform",
          }}
          tabIndex={isOpen ? -1 : 0}
        >
          <HugeiconsIcon icon={MoreHorizontalCircle01Icon} className="w-6 h-6 text-foreground" />
        </motion.button>

        {/* Menu Content - visible when open */}
        <div ref={contentRef}>
          <motion.div
            layout
            initial={false}
            animate={{
              opacity: isOpen ? 1 : 0,
            }}
            transition={{
              duration: 0.2,
              delay: isOpen ? 0.08 : 0,
            }}
            className="p-2"
            style={{
              pointerEvents: isOpen ? "auto" : "none",
              willChange: "transform",
            }}
            {...(!isOpen && { inert: true })}
          >
            <ul id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKeyDown} className="flex flex-col gap-0.5 m-0! p-0! list-none!">
              {items.map((item, index) => {
                if (item.id.startsWith("divider")) {
                  return (
                    <motion.li
                      key={item.id}
                      role="separator"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isOpen ? 1 : 0 }}
                      transition={{ delay: isOpen ? 0.12 + index * 0.015 : 0 }}
                      className="my-1.5! border-t border-border"
                    />
                  );
                }

                const isActive = activeId === item.id;
                const isDanger = item.danger === true;
                const showIndicator = hoveredItem ? hoveredItem === item.id : isActive;

                const itemDuration = isDanger ? 0.12 : 0.15;
                const itemDelay = isOpen ? 0.06 + index * 0.02 : 0;

                const rowClass = `relative flex w-full items-center gap-3 rounded-lg text-sm text-left cursor-pointer transition-colors duration-200 ease-out m-0! pl-3! pr-3 py-2! outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isDanger && showIndicator
                    ? "text-destructive"
                    : isActive
                      ? "text-foreground"
                      : isDanger
                        ? "text-muted-foreground hover:text-destructive"
                        : "text-muted-foreground hover:text-foreground"
                }`;

                const inner = (
                  <>
                    {/* Hover/Active background indicator */}
                    {showIndicator && (
                      <motion.div
                        layoutId="activeIndicator"
                        className={`absolute inset-0 rounded-lg ${isDanger ? "bg-red-50" : "bg-muted"}`}
                        transition={{ type: "spring", damping: 30, stiffness: 520, mass: 0.8 }}
                      />
                    )}
                    {/* Left bar indicator */}
                    {showIndicator && (
                      <motion.div
                        layoutId="leftBar"
                        className={`absolute left-0 top-0 bottom-0 my-auto w-[3px] h-5 rounded-full ${isDanger ? "bg-destructive" : "bg-foreground"}`}
                        transition={{ type: "spring", damping: 30, stiffness: 520, mass: 0.8 }}
                      />
                    )}
                    {item.icon && <HugeiconsIcon icon={item.icon} className="w-[18px] h-[18px] relative z-10" />}
                    <span className="font-medium relative z-10">{item.label}</span>
                  </>
                );

                return (
                  <motion.li
                    key={item.id}
                    role="none"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : 8 }}
                    transition={{ delay: itemDelay, duration: itemDuration, ease: easeOutQuint }}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    {item.href ? (
                      <Link
                        href={item.href}
                        role="menuitem"
                        tabIndex={isOpen ? 0 : -1}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => close()}
                        onFocus={() => setHoveredItem(item.id)}
                        className={rowClass}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => {
                          close();
                          item.onSelect?.();
                        }}
                        onFocus={() => setHoveredItem(item.id)}
                        className={rowClass}
                      >
                        {inner}
                      </button>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default TwentyTwelveOne;
