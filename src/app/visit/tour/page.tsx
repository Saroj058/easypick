import type { Metadata } from "next";

import { WalkTour } from "@/components/walk-tour";
import { formatPrice } from "@/lib/format";
import { getDropTimeline, getProducts } from "@/lib/store";
import { TOUR_STOPS } from "@/lib/tour-plan";

export const metadata: Metadata = {
  title: "Walk the store",
  description: "A one-minute film through Easypick in Kathmandu: the racks, the fitting rooms, the self-checkout kiosk and the way out. The store as planned, built in 3D before it is fitted out.",
  alternates: { canonical: "/visit/tour" },
};
// Only the tag and the kiosk's bill come from the catalogue, so the page can be cached.
export const revalidate = 300;

const cm = (v?: number) => (v ? `${v} cm` : null);

// The tour is the film and nothing else: no intro above it, no block below it.
export default async function TourPage() {
  const [products, timeline] = await Promise.all([getProducts(), getDropTimeline()]);
  const live = products.filter((p) => p.status === "live" && !p.vault);
  const price = (p: (typeof live)[number]) => p.salePrice ?? p.price;

  // The tag you read in the scene is a real piece: a tee from the latest drop if there is one.
  const tee =
    live.find((p) => p.category === "tees" && p.dropSlug === timeline.current?.slug && p.measurements.M) ??
    live.find((p) => p.category === "tees" && p.measurements.M) ??
    live[0];
  const tag = {
    name: tee?.name ?? "Heavy Tee",
    price: formatPrice(tee ? price(tee) : 999),
    chest: cm(tee?.measurements.M?.chest),
    length: cm(tee?.measurements.M?.length),
  };

  // The kiosk lists that tee and a hoodie, at their real prices, and adds them up.
  const hoodie = live.find((p) => p.category === "hoodies") ?? live.find((p) => p.slug !== tee?.slug);
  const first = { name: tee?.name ?? "Heavy Tee", amount: tee ? price(tee) : 999 };
  const second = { name: hoodie?.name ?? "Everyday Hoodie", amount: hoodie ? price(hoodie) : 1999 };
  const bill = {
    lines: [
      { name: first.name, price: formatPrice(first.amount) },
      { name: second.name, price: formatPrice(second.amount) },
    ] as [{ name: string; price: string }, { name: string; price: string }],
    total: formatPrice(first.amount + second.amount),
  };

  return <WalkTour stops={TOUR_STOPS} tag={tag} bill={bill} />;
}
