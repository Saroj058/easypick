import type { Metadata } from "next";

import { helperQueue } from "@/lib/helper-counts";
import { requireStaff } from "@/lib/staff";
import { atCounter, onTheWay, Section, toHandOver, toPack } from "./queue";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function HelperOrders() {
  await requireStaff("/helper/login");
  // Only orders still being handled, oldest first.
  const orders = await helperQueue();
  const giftsWaiting = orders.filter((o) => o.status === "paid" && o.gift?.mode === "pick" && (o.gift.status === "sent" || o.gift.status === "opened")).length;

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <Section id="pack" title="To pack" hint="Oldest first. Take the pieces off the rack, then tap Mark packed." orders={orders.filter(toPack)} />
      <Section id="handover" title="Packed" hint="Put pickups at the counter; hand deliveries to the rider." orders={orders.filter(toHandOver)} />
      <Section id="counter" title="Waiting at the counter" orders={orders.filter(atCounter)} />
      <Section id="road" title="Out for delivery" orders={orders.filter(onTheWay)} />
      {giftsWaiting > 0 && (
        <p className="text-[14px] text-steel-dark">
          {giftsWaiting} {giftsWaiting === 1 ? "gift is" : "gifts are"} waiting for the receiver to pick a size. They show up under To pack once chosen.
        </p>
      )}
    </div>
  );
}
