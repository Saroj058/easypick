import type { Metadata } from "next";

import { RefreshAt } from "@/components/refresh-at";
import { VisitHero } from "@/components/visit/visit-hero";
import { VisitStage, type StageSwitches } from "@/components/visit/visit-stage";
import { getCurrentUser } from "@/lib/auth";
import { jsonLd } from "@/lib/json-ld";
import { routeFor } from "@/lib/map/route";
import { ordersFor } from "@/lib/orders";
import { site } from "@/lib/site";
import { getStoreInfo } from "@/lib/store-info";
import { DAY_NAMES, hourLabel, hoursOn, ktmNow, storeState, type StoreInfo } from "@/lib/store-state";
import { lightsFor, nextChangeAt, statusLine, statusShort, stripPrivate } from "@/lib/visit-status";
import { getDropTimeline, getProduct } from "@/lib/store";
import { getTourProps } from "@/lib/tour-props";

// The Visit page is one screen: the store at night and two ways to visit. In person opens the map
// (from the globe down to the door) with the directions, the hours and how the store works;
// Virtual tour opens /visit/tour. There is nothing below it.

const metadata: Metadata = {
  title: "Visit us",
  description: "Visit Easypick in Kathmandu in person or on a virtual tour: open now or not, the way to the door, opening hours, and how the self-checkout store works.",
  alternates: { canonical: "/visit" },
};
// Open or closed is worked out per visit, in Kathmandu time.
export const dynamic = "force-dynamic";

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** "Order EP-1000214 · ready at counter": one true reason to come today, for a signed-in visitor. */
async function personalLine(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const ready = (await ordersFor(user.id, user.phone ?? null)).find((o) => o.status === "ready_for_pickup");
    return ready ? `ORDER ${ready.number} · READY AT COUNTER` : null;
  } catch {
    return null; // never let this break the page
  }
}

function storeLd(info: StoreInfo) {
  // Google reads the hours and address from here. Only real details, only once the store is open.
  const byHours = new Map<string, string[]>();
  for (const h of info.hours) if (!h.closed) byHours.set(`${h.open}-${h.close}`, [...(byHours.get(`${h.open}-${h.close}`) ?? []), DAY_NAMES[h.day]]);
  return {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: site.name,
    url: `${site.url}/visit`,
    ...(info.address && { address: { "@type": "PostalAddress", streetAddress: info.address, addressLocality: info.area, addressCountry: "NP" } }),
    ...(info.geo && { geo: { "@type": "GeoCoordinates", latitude: info.geo.lat, longitude: info.geo.lng } }),
    ...(info.phone && { telephone: info.phone }),
    ...(info.mapUrl && { hasMap: info.mapUrl }),
    openingHoursSpecification: [...byHours].map(([k, days]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: k.split("-")[0], closes: k.split("-")[1] })),
    ...(info.special.length && {
      specialOpeningHoursSpecification: info.special.map((s) => ({
        "@type": "OpeningHoursSpecification",
        validFrom: s.date,
        validThrough: s.date,
        opens: s.closed ? "00:00" : s.open,
        closes: s.closed ? "00:00" : s.close,
      })),
    }),
    paymentAccepted: "eSewa",
    priceRange: "Rs 999 – Rs 3,499",
  };
}

export default async function VisitPage({ searchParams }: PageProps<"/visit">) {
  const sp = await searchParams;
  // ?preview=open: the page as it'll look once open, with sample details, for demos. Never indexed.
  const preview = sp.preview === "open";
  // Test switches: only on the preview, or outside production.
  const testing = preview || process.env.NODE_ENV !== "production";
  const one = (k: string) => (testing && typeof sp[k] === "string" ? (sp[k] as string) : null);
  const switches: StageSwitches = {
    motion: one("motion") === "fast" ? "fast" : "normal",
    lite: one("lite") === "1",
    gl: one("gl") === "off" ? "off" : "on",
    tiles: one("tiles") === "fixture" ? "fixture" : "live",
  };
  // ?now=2026-10-02T12:00+05:45 (a "+" in a link arrives as a space).
  const pinned = one("now") ? new Date(one("now")!.replace(" ", "+")) : null;
  const [saved, timeline, ready, tryProduct, tour] = await Promise.all([
    getStoreInfo({ preview }),
    getDropTimeline(),
    personalLine(),
    // "Try in store" on a product page leads here: one line says the piece is on the rack.
    typeof sp.try === "string" ? getProduct(sp.try) : Promise.resolve(null),
    getTourProps(),
  ]);
  const personal = ready ?? (tryProduct ? `${tryProduct.name.toUpperCase()} · ON THE RACK TO TRY` : null);
  const now = pinned && !Number.isNaN(pinned.getTime()) ? pinned : new Date();
  const state = storeState(saved, now, timeline.next?.releaseAt ?? timeline.current?.releaseAt ?? null);
  // Before opening day, nothing that pins the store down goes into the page.
  const info = stripPrivate(saved, state);
  const status = statusLine(state, info);
  const changeAt = nextChangeAt(info, state, now);
  // The written route, for when there are no start points yet (none of either before opening day).
  const start = routeFor(info);
  const soon = state.kind === "soon";
  const today = ktmNow(now).date;
  // The week from today, special days included.
  const hours = [0, 1, 2, 3, 4, 5, 6].map((n) => {
    const day = addDays(today, n);
    const h = hoursOn(info, day);
    return {
      label: n === 0 ? "Today" : DAY_NAMES[new Date(`${day}T12:00:00Z`).getUTCDay()],
      text: h ? `${hourLabel(h.open)} – ${hourLabel(h.close)}` : "Closed",
      today: n === 0,
      note: info.special.find((s) => s.date === day)?.note || null,
    };
  });

  return (
    <>
      {!preview && info.opened && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(storeLd(info))} />}
      {preview && (
        <p className="bg-volt px-4 py-2 text-center text-[14px] font-semibold text-ink">
          Preview: how this page looks once the store is open, with sample details. The public page is unchanged.
        </p>
      )}
      {/* The page refreshes itself when the status changes (closing time, the drop, the next opening). */}
      {changeAt && !pinned && <RefreshAt at={changeAt} />}
      <VisitStage
        lights={lightsFor(state)}
        switches={switches}
        tour={tour}
        find={{
          pin: info.geo,
          starts: soon ? [] : info.startPoints.map((s) => ({ id: s.id, name: s.name, coords: s.coords, steps: s.steps })),
          steps: soon ? [] : start.steps,
          status: statusShort(state),
          place: info.address ?? info.area,
          area: info.area,
          landmark: info.landmark || null,
          entrancePhoto: info.entrancePhoto,
          parkingSpots: info.parkingSpots,
          parkingNote: info.parking,
          soon,
          hours,
        }}
      >
        <VisitHero info={info} state={state} status={status} personal={personal} hours={`${soon ? "Planned hours today" : "Today"}: ${hours[0].text}`} mapsUrl={info.geo ? `https://www.google.com/maps/dir/?api=1&destination=${info.geo.lat},${info.geo.lng}&travelmode=walking` : null} />
      </VisitStage>
    </>
  );
}

export async function generateMetadata({ searchParams }: PageProps<"/visit">): Promise<Metadata> {
  return (await searchParams).preview ? { ...metadata, robots: { index: false, follow: false } } : metadata;
}
