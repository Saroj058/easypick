import type { Metadata, Viewport } from "next";

import { WalkTour } from "@/components/walk-tour";
import { getTourProps } from "@/lib/tour-props";
import { TOUR_STOPS } from "@/lib/tour-plan";

export const metadata: Metadata = {
  title: "Walk the store",
  description: "Scroll to walk through Easypick in Kathmandu: the racks, the fitting rooms, the self-checkout kiosk and the way out. The store as planned, built in 3D before it is fitted out.",
  alternates: { canonical: "/visit/tour" },
};
// The tour fills the window, edge to edge and dark, so the browser's own bars go dark with it.
export const viewport: Viewport = { themeColor: "#0a0a0a" };
// Only the tag and the kiosk's bill come from the catalogue, so the page can be cached.
export const revalidate = 300;

// The tour is the walk and nothing else: no site header, no footer (see ShopChrome), no intro, no block below it.
export default async function TourPage() {
  const { tag, bill } = await getTourProps();
  return <WalkTour stops={TOUR_STOPS} tag={tag} bill={bill} />;
}
