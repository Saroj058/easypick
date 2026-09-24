import type { Metadata } from "next";

import { PageIntro } from "@/components/page-intro";
import { TrackForm } from "./track-form";

export const metadata: Metadata = { title: "Track an order", robots: { index: false } };

export default function TrackPage() {
  return (
    <div className="container-ep max-w-xl pb-24">
      <PageIntro title="Track an order." lead="No account needed. Use the order number on your receipt and the phone you ordered with." />
      <TrackForm />
    </div>
  );
}
