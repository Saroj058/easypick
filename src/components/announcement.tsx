"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const KEY = "ep-announce-closed";

function closedText() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * The owner's short announcement (Admin → Site settings): a slim pill just under the header. Closing
 * it hides that message on this device; a new message shows again. Not on the staff screens.
 */
export function Announcement({ text, link }: { text: string; link: string }) {
  const path = usePathname();
  const closed = useSyncExternalStore(
    (fn) => {
      window.addEventListener("storage", fn);
      window.addEventListener("ep-announce", fn);
      return () => {
        window.removeEventListener("storage", fn);
        window.removeEventListener("ep-announce", fn);
      };
    },
    closedText,
    () => text,
  );
  if (closed === text || path.startsWith("/admin") || path.startsWith("/helper") || path === "/visit/tour") return null;
  const body = <span className="truncate">{text}</span>;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[80px] z-30 flex justify-center px-3 md:top-[98px]">
      <div role="status" className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-[13px] font-semibold text-paper shadow-[0_10px_24px_-12px_rgba(0,0,0,0.5)]">
        {link ? (
          link.startsWith("/") ? (
            <Link href={link} className="flex min-w-0 items-center gap-2 underline-offset-4 hover:underline">
              {body} <span aria-hidden>→</span>
            </Link>
          ) : (
            <a href={link} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 underline-offset-4 hover:underline">
              {body} <span aria-hidden>↗</span>
            </a>
          )
        ) : (
          body
        )}
        <button
          type="button"
          aria-label="Close the announcement"
          onClick={() => {
            try {
              localStorage.setItem(KEY, text);
            } catch {
              // storage blocked: it just shows again next time
            }
            window.dispatchEvent(new Event("ep-announce"));
          }}
          className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-paper/70 hover:bg-white/10 hover:text-paper"
        >
          ×
        </button>
      </div>
    </div>
  );
}
