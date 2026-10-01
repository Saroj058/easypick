import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * A pill that fills from the centre on hover while one arrow slides out and another slides in.
 * It is a link (it takes people somewhere). The hover is decoration only: the label and an
 * arrow are always visible, and touch screens get the plain pill.
 */
export function FlowButton({ href, text, className = "" }: { href: string; text: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`group relative inline-flex h-12 items-center justify-center gap-1 overflow-hidden rounded-[100px] border-[1.5px] border-ink/40 bg-transparent px-9 text-[14px] font-semibold uppercase tracking-[0.04em] text-ink transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.95] [@media(hover:hover)]:hover:rounded-[12px] [@media(hover:hover)]:hover:border-transparent [@media(hover:hover)]:hover:text-paper ${className}`}
    >
      {/* The arrow that slides in from the left */}
      <ArrowRight
        aria-hidden
        className="absolute left-[-25%] z-[9] h-4 w-4 fill-none stroke-ink transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [@media(hover:hover)]:group-hover:left-4 [@media(hover:hover)]:group-hover:stroke-paper"
      />
      <span className="relative z-[1] -translate-x-3 whitespace-nowrap transition-all duration-[800ms] ease-out [@media(hover:hover)]:group-hover:translate-x-3">{text}</span>
      {/* The fill: a dot in the middle that grows past the edges */}
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink opacity-0 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] [@media(hover:hover)]:group-hover:h-[420px] [@media(hover:hover)]:group-hover:w-[420px] [@media(hover:hover)]:group-hover:opacity-100"
      />
      {/* The arrow that slides out to the right */}
      <ArrowRight
        aria-hidden
        className="absolute right-4 z-[9] h-4 w-4 fill-none stroke-ink transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [@media(hover:hover)]:group-hover:right-[-25%] [@media(hover:hover)]:group-hover:stroke-paper"
      />
    </Link>
  );
}
