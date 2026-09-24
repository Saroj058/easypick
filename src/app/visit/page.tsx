import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { VisitCard } from "@/components/visit-card";
import { formatHour } from "@/lib/format";
import { site } from "@/lib/site";
import { getProduct } from "@/lib/store";

export const metadata: Metadata = {
  title: "Visit us",
  description: "Find Easypick in Kathmandu. Opening hours, directions and how to reach our helper on WhatsApp.",
  alternates: { canonical: "/visit" },
};

export default async function VisitPage({ searchParams }: PageProps<"/visit">) {
  const tryParam = (await searchParams).try;
  const tryProduct = typeof tryParam === "string" ? await getProduct(tryParam) : null;

  const { store } = site;
  const storeLd = {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: site.name,
    url: site.url,
    ...(store.address && { address: { "@type": "PostalAddress", streetAddress: store.address, addressLocality: store.area, addressCountry: "NP" } }),
    ...(store.geo && { geo: { "@type": "GeoCoordinates", latitude: store.geo.lat, longitude: store.geo.lng } }),
    ...(store.phone && { telephone: store.phone }),
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: store.hours.open,
      closes: store.hours.close,
    },
    paymentAccepted: "eSewa, Khalti, Fonepay",
    priceRange: "Rs 999 – Rs 3,499",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(storeLd) }} />
      <PageIntro title="Aaunus." lead="Just looking is fine too. Need a hand? Our helper's around." />

      <div className="container-ep grid gap-12 pb-24 pt-6 lg:grid-cols-2">
        <div className="space-y-6">
          {tryProduct && (
            <div className="border-l-4 border-volt bg-photo p-5">
              <p className="font-semibold">Want to try the {tryProduct.name}?</p>
              <p className="mt-1 text-[15px] text-steel-dark">
                It&apos;s on the rack in store. Check live sizes on the{" "}
                <Link href={`/product/${tryProduct.slug}`} className="underline">
                  product page
                </Link>{" "}
                before you come.
              </p>
            </div>
          )}
          <VisitCard />
        </div>

        <div className="space-y-10">
          <div>
            <h2 className="text-sm font-semibold text-steel-dark">Hours</h2>
            <p className="mt-2 font-mono text-lg">
              Every day, {formatHour(store.hours.open)} – {formatHour(store.hours.close)}
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-steel-dark">What to bring</h2>
            <p className="mt-2">Your phone with eSewa, Khalti or Fonepay. That&apos;s all you need to pay.</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-steel-dark">Picking up an online order?</h2>
            <p className="mt-2">Show your order number or SMS at the helper&apos;s counter.</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-steel-dark">First time?</h2>
            <p className="mt-2">
              Read{" "}
              <Link href="/how-it-works" className="underline">
                how it works
              </Link>
              . It takes a minute.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
