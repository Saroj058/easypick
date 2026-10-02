"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useState } from "react";

/**
 * A round search button that springs open into a search field, and folds back when closed.
 * It searches as you type: `value` and `onChange` belong to whoever holds the results.
 * Open, it fills the space its parent gives it (up to 320px); closed, it is one 44px button.
 */
export function ExpandingSearchDock({
  value,
  onChange,
  label,
  placeholder = "Search...",
  onOpenChange,
  className = "",
}: {
  value: string;
  onChange: (query: string) => void;
  /** What it searches, for screen readers: "Search the rail". */
  label: string;
  placeholder?: string;
  /** Told when the field opens and folds away, for a parent that makes room for it. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const [opened, setOpened] = useState(false);
  // It can't fold away while it still holds a search.
  const expanded = opened || value !== "";

  function collapse() {
    setOpened(false);
    onOpenChange?.(false);
    onChange("");
  }

  return (
    <div className={`relative flex h-11 justify-end ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        {!expanded ? (
          <motion.button
            key="icon"
            type="button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={() => {
              setOpened(true);
              onOpenChange?.(true);
            }}
            aria-label={label}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-mist bg-paper transition-colors hover:border-ink"
          >
            <Search className="h-[18px] w-[18px]" aria-hidden />
          </motion.button>
        ) : (
          <motion.form
            key="input"
            role="search"
            initial={{ width: 44, opacity: 0 }}
            animate={{ width: "100%", opacity: 1 }}
            exit={{ width: 44, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onSubmit={(e) => e.preventDefault()}
            onKeyDown={(e) => e.key === "Escape" && collapse()}
            className="relative max-w-[320px]"
          >
            <div className="relative flex h-11 items-center gap-2 overflow-hidden rounded-full border border-ink bg-paper">
              <Search className="ml-4 h-4 w-4 shrink-0 text-steel-dark" aria-hidden />
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-label={label}
                autoFocus
                className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-steel-dark"
              />
              <motion.button
                type="button"
                onClick={collapse}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close search"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              >
                <X className="h-4 w-4" aria-hidden />
              </motion.button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
