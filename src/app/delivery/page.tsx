import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { formatHour, formatPrice } from "@/lib/format";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Delivery and pickup", alternates: { canonical: "/delivery" } };

export default function DeliveryPage() {
  const { delivery, store } = site;
  return (
    <LegalPage title="Delivery and pickup" lead="Pick up free in store, or get it delivered inside the Kathmandu Valley." updated="Sep 2026">
      <h2>Store pickup</h2>
      <p>
        Free. Most orders are ready the same day; we&apos;ll SMS you when yours is. Collect at the helper&apos;s counter between{" "}
        {formatHour(store.hours.open)} and {formatHour(store.hours.close)}. Bring your order number or the SMS.
      </p>
      <p>We hold pickup orders for 3 days.</p>
      <h2>Delivery</h2>
      <ul>
        <li>Kathmandu: our own rider, usually next day.</li>
        <li>Lalitpur and Bhaktapur: local courier, usually 1–2 days.</li>
        <li>
          Flat fee of {formatPrice(delivery.flatFee)}, free on orders over {formatPrice(delivery.freeAbove)}.
        </li>
      </ul>
      <p>We need your area, a nearby landmark and a working phone number so the rider can find you.</p>
      <h2>Payment</h2>
      <p>
        Orders are paid online with eSewa. An order is confirmed only after the payment provider confirms the payment
        with us. Cash on delivery isn&apos;t available yet.
      </p>
      <h2>Outside the Valley</h2>
      <p>Not yet. We&apos;ll announce it on Instagram when we can.</p>
    </LegalPage>
  );
}
