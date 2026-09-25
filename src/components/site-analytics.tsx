"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Private links (gift pages, order pages, the admin) are never sent: their URLs are secrets.
const PRIVATE = /^\/(admin|helper|g|order|pay|account)(\/|$)/;

/** Cookie-free page counts (Vercel Web Analytics). Query strings other than utm_* are dropped. */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => {
        const url = new URL(event.url);
        if (PRIVATE.test(url.pathname)) return null;
        for (const key of [...url.searchParams.keys()]) if (!key.startsWith("utm_")) url.searchParams.delete(key);
        return { ...event, url: url.toString() };
      }}
    />
  );
}
