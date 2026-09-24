import type { Metadata } from "next";

import { GiftCardForm } from "@/components/gift-card-form";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = {
  title: "Gift cards",
  description: "Send an Easypick gift card by SMS. From Rs 500, used online or in store, valid for 12 months.",
  alternates: { canonical: "/gift-cards" },
};

export default function GiftCardsPage() {
  return (
    <>
      <PageIntro title="Gift card." lead="They choose what they love. Sent by SMS, used online or in store, valid for 12 months." />
      <div className="container-ep max-w-2xl pb-24">
        <GiftCardForm />
      </div>
    </>
  );
}
