import type { Metadata } from "next";

import { allProducts, festivals } from "@/lib/catalogue";
import { inOffer } from "@/lib/offer-rules";
import { getOffersForAdmin } from "@/lib/offers";
import { requireOwner } from "@/lib/staff";
import { FestivalForm } from "./festival-form";
import { OffersForm } from "./offers-form";

export const metadata: Metadata = { title: "Festivals" };
export const dynamic = "force-dynamic";

export default async function AdminFestivals() {
  await requireOwner();
  const [list, offers, products] = await Promise.all([festivals(), getOffersForAdmin(), allProducts()]);
  const counts = Object.fromEntries(offers.map((o) => [o.id, products.filter((p) => inOffer(o, p)).length]));
  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]">Selling</p>
        <h1 className="mt-1 text-[40px] font-light leading-none tracking-[-0.02em]">Festivals & offers</h1>
      </div>

      <section aria-labelledby="offers-h" className="rounded-[24px] bg-[#f4f4f2] p-5 md:p-6">
        <h2 id="offers-h" className="text-[17px] font-semibold">
          Festival offers
        </h2>
        <p className="mt-1 max-w-2xl text-[14px] text-steel-dark">
          Up to three named sales, each with its own card on the home page and shop. An offer only gathers pieces that already have a sale price: set the sale
          price on the piece, and tick the offer there too when the offer uses ticks.
        </p>
        <div className="mt-5">
          <OffersForm initial={offers} counts={counts} />
        </div>
      </section>

      <section aria-labelledby="fest-h" className="rounded-[24px] bg-[#f4f4f2] p-5 md:p-6">
        <h2 id="fest-h" className="text-[17px] font-semibold">
          Festival dates
        </h2>
        <p className="mt-1 max-w-2xl text-[14px] text-steel-dark">
          For the banner on the site: &ldquo;Order by … for delivery before …&rdquo;. It shows from three weeks before the order-by day. Check each year&apos;s dates
          against the official calendar.
        </p>
        <FestivalForm initial={list} />
      </section>
    </div>
  );
}
