import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Returns and exchanges", alternates: { canonical: "/returns" } };

export default function ReturnsPage() {
  return (
    <LegalPage title="Returns and exchanges" lead="Wrong size? Swap it within 7 days." updated="Sep 2026">
      <h2>Exchanges</h2>
      <p>You can exchange an item for a different size or colour within 7 days of buying it, in store or by rider.</p>
      <ul>
        <li>Tags must still be attached and the item unworn and unwashed.</li>
        <li>Bring your bill (SMS or printed) or the phone number you paid with.</li>
        <li>If the size you want is out, you can take store credit or a refund.</li>
      </ul>
      <h2>Refunds</h2>
      <p>Refunds go back to the wallet you paid with (eSewa, Khalti or Fonepay), usually within 3 working days.</p>
      <h2>What we can&apos;t take back</h2>
      <ul>
        <li>Items bought on sale.</li>
        <li>Items without tags, or that have been worn or washed.</li>
        <li>Anything after 7 days.</li>
      </ul>
      <h2>Something wrong with your item?</h2>
      <p>If an item arrives damaged or has a fault, bring it in or message us and we&apos;ll replace or refund it, even after 7 days.</p>
    </LegalPage>
  );
}
