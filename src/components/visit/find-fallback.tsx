"use client";

import { useEffect, useState } from "react";

import { MapOnTap } from "@/components/map-on-tap";
import { STATIC_ROUTE } from "@/lib/map/tiles";

/**
 * The map in the page's own "Find us" section, under the receipt. Most visitors get the Google
 * map that loads on a tap. The light version of the page (Save-Data, a slow connection, little
 * memory, or the live map lost its graphics context) gets one small picture of the route instead:
 * no script, no frame, with the map's credit printed on it. Which version this is comes from the
 * stage (visit-stage.tsx), so there is one decision for the whole page.
 */
export function FindFallback({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const [lite, setLite] = useState(false);

  useEffect(() => {
    const stage = document.querySelector("[data-stage]");
    if (!stage) return;
    const read = () => setLite(stage.getAttribute("data-fallback") === "lite");
    read();
    const seen = new MutationObserver(read);
    seen.observe(stage, { attributes: true, attributeFilter: ["data-fallback"] });
    return () => seen.disconnect();
  }, []);

  // The picture is of one pin: if the store's pin has moved since it was made, it isn't shown.
  const drawn = Math.abs(lat - STATIC_ROUTE.pin.lat) < 0.0005 && Math.abs(lng - STATIC_ROUTE.pin.lng) < 0.0005;
  if (lite && drawn) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- one small still, sized and compressed by hand
      <img data-route-static src={STATIC_ROUTE.src} alt={`Map: the route from ${STATIC_ROUTE.from} to Easypick`} width={STATIC_ROUTE.width} height={STATIC_ROUTE.height} loading="lazy" className="h-auto w-full bg-ink" />
    );
  }
  return <MapOnTap lat={lat} lng={lng} label={label} />;
}
