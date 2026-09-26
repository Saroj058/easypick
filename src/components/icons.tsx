// Small line icons, 24px grid, 1.75 stroke. Decorative unless given a label by the parent.

type P = { className?: string };
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const BagIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 8h14l-1 12H6L5 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);
export const MenuIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 8h16M4 16h16" />
  </svg>
);
export const CloseIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const DropIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />
  </svg>
);
export const ShopIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="4" y="4" width="7" height="7" />
    <rect x="13" y="4" width="7" height="7" />
    <rect x="4" y="13" width="7" height="7" />
    <rect x="13" y="13" width="7" height="7" />
  </svg>
);
export const PinIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);
export const BellIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 21h4" />
  </svg>
);
export const ArrowIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const ChevronIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const UserIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);
export const GiftIcon = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="4" y="9" width="16" height="11" />
    <path d="M3 9h18M12 9v11" />
    <path d="M12 9c-1.5-3-5-4-5-1.5C7 9 12 9 12 9Zm0 0c1.5-3 5-4 5-1.5C17 9 12 9 12 9Z" />
  </svg>
);

/** Filled when the piece is in the bag (cards). */
export const HeartIcon = ({ filled, className }: P & { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
    <path d="M12 20.5s-7.5-4.6-9.2-9.1C1.6 8.2 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.6 3.7 4.4 6.9-1.7 4.5-9.2 9.1-9.2 9.1Z" />
  </svg>
);

/** Save for later. Filled when saved. */
export const BookmarkIcon = ({ filled, className }: P & { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
    <path d="M6 3.5h12v17l-6-4.5-6 4.5v-17Z" />
  </svg>
);
