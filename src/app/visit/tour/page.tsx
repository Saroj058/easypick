import type { Metadata } from "next";
import Link from "next/link";

import { AlertSignup } from "@/components/alert-signup";
import { ShareTour } from "@/components/share-tour";
import { WalkTour, type RackPick } from "@/components/walk-tour";
import { formatPrice } from "@/lib/format";
import { getStoreInfo } from "@/lib/store-info";
import { storeState } from "@/lib/store-state";
import { getDropTimeline, getProducts } from "@/lib/store";
import { TOUR_STOPS } from "@/lib/tour-plan";
import { getTrending } from "@/lib/trending";
import type { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Walk the store",
  description: "Scroll to walk through Easypick in Kathmandu: the racks, the fitting rooms, the self-checkout kiosk and the way out. About a minute.",
  alternates: { canonical: "/visit/tour" },
};
// The ending depends on whether the store is open right now.
export const dynamic = "force-dynamic";

const cm = (v?: number) => (v ? `${v} cm` : null);

export default async function TourPage() {
  const [products, info, timeline, trending] = await Promise.all([getProducts(), getStoreInfo(), getDropTimeline(), getTrending()]);
  const live = products.filter((p) => p.status === "live");

  // The tag you read in the scene is a real piece: a tee from the latest drop if there is one.
  const tee =
    live.find((p) => p.category === "tees" && p.dropSlug === timeline.current?.slug && p.measurements.M) ??
    live.find((p) => p.category === "tees" && p.measurements.M) ??
    live[0];
  const tag = {
    name: tee?.name ?? "Heavy Tee",
    price: formatPrice(tee ? (tee.salePrice ?? tee.price) : 1999),
    chest: cm(tee?.measurements.M?.chest),
    length: cm(tee?.measurements.M?.length),
  };

  // "On the rack now": real pieces, honestly labelled. Latest drop first, then the trending or picks list.
  const fromDrop = live.filter((p) => timeline.current && p.dropSlug === timeline.current.slug);
  const trendNote = trending.mode === "trending" ? "Trending" : trending.label === "Staff picks" ? "Staff pick" : "Latest drop";
  const picks: { p: Product; note: string }[] = [
    ...fromDrop.slice(0, 2).map((p) => ({ p, note: timeline.current!.name })),
    ...trending.items.map((i) => ({ p: i.product, note: trendNote })),
  ];
  const seen = new Set<string>();
  const rack: RackPick[] = picks
    .filter(({ p }) => p.status === "live" && !seen.has(p.slug) && seen.add(p.slug))
    .slice(0, 3)
    .map(({ p, note }) => ({ slug: p.slug, name: p.name, price: formatPrice(p.salePrice ?? p.price), note }));

  const state = storeState(info, new Date());
  const directions = info.mapUrl ?? (info.geo ? `https://www.google.com/maps/search/?api=1&query=${info.geo.lat},${info.geo.lng}` : null);

  const end = (
    <section aria-labelledby="end-h" className="bg-ink py-20 text-paper md:py-28">
      <div className="container-ep on-dark max-w-3xl">
        <p className="font-mono text-[12px] tracking-[0.12em] text-paper/70">END OF THE WALK</p>
        <h2 id="end-h" className="display mt-3 text-[56px] leading-[0.9] md:text-[96px]">
          {state.kind === "soon" ? state.headline + "." : state.headline}
        </h2>
        <p lang="ne" className="mt-3 font-[family-name:var(--font-nepali)] text-lg text-paper/80">
          टिप्नुस्। तिर्नुस्। लगाउनुस्।
        </p>

        {state.kind === "soon" ? (
          <div className="mt-8 max-w-md">
            <p className="font-semibold">Get the opening-day SMS</p>
            <p className="mt-1 text-[15px] text-paper/70">One message when the shutter goes up. Nothing else.</p>
            <div className="mt-4" data-cta="opening-list">
              <AlertSignup dark source="tour" />
            </div>
          </div>
        ) : (
          <div className="mt-8 flex flex-wrap gap-3">
            {directions && (
              <a href={directions} target="_blank" rel="noopener" data-cta="directions" className="btn btn-volt">
                Get directions
              </a>
            )}
            <Link href="/visit" data-cta="visit" className="btn btn-outline">
              Hours and address
            </Link>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px]">
          <ShareTour />
          <Link href="/shop" data-cta="shop" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
            Shop online now
          </Link>
          <a href="#street" className="inline-flex min-h-11 items-center underline underline-offset-4">
            Walk it again
          </a>
        </div>
        <p className="mt-10 text-[13px] text-paper/60">The store as planned, built in 3D before it&apos;s fitted out. The finished store may differ in the details.</p>
      </div>
    </section>
  );

  return (
    <>
      <section className="container-ep pb-6 pt-12 md:pt-20">
        <p className="index text-steel-dark">
          <Link href="/visit" className="hover:underline">
            Visit us
          </Link>{" "}
          / Walk the store
        </p>
        <h1 className="display display-h1 mt-3">Walk the store.</h1>
        <p className="mt-4 max-w-[46ch] text-lg text-steel-dark md:text-xl">
          Scroll to walk in, pick, try, pay and walk out. About a minute. Use the arrows to jump between stops.
        </p>
      </section>
      <WalkTour stops={TOUR_STOPS} tag={tag} rack={rack} end={end} />
    </>
  );
}
