"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Refreshes the page when a drop opens, so "Arrives…" turns into buyable pieces without a
 * manual reload. A few seconds of random delay keeps every phone from asking at once, and
 * two later tries catch a page that was still cached.
 */
export function RefreshAt({ at }: { at: string }) {
  const router = useRouter();
  useEffect(() => {
    const wait = Date.parse(at) - Date.now();
    // Already open, or too far off for a timer (more than a day): nothing to schedule.
    if (!(wait > 0) || wait > 24 * 60 * 60_000) return;
    const jitter = Math.random() * 5000;
    const timers = [1000, 35_000, 120_000].map((after) => setTimeout(() => router.refresh(), wait + jitter + after));
    return () => timers.forEach(clearTimeout);
  }, [at, router]);
  return null;
}
