import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { allDrops, allProducts, festivals } from "@/lib/catalogue";
import { ktmDay } from "@/lib/ktm-day";
import { activeOrders, ordersWithPaymentAttempts } from "@/lib/orders";
import { requireStaff } from "@/lib/staff";
import { effectiveStatus } from "@/lib/store";
import { AdminShell, type Notice } from "./admin-shell";
import { LiveOrders } from "./live-orders";
import { inView } from "./orders/order-bits";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Easypick admin" }, robots: { index: false, follow: false } };

/**
 * The staff frame (owner, 17 Oct 2026: a calm control room): the sidebar with every part of the
 * shop, the top bar with search, the live counts and what's waiting, and the page on a white panel.
 * No shop header, footer or tab bar.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const who = await requireStaff();
  // Helpers have their own, simpler portal.
  if (who.role === "helper") redirect("/helper");

  const [orders, toCheck, products, drops, fests] = await Promise.all([activeOrders(), ordersWithPaymentAttempts(7), allProducts(), allDrops(), festivals()]);
  const toPack = orders.filter((o) => inView(o, "pack")).length;
  const attention = orders.filter((o) => inView(o, "attention")).length;
  const late = orders.filter((o) => inView(o, "late")).length;
  const gifts = orders.filter((o) => inView(o, "gifts")).length;
  const soldOut = products
    .filter((p) => effectiveStatus(p, drops) === "live" || (p.status === "live" && effectiveStatus(p, drops) === "sold_out"))
    .flatMap((p) => p.variants)
    .filter((v) => v.stock === 0).length;
  const today = ktmDay();
  const notices: Notice[] = [
    { label: "Orders that need you", href: "/admin/orders?view=attention", count: attention, urgent: true },
    { label: "Not collected, 5+ days", href: "/admin/orders?view=late", count: late, urgent: true },
    { label: "Payments to check", href: "/admin#pay-check", count: toCheck.length },
    { label: "To pack", href: "/admin/orders?view=pack", count: toPack },
    { label: "Gifts waiting on a size", href: "/admin/orders?view=gifts", count: gifts },
    { label: "Live sizes sold out", href: "/admin#low", count: soldOut },
    { label: "No festival dated ahead", href: "/admin/festivals", count: fests.some((f) => f.date > today) ? 0 : 1 },
  ].filter((n) => n.count > 0);

  return (
    <AdminShell role={who.role} username={who.username} toPack={toPack} attention={attention} notices={notices}>
      <LiveOrders />
      {children}
    </AdminShell>
  );
}
