import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of sale", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  const { company, store } = site;
  return (
    <LegalPage title="Terms of sale" lead="The short version: the price you see is the price you pay." updated="Sep 2026">
      <h2>Who you&apos;re buying from</h2>
      <p>
        {company.legalName}
        {company.panVat ? `, PAN/VAT ${company.panVat}` : ""}
        {store.address ? `, ${store.address}` : `, ${store.area}`}.
      </p>
      <h2>Prices</h2>
      <p>All prices are in Nepali rupees and include VAT. Prices are the same online and in store.</p>
      <h2>Stock</h2>
      <p>
        Stock shown online is live from our store system. Your items are held for 15 minutes while you pay. If an item sells out before
        your payment is confirmed, we&apos;ll refund you in full.
      </p>
      <h2>Payment</h2>
      <p>
        Your order is confirmed only once eSewa confirms the payment directly with us. A screenshot or redirect page
        is not a confirmation.
      </p>
      <h2>Cancellations</h2>
      <p>You can cancel a paid order any time before it&apos;s picked up or leaves with the rider. We refund to the wallet you paid with.</p>
      <h2>Returns</h2>
      <p>See our returns and exchanges policy.</p>
    </LegalPage>
  );
}
