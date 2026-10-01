import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";

// The facts people ask about before buying, in one line under the rail. ("Price shown. No DM needed." is said in the hero.)

export function DeliveryStrip() {
  return (
    <section aria-label="Delivery and payment" className="border-y border-mist">
      <ul className="container-ep grid grid-cols-2 gap-x-4 gap-y-3 py-5 text-[15px] md:flex md:justify-between">
        <li>
          <b>Delivery {formatPrice(site.delivery.flatFee)}</b> · free over {site.delivery.freeAbove.toLocaleString("en-IN")}
        </li>
        <li>
          <b>Pay with eSewa</b>
        </li>
        <li>
          <Link href="/returns" className="hover:underline">
            <b>7-day size swap</b>
          </Link>
        </li>
        {site.store.whatsapp && (
          <li>
            <a href={`https://wa.me/${site.store.whatsapp}`} target="_blank" rel="noopener" className="hover:underline">
              <b>WhatsApp us</b>
            </a>
          </li>
        )}
      </ul>
    </section>
  );
}
