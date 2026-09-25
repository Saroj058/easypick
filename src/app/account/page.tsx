import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth-actions";
import { FitFinder } from "@/components/fit-finder";
import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { ordersFor } from "@/lib/orders";
import { site } from "@/lib/site";
import { currentStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

const statusLabel = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  expired: "Expired",
} as const;

function Section({ id, index, title, children }: { id: string; index: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} data-index={index} className="border-t border-mist pt-6">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const orders = await ordersFor(user.id, user.phone);
  const first = user.name?.split(" ")[0];
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="container-ep pb-24 pt-10 md:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display display-h1">{first ? `Namaste, ${first}.` : "Your account."}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {(await currentStaff()) && (
            <Link href="/admin" className="btn btn-ink">
              Admin
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className="btn btn-outline">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="mt-12 grid gap-16 lg:grid-cols-12">
        <div className="space-y-16 lg:col-span-7">
          <Section id="orders-title" index="01" title="Your orders">
            {orders.length === 0 ? (
              <div className="bg-photo p-6">
                <p>No orders yet. Online orders and kiosk bills paid with this number show up here.</p>
                <Link href="/drops" className="btn btn-ink mt-5">
                  See the drop
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-mist border-y border-mist">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/order/${o.id}`} className="group flex items-center justify-between gap-4 py-4">
                      <span className="min-w-0">
                        <span className="block font-mono text-[13px] text-steel-dark">
                          {o.number} · {fmt.format(new Date(o.createdAt))}
                        </span>
                        <span className="block truncate font-semibold group-hover:underline">
                          {o.lines.map((l) => l.name).join(", ")}
                        </span>
                        <span className="block text-[13px] text-steel-dark">
                          {statusLabel[o.status]} · {o.method === "pickup" ? "Store pickup" : "Delivery"}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono tabular-nums">{formatPrice(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="fit-title" index="02" title="Your size in cm">
            <p className="-mt-2 mb-6 max-w-[52ch] text-steel-dark">Saved to your account, so every phone you sign in on marks your size.</p>
            <FitFinder />
          </Section>
        </div>

        <div className="space-y-16 lg:col-span-4 lg:col-start-9">
          <Section id="profile-title" index="03" title="Details">
            <ProfileForm mode="edit" user={{ name: user.name, email: user.email, alerts: user.alerts, phone: user.phone, contactPhone: user.contactPhone ?? null }} />
          </Section>

          <Section id="signin-title" index="04" title="Sign-in methods">
            <ul className="space-y-3 text-[15px]">
              <li className="flex items-center justify-between gap-4">
                <span>Phone code (WhatsApp / SMS)</span>
                {user.phone ? (
                  <span className="font-mono">
                    {user.phone.slice(0, 3)}•••{user.phone.slice(-3)}
                  </span>
                ) : (
                  <Link href="/login?add=phone&next=/account" className="min-h-11 content-center font-semibold underline underline-offset-2">
                    {user.contactPhone ? "Verify to log in" : "Add phone"}
                  </Link>
                )}
              </li>
              <li className="flex items-center justify-between gap-4">
                <span>Google</span>
                <span className="text-steel-dark">{user.googleId ? "Connected" : "Not connected"}</span>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span>Facebook</span>
                <span className="text-steel-dark">{user.facebookId ? "Connected" : "Not connected"}</span>
              </li>
            </ul>
            {!user.phone && (
              <p className="mt-4 text-[13px] text-steel-dark">
                {user.contactPhone
                  ? "Your number is saved for order updates. Verify it with a code to log in with it and link kiosk bills."
                  : "Add your phone to get order SMS and to link kiosk bills to your account."}
              </p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
