"use client";

import { useState } from "react";

/** Share the tour: the phone's share sheet where there is one, otherwise copy the link. */
export function ShareTour() {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${location.origin}/visit/tour`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Walk the Easypick store", text: "Pick it. Pay it. Wear it. Walk through Easypick before it opens.", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // cancelled, or the clipboard isn't allowed: nothing to do
    }
  }
  return (
    <button type="button" onClick={share} data-cta="share" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
      {copied ? "Link copied" : "Share the tour"}
    </button>
  );
}
