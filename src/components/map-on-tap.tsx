"use client";

import { useState } from "react";

/** A map that loads only when asked, so the Visit page stays fast on mobile data. */
export function MapOnTap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const [show, setShow] = useState(false);
  if (!show) {
    return (
      <button type="button" onClick={() => setShow(true)} className="flex aspect-[16/10] w-full items-center justify-center bg-photo text-[15px] font-semibold underline-offset-4 hover:underline">
        Show map
      </button>
    );
  }
  return (
    <iframe
      title={`Map: ${label}`}
      src={`https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`}
      className="aspect-[16/10] w-full border-0"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
