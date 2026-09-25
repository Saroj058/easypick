import type { Metadata } from "next";

import { AlertSignup } from "@/components/alert-signup";
import { PageIntro } from "@/components/page-intro";
import { formatDropTime } from "@/lib/format";
import { getDropTimeline } from "@/lib/store";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Drop alerts",
  description: "Get a WhatsApp or SMS message before every new Easypick drop.",
  alternates: { canonical: "/alerts" },
};

export default async function AlertsPage() {
  const { next } = await getDropTimeline();
  return (
    <>
      <PageIntro
        title="Hear first."
        lead={`One message the day before each drop. Nothing else.${next ? ` Next up: ${next.name}, ${formatDropTime(next.releaseAt, { bs: true })}.` : ""}`}
      />
      <div className="container-ep pb-24">
        <AlertSignup source="alerts" />
      </div>
    </>
  );
}
