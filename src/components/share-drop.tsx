"use client";

import { useState } from "react";

/**
 * Share a drop. On a phone it hands the tall story image (made for Instagram and TikTok
 * stories) to the share sheet; where files can't be shared it shares the link; otherwise it copies it.
 */
export function ShareDrop({ slug, name }: { slug: string; name: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function share() {
    const url = `${location.origin}/drop/${slug}`;
    setBusy(true);
    try {
      if (navigator.share) {
        try {
          const res = await fetch(`/drop/${slug}/story`);
          const file = res.ok ? new File([await res.blob()], `easypick-drop-${slug}.png`, { type: "image/png" }) : null;
          if (file && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: name, text: `${name} at Easypick`, url });
            return;
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return; // they closed the share sheet
        }
        await navigator.share({ title: name, text: `${name} at Easypick`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied");
      setTimeout(() => setNote(""), 2500);
    } catch {
      // cancelled, or the clipboard isn't allowed: nothing to do
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={share} disabled={busy} data-cta="share-drop" className="inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6" />
      </svg>
      {note || "Share this drop"}
      <span role="status" className="sr-only">
        {note}
      </span>
    </button>
  );
}
