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

  const lists = [
    { id: "pack", title: "To pack", n: orders.filter(toPack).length },
    { id: "handover", title: "Packed", n: orders.filter(toHandOver).length },
    { id: "counter", title: "At the counter", n: orders.filter(atCounter).length },
    { id: "road", title: "On the road", n: orders.filter(onTheWay).length },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6b6d72]">Today</p>
        <h1 className="mt-1 text-[34px] font-light leading-none tracking-[-0.02em] md:text-[40px]">Orders</h1>
        <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {lists.map((l) => (
            <li key={l.id}>
              <a href={`#${l.id}`} className={`block rounded-[20px] p-3.5 ${l.id === "pack" && l.n > 0 ? "bg-ink text-paper" : "bg-[#f4f4f2] hover:bg-ink/[0.07]"}`}>
                <span className="block font-mono text-[24px] font-semibold leading-none tabular-nums">{l.n}</span>
                <span className={`mt-1.5 block text-[12.5px] ${l.id === "pack" && l.n > 0 ? "text-white/70" : "text-[#55575c]"}`}>{l.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <Section id="pack" title="To pack" hint="Oldest first. Take the pieces off the rack, then tap Mark packed." orders={orders.filter(toPack)} />
      <Section id="handover" title="Packed" hint="Put pickups at the counter; hand deliveries to the rider." orders={orders.filter(toHandOver)} />
      <Section id="counter" title="Waiting at the counter" orders={orders.filter(atCounter)} />
      <Section id="road" title="Out for delivery" orders={orders.filter(onTheWay)} />
      {giftsWaiting > 0 && (
        <p className="text-[14px] text-[#6b6d72]">
          {giftsWaiting} {giftsWaiting === 1 ? "gift is" : "gifts are"} waiting for the receiver to pick a size. They show up under To pack once chosen.
        </p>
      )}
    </div>
  );
}
