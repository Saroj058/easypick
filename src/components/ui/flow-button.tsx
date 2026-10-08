import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * A pill that fills from the centre on hover while one arrow slides out and another slides in.
 * With `href` it is a link (it takes people somewhere); with `onClick` it is a button (it does
 * something here). The hover is decoration only: the label and an arrow are always visible, and
 * touch screens get the plain pill.
 */
export function FlowButton({
  href,
  onClick,
  text,
  className = "",
  disabled,
  "aria-label": ariaLabel,
  solid = false,
}: {
  href?: string;
  onClick?: () => void;
  text: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  /** Black at rest and white on hover, instead of the other way round. */
  solid?: boolean;
}) {
  const classes = `group relative inline-flex h-12 items-center justify-center gap-1 overflow-hidden rounded-[100px] border-[1.5px] px-9 text-[14px] font-semibold uppercase tracking-[0.04em] transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.95] disabled:pointer-events-none disabled:opacity-40 [@media(hover:hover)]:hover:rounded-[12px] ${solid ? "border-ink bg-ink text-paper [@media(hover:hover)]:hover:text-ink" : "border-ink/40 bg-transparent text-ink [@media(hover:hover)]:hover:border-transparent [@media(hover:hover)]:hover:text-paper"} ${className}`;
  const arrow = solid ? "stroke-paper [@media(hover:hover)]:group-hover:stroke-ink" : "stroke-ink [@media(hover:hover)]:group-hover:stroke-paper";
  const inside = (
    <>
      {/* The arrow that slides in from the left */}
      <ArrowRight
        aria-hidden
        className={`absolute left-[-25%] z-[9] h-4 w-4 fill-none transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [@media(hover:hover)]:group-hover:left-4 ${arrow}`}
      />
      <span className="relative z-[1] -translate-x-3 whitespace-nowrap transition-all duration-[800ms] ease-out [@media(hover:hover)]:group-hover:translate-x-3">{text}</span>
      {/* The fill: a dot in the middle that grows past the edges */}
      <span
        aria-hidden
        className={`absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ${solid ? "bg-paper" : "bg-ink"} opacity-0 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] [@media(hover:hover)]:group-hover:h-[420px] [@media(hover:hover)]:group-hover:w-[420px] [@media(hover:hover)]:group-hover:opacity-100`}
      />
      {/* The arrow that slides out to the right */}
      <ArrowRight
        aria-hidden
        className={`absolute right-4 z-[9] h-4 w-4 fill-none transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] [@media(hover:hover)]:group-hover:right-[-25%] ${arrow}`}
      />
    </>
  );
  if (href)
    return (
      <Link href={href} aria-label={ariaLabel} className={classes}>
        {inside}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={classes}>
      {inside}
    </button>
  );
}
