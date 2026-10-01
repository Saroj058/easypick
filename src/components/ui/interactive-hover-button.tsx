import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * A pill with a small white dot beside its label. On hover the dot grows to fill the pill, the
 * label slides away and comes back in black with an arrow. It is a link (it takes people
 * somewhere), made for dark grounds. Touch screens get the plain pill, label always visible.
 */
export function InteractiveHoverButton({ href, text, className }: { href: string; text: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex h-12 min-w-44 items-center justify-center overflow-hidden rounded-full border border-paper/40 px-6 text-[14px] font-semibold uppercase tracking-[0.06em] text-paper",
        className,
      )}
    >
      {/* The dot, which grows into the fill */}
      <span
        aria-hidden
        className="absolute left-5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-paper transition-all duration-300 [@media(hover:hover)]:group-hover:left-0 [@media(hover:hover)]:group-hover:top-0 [@media(hover:hover)]:group-hover:h-full [@media(hover:hover)]:group-hover:w-full [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:scale-[1.8]"
      />
      {/* The label at rest */}
      <span className="relative inline-block translate-x-2 transition-all duration-300 [@media(hover:hover)]:group-hover:translate-x-12 [@media(hover:hover)]:group-hover:opacity-0">{text}</span>
      {/* The label on the fill: black on white, with the arrow */}
      <span
        aria-hidden
        className="absolute inset-0 z-10 flex translate-x-12 items-center justify-center gap-2 text-ink opacity-0 transition-all duration-300 [@media(hover:hover)]:group-hover:translate-x-0 [@media(hover:hover)]:group-hover:opacity-100"
      >
        {text}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
