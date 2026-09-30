import type { Metadata } from "next";
import Link from "next/link";

import { StoreTour, type TourStop } from "@/components/store-tour";
import { CounterScene, DoorScene, ExitScene, FittingScene, HelperScene, KioskScene, RackScene } from "@/components/tour-scenes";
import { getStoreInfo } from "@/lib/store-info";
import { getProducts } from "@/lib/store";

export const metadata: Metadata = {
  title: "Virtual tour",
  description: "Walk through the Easypick store before you visit: the racks, the fitting rooms, the self-checkout kiosk and the pickup counter.",
  alternates: { canonical: "/visit/tour" },
};
export const revalidate = 3600;

export default async function TourPage() {
  const [products, info] = await Promise.all([getProducts(), getStoreInfo()]);
  // A real piece for the hang tag on the rack.
  const tagged = products.find((p) => p.status === "live" && p.category === "tees" && p.measurements.M) ?? products.find((p) => p.status === "live") ?? null;

  const stops: TourStop[] = [
    {
      id: "door",
      at: [120, 296],
      zone: "door",
      kicker: "The door",
      title: "Aaunus.",
      body: "The shutter's up, the greeter says hi. There's a three-step picture guide by the door if you want it. Just looking is fine too.",
      scene: <DoorScene />,
    },
    {
      id: "racks",
      at: [62, 206],
      zone: "racks",
      kicker: "The racks",
      title: "Pick it.",
      body: "Every tag shows the fixed price and the measurements in cm, so you know it fits before you try it. Nobody follows you around.",
      scene: <RackScene product={tagged} />,
    },
    {
      id: "fitting",
      at: [62, 64],
      zone: "fitting",
      kicker: "Fitting rooms",
      title: "Try it on.",
      body: "Take a numbered token for the pieces you bring in. The helper counts them out again. Take as long as you like.",
      scene: <FittingScene />,
    },
    {
      id: "helper",
      at: [126, 148],
      zone: "floor",
      kicker: "On the floor",
      title: "Need a hand?",
      body: "One helper is on the floor the whole time. Another size, a second opinion, where the kiosk is: just wave.",
      scene: <HelperScene />,
    },
    {
      id: "kiosk",
      at: [183, 54],
      zone: "kiosk",
      kicker: "Self-checkout",
      title: "Pay it.",
      body: "Drop your pieces in the kiosk's tray. It lists them and shows a QR. Scan with eSewa. No queue, no bargaining.",
      scene: <KioskScene />,
    },
    {
      id: "counter",
      at: [190, 166],
      zone: "counter",
      kicker: "Pickup counter",
      title: "Ordered online?",
      body: "Your bag is waiting at the counter. Show your order number or the SMS. Pickup is free.",
      scene: <CounterScene />,
    },
    {
      id: "exit",
      at: [190, 298],
      zone: "exit",
      kicker: "The way out",
      title: "Wear it.",
      body: "Your bill comes by SMS. Walk out. That's the whole thing.",
      scene: <ExitScene />,
    },
  ];

  return (
    <div className="container-ep pb-24">
      <section className="pb-6 pt-12 md:pt-20">
        <p className="index text-steel-dark">
          <Link href="/visit" className="hover:underline">
            Visit us
          </Link>{" "}
          / Virtual tour
        </p>
        <h1 className="display display-h1 mt-3">Walk the store.</h1>
        <p className="mt-4 max-w-[46ch] text-lg text-steel-dark md:text-xl">
          Scroll to walk through Easypick, door to door, before you come. It takes about a minute.
        </p>
        <p className="mt-2 text-[13px] text-steel-dark">Drawn from the store plan. Photos come once the store is fitted out.</p>
      </section>

      <StoreTour stops={stops} />

      <section className="mt-10 border-t border-mist pt-12 text-center">
        <h2 className="display display-h2">{info.opened ? "See you soon." : "Opening soon."}</h2>
        <p className="mx-auto mt-3 max-w-[40ch] text-steel-dark">
          {info.opened ? "Directions, hours and how to get there are on the Visit page." : "Join the opening list on the Visit page and we'll tell you when the shutter goes up."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/visit" className="btn btn-volt">
            {info.opened ? "Directions and hours" : "Join the opening list"}
          </Link>
          <Link href="/shop" className="btn btn-outline">
            Shop online
          </Link>
        </div>
      </section>
    </div>
  );
}
