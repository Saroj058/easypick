import type { Metadata } from "next";
import { ChevronDown, ChevronRight, Gift, Package } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut, signOutEverywhere } from "@/app/auth-actions";
import { AskWhatsApp } from "@/components/ask-whatsapp";
import { Countdown } from "@/components/countdown";
import { DropStrip } from "@/components/drop-strip";
import { FitFinder } from "@/components/fit-finder";
import { toRailPiece } from "@/components/home/rail";
import { ProductImage } from "@/components/product-image";
import { ProfileForm } from "@/components/profile-form";
import { giftStage, giftsSent, nowOrder, orderStage, pastOrders, picksFor, usualSize } from "@/lib/account-view";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { maskCode } from "@/lib/gift-cards";
import { ordersFor, type Order } from "@/lib/orders";
import { site } from "@/lib/site";
import { currentStaff } from "@/lib/staff";
import { getDropTimeline, getProducts } from "@/lib/store";
import type { Product } from "@/lib/types";
import { walletFor } from "@/lib/wallet";
import { WalletForm } from "./wallet-form";

// The signed-in dashboard, planned with ten reviewers (owner, 15 Oct 2026). One calm page:
// what needs them now first, then orders and gifts, then a quiet side column for gift cards, size,
// details, the next drop and sign-in. Saved values show as one line; forms open only on "Edit".
// Only small, purpose-made values reach the page: never gift tokens, addresses or full card codes.

export const metadata: Metadata = { title: "Account", robots: { index: false } };
export const dynamic = "force-dynamic";

const card = "rounded-2xl border border-ink/10 bg-paper p-5 md:p-6";
const side = "rounded-[24px] bg-mist/50 p-5 md:p-6";
const title = "text-[13px] font-semibold uppercase tracking-[0.08em] text-steel-dark";
const primary = "inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-[14px] font-semibold text-paper transition-[background-color,scale] hover:bg-[#222] active:scale-[0.98]";
const secondary = "inline-flex h-11 items-center justify-center rounded-full border border-ink/25 px-5 text-[14px] font-semibold hover:border-ink";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short" });
const masked = (p: string) => `${p.slice(0, 3)}•••${p.slice(-3)}`;

function Chip({ label, act, quiet = false }: { label: string; act?: boolean; quiet?: boolean }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold ${quiet ? "border border-ink/10 text-steel-dark" : "bg-mist"}`}>
      {!quiet && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${act ? "bg-volt ring-1 ring-ink/30" : "bg-ink"}`} />}
      {label}
    </span>
  );
}

