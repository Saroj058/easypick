"use client";

import { useState } from "react";

/** Lets the buyer pass the private gift link on themselves (copy or WhatsApp). */
export function ShareGiftLink({ url, name, from }: { url: string; name: string; from: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = `${from ? `${from} sent you` : "You've got"} a gift from Easypick. Open it here: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard blocked: the link is visible to copy by hand
    }
  }

  return (
    <div className="mt-5">
      <p className="text-sm font-semibold">Share the gift link with {name.split(" ")[0]}</p>
      <p className="mt-1 break-all rounded-[2px] border border-mist bg-paper px-3 py-2 font-mono text-[13px]">{url}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={copy} className="btn btn-ink sm:flex-1">
          {copied ? "Link copied" : "Copy link"}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" className="btn btn-outline sm:flex-1">
          Send on WhatsApp
        </a>
      </div>
      <p role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </p>
    </div>
  );
}
