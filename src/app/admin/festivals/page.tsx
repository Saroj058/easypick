import type { Metadata } from "next";

import { festivals } from "@/lib/catalogue";
import { FestivalForm } from "./festival-form";

export const metadata: Metadata = { title: "Festivals" };
export const dynamic = "force-dynamic";

export default function AdminFestivals() {
  return (
    <div className="max-w-3xl">
      <p className="text-steel-dark">
        Festival dates for the banner on the site: &ldquo;Order by … for delivery before …&rdquo;. It shows from three weeks before the order-by
        day. Check each year&apos;s dates against the official calendar.
      </p>
      <FestivalForm initial={festivals()} />
    </div>
  );
}