/** "Edit" that opens the form in place (native disclosure: keyboard and screen readers for free). */
function Edit({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group mt-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[13.5px] font-semibold [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

function Thumb({ product, colour }: { product?: Product; colour: string }) {
  return (
    <span className="relative block h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-[#efefef]">
      {product && (
        <span className="absolute inset-x-0 -top-[4%] block">
          <ProductImage image={product.images[0] ?? { src: null, alt: product.name, kind: "front" }} category={product.category} colourHex={product.colours.find((c) => c.name === colour)?.hex ?? product.colours[0].hex} decorative sizes="48px" />
        </span>
      )}
    </span>
  );
}

function OrderRow({ o, products }: { o: Order; products: Map<string, Product> }) {
  const st = orderStage(o);
  const first = o.lines[0];
  const names = o.lines.map((l) => (l.size === "ONE" ? l.name : `${l.name} (${l.size})`)).join(", ");
  return (
    <li>
      <Link href={`/order/${o.id}`} aria-label={`Order ${o.number}, ${st.label}, ${formatPrice(o.total)}`} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-mist/40">
        <span className="relative">
          <Thumb product={products.get(first.slug)} colour={first.colour} />
          {o.lines.length > 1 && <span className="absolute -bottom-1 -right-1 rounded-full bg-ink px-1.5 font-mono text-[10px] text-paper">+{o.lines.length - 1}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold leading-snug">{names}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-steel-dark">
            <span className="font-mono">{o.number}</span>· {day.format(new Date(o.createdAt))}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[14px] font-semibold tabular-nums">{formatPrice(o.total)}</span>
          <Chip label={st.label} act={st.act} quiet={o.status === "cancelled" || o.status === "expired"} />
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-steel-dark" />
      </Link>
    </li>
  );
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [orders, wallet, products, timeline, staff] = await Promise.all([ordersFor(user.id, user.phone), walletFor(user.id), getProducts(), getDropTimeline(), currentStaff()]);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const now = nowOrder(orders);
  const past = pastOrders(orders, now?.id);
  const gifts = giftsSent(orders);
  const picks = picksFor(products, orders).map(toRailPiece);
  const size = usualSize(orders);
  const usable = wallet.filter((c) => c.usable);
  const toSpend = usable.reduce((n, c) => n + c.balance, 0);
  const first = user.name?.split(" ")[0];
  const fit = user.fit;
  const fitLine = fit && (fit.chest || fit.waist) ? [fit.chest && `Chest ${fit.chest}`, fit.length && `Length ${fit.length}`, fit.waist && `Waist ${fit.waist}`].filter(Boolean).join(" · ") + " cm" : null;
  const ship = user.checkout;
  const shipLine = ship?.method === "delivery" && ship.address ? `Delivery · ${ship.address.area}` : ship?.method === "pickup" ? "Store pickup" : null;
  const phone = user.phone ?? user.contactPhone ?? null;

  return (
    <div className="container-ep pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)] pt-8 md:pt-12 lg:pb-24">
      {/* Who */}
      <header className="flex items-center gap-4">
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mist text-lg font-semibold">
          {(first?.[0] ?? "E").toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="display text-[36px] leading-none md:text-[56px]">{first ? `Namaste, ${first}.` : "Your account."}</h1>
          {phone && (
            <p className="mt-1.5 text-[14px] text-steel-dark">
              <span aria-label={`Phone ending ${phone.slice(-3)}`}>{masked(phone)}</span>
              {size ? ` · usually size ${size}` : ""}
            </p>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
        <div className="space-y-6">
          {/* Now: the one order that needs them, with one action */}
          {now && (
            <section aria-labelledby="now-h" className={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="now-h" className={title}>
                  Right now
                </h2>
                <Chip label={orderStage(now).label} act={orderStage(now).act} />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex -space-x-3">
                  {now.lines.slice(0, 3).map((l) => (
                    <span key={l.sku} className="rounded-xl ring-2 ring-paper">
                      <Thumb product={bySlug.get(l.slug)} colour={l.colour} />
                    </span>
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{now.lines.map((l) => l.name).join(", ")}</p>
                  <p className="text-[13.5px] text-steel-dark">
                    <span className="font-mono">{now.number}</span> · {formatPrice(now.total)} · {now.method === "pickup" ? "Store pickup" : "Delivery"}
                  </p>
                </div>
              </div>
              <div className="mt-5">
                {now.status === "awaiting_payment" ? (
                  <Link href={`/pay/${now.id}`} className={primary}>
                    Pay {formatPrice(now.total)}
                  </Link>
                ) : (
                  <Link href={`/order/${now.id}`} className={primary}>
                    {now.status === "ready_for_pickup" ? "Show pickup code" : "Track it"}
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* Orders */}
          <section aria-labelledby="orders-h" className={card}>
            <h2 id="orders-h" className={title}>
              Orders
            </h2>
            {past.length === 0 && !now ? (
              <div className="mt-4">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-mist">
                  <Package aria-hidden className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <p className="mt-4 font-semibold">No orders yet.</p>
                <p className="mt-1 text-[14px] text-steel-dark">Online orders and kiosk bills paid with your number show up here.</p>
                <Link href="/drops" className={`${secondary} mt-5`}>
                  See the drop
                </Link>
              </div>
            ) : past.length === 0 ? (
              <p className="mt-3 text-[14px] text-steel-dark">Only the one above, for now.</p>
            ) : (
              <>
                <ul className="-mx-2 mt-3 divide-y divide-ink/[0.06]">
                  {past.slice(0, 3).map((o) => (
                    <OrderRow key={o.id} o={o} products={bySlug} />
                  ))}
                </ul>
                {past.length > 3 && (
                  <details className="group">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[13.5px] font-semibold [&::-webkit-details-marker]:hidden">
                      All orders ({past.length})
                      <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="-mx-2 divide-y divide-ink/[0.06]">
                      {past.slice(3).map((o) => (
                        <OrderRow key={o.id} o={o} products={bySlug} />
                      ))}
                    </ul>
                  </details>
                )}
                <p className="mt-2 text-[13px] text-steel-dark">
                  Wrong size? Swap it within 7 days.{" "}
                  <AskWhatsApp text="Hi Easypick, I'd like to swap a size on my order: " label="Ask us" className="inline-flex" />
                </p>
              </>
            )}
          </section>

          {/* Gifts they sent */}
          {gifts.length > 0 && (
            <section aria-labelledby="gifts-h" className={card}>
              <h2 id="gifts-h" className={title}>
                Gifts you sent
              </h2>
              <ul className="-mx-2 mt-3 divide-y divide-ink/[0.06]">
                {gifts.slice(0, 5).map((o) => (
                  <li key={o.id}>
                    <Link href={`/order/${o.id}`} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-mist/40">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mist">
                        <Gift aria-hidden className="h-5 w-5" strokeWidth={1.6} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          For {o.gift!.receiverName.split(" ")[0]} · {o.lines.length > 1 ? `${o.lines.length} pieces` : o.lines[0].name}
                        </span>
                        <span className="text-[13px] text-steel-dark">{day.format(new Date(o.createdAt))}</span>
                      </span>
                      <Chip label={giftStage(o)} act={o.gift!.status === "sent" || o.gift!.status === "opened"} />
                      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-steel-dark" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/gift" className="mt-2 inline-flex min-h-11 items-center text-[13.5px] font-semibold underline-offset-4 hover:underline">
                Send another gift →
              </Link>
            </section>
          )}
        </div>

        {/* The quiet side column */}
        <aside className="space-y-6" aria-label="Your account">
          <section aria-labelledby="wallet-h" className={side}>
            <h2 id="wallet-h" className={title}>
              Gift cards
            </h2>
            <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{toSpend > 0 ? formatPrice(toSpend) : "Rs 0"}</p>
            <p className="text-[13px] text-steel-dark">{toSpend > 0 ? "to spend, used at checkout by itself" : "Save a card and it pays at checkout by itself."}</p>
            {usable.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {usable.map((c) => (
                  <li key={c.code.slice(-4)} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="font-mono">{maskCode(c.code)}</span>
                    <span className="text-steel-dark">
                      {formatPrice(c.balance)} · ends {day.format(new Date(c.expiresAt))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Edit label="Add a gift card">
              <WalletForm />
            </Edit>
          </section>

          <section aria-labelledby="size-h" className={side}>
            <h2 id="size-h" className={title}>
              Your size
            </h2>
            <p className="mt-3 text-[15px] font-medium">{fitLine ?? "Not saved yet"}</p>
            <p className="text-[13px] text-steel-dark">{fitLine ? "Every piece marks the size that fits you." : "Measure a top you love, once."}</p>
            <Edit label={fitLine ? "Edit" : "Add my size"}>
              <FitFinder compact />
            </Edit>
          </section>

          <section aria-labelledby="details-h" className={side}>
            <h2 id="details-h" className={title}>
              My details
            </h2>
            <dl className="mt-3 space-y-1.5 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-steel-dark">Name</dt>
                <dd className="truncate">{user.name ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-steel-dark">Email</dt>
                <dd className="truncate">{user.email ?? "Not added"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-steel-dark">Orders reach me</dt>
                <dd className="truncate">{shipLine ?? "Not chosen"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-steel-dark">Drop-day message</dt>
                <dd>{user.alerts ? "On" : "Off"}</dd>
              </div>
            </dl>
            <Edit label="Edit">
              <ProfileForm mode="edit" user={{ name: user.name, email: user.email, alerts: user.alerts, phone: user.phone, contactPhone: user.contactPhone ?? null, checkout: user.checkout ?? null }} />
            </Edit>
          </section>

          {timeline.next && (
            <section aria-labelledby="drop-h" className={side}>
              <h2 id="drop-h" className={title}>
                Next drop
              </h2>
              <p className="mt-3 font-semibold">{timeline.next.name}</p>
              <div className="mt-1">
                <Countdown to={timeline.next.releaseAt} label={timeline.next.name} size="sm" />
              </div>
              <Link href="/drops" className="mt-2 inline-flex min-h-11 items-center text-[13.5px] font-semibold underline-offset-4 hover:underline">
                See what&apos;s coming →
              </Link>
            </section>
          )}

          <section aria-labelledby="signin-h" className={side}>
            <h2 id="signin-h" className={title}>
              Sign-in
            </h2>
            <dl className="mt-3 space-y-1.5 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-steel-dark">Phone code</dt>
                <dd>
                  {user.phone ? (
                    <span className="font-mono">{masked(user.phone)}</span>
                  ) : (
                    <Link href="/login?add=phone&next=/account" className="font-semibold underline underline-offset-4">
                      {user.contactPhone ? "Verify to log in" : "Add phone"}
                    </Link>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-steel-dark">Google</dt>
                <dd>{user.googleId ? "Connected" : "Not connected"}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {staff && (
                <Link href="/admin" className={primary}>
                  Admin
                </Link>
              )}
              <form action={signOut}>
                <button type="submit" className={`${secondary} cursor-pointer`}>
                  Sign out
                </button>
              </form>
              <form action={signOutEverywhere}>
                <button type="submit" className="min-h-11 cursor-pointer text-[13px] font-semibold underline-offset-4 hover:underline">
                  Sign out everywhere
                </button>
              </form>
            </div>
            <p className="mt-4 border-t border-ink/10 pt-4 text-[12.5px] leading-relaxed text-steel-dark">
              We keep your name, contact, address, orders and size, and never sell them.{" "}
              <Link href="/privacy" className="underline underline-offset-2">
                Privacy
              </Link>
              .
            </p>
            <AskWhatsApp text={`Hi Easypick, please delete my account${phone ? ` (phone ending ${phone.slice(-3)})` : ""}.`} label="Want your data deleted? Ask us" className="mt-1" />
          </section>
        </aside>
      </div>

      {/* Picked for them: in their usual size, not bought before */}
      {picks.length > 0 && (
        <section aria-labelledby="picks-h" className="mt-14 overflow-x-clip md:mt-20">
          <div className="flex items-end justify-between gap-4">
            <h2 id="picks-h" className="display text-[clamp(2rem,1.6rem+2vw,3rem)] leading-[0.9]">
              Picked for you
            </h2>
            <Link href="/shop" className="inline-flex min-h-11 items-center text-[13.5px] font-semibold underline-offset-4 hover:underline">
              Shop all →
            </Link>
          </div>
          <DropStrip pieces={picks} label="Picked for you" tags />
        </section>
      )}
    </div>
  );
}
