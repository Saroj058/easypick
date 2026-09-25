import type { Metadata } from "next";
import Link from "next/link";

import { blockGiftCardAction } from "@/app/admin/actions";
import { giftCardList } from "@/lib/admin-data";
import { formatPrice, requestTime } from "@/lib/format";
import { site } from "@/lib/site";
import { requireOwner } from "@/lib/staff";

export const metadata: Metadata = { title: "Gift cards" };
export const dynamic = "force-dynamic";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: site.timezone, day: "numeric", month: "short", year: "numeric" });

export default async function AdminGiftCards({ searchParams }: PageProps<"/admin/gift-cards">) {
  await requireOwner();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 40) : "";
  const cards = await giftCardList(q);
  const now = requestTime();
  const outstanding = cards.filter((c) => c.status === "active" && Date.parse(c.expiresAt) > now).reduce((n, c) => n + c.balance, 0);

  return (
    <div className="max-w-4xl">
      <h2 className="display text-[32px] md:text-[40px]">Gift cards</h2>
      <p className="mt-2 text-steel-dark">Find a card by its code or the buyer&apos;s or receiver&apos;s phone. Block a card that was lost or used without permission.</p>

      <form role="search" action="/admin/gift-cards" className="mt-6 flex max-w-xl gap-2">
        <label htmlFor="g-q" className="sr-only">
          Find a gift card
        </label>
        <input
          id="g-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="EP-XXXX-XXXX or phone"
          className="h-11 min-w-0 flex-1 rounded-[2px] border border-mist bg-paper px-4 text-base outline-none placeholder:text-steel-dark focus:border-ink"
        />
        <button type="submit" className="btn btn-outline">
          Find
        </button>
      </form>
      {!q && cards.length > 0 && <p className="mt-4 text-[14px] text-steel-dark">Newest {cards.length} · {formatPrice(outstanding)} unspent on active cards shown here.</p>}

      {cards.length === 0 ? (
        <p className="mt-10 text-steel-dark">{q ? "No card matches." : "No gift cards yet."}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {cards.map((c) => {
            const expired = Date.parse(c.expiresAt) < now;
            const status = c.status === "blocked" ? "Blocked" : c.status === "pending_payment" ? "Not paid" : expired ? "Expired" : "Active";
            return (
              <li key={c.code} className="border border-mist p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-mono text-[16px] font-semibold">{c.code}</p>
                  <p className={`text-[14px] ${status === "Active" ? "text-[#1f7a3d]" : status === "Blocked" ? "text-[#d70015]" : "text-steel-dark"}`}>{status}</p>
                </div>
                <p className="mt-1 text-[15px]">
                  <span className="font-mono">{formatPrice(c.balance)}</span> left of {formatPrice(c.value)} · expires {day.format(new Date(c.expiresAt))}
                </p>
                <p className="mt-1 text-[14px] text-steel-dark">
                  For {c.recipientName}
                  {c.recipientPhone ? ` (${c.recipientPhone})` : ""} · bought by {c.purchaserPhone || "Easypick"} on {day.format(new Date(c.createdAt))}
                </p>
                {c.uses.length > 0 && (
                  <ul className="mt-2 text-[13px] text-steel-dark">
                    {c.uses.map((u, i) => (
                      <li key={i}>
                        {formatPrice(u.amount)} on {day.format(new Date(u.at))}
                        {u.refunded ? " (given back)" : ""} ·{" "}
                        <Link href={`/admin/orders/${u.orderId}`} className="underline underline-offset-2">
                          order
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {c.status === "active" && !expired && (
                  <form action={blockGiftCardAction} className="mt-2">
                    <input type="hidden" name="code" value={c.code} />
                    <button type="submit" className="min-h-11 text-[14px] text-[#d70015] underline underline-offset-2">
                      Block this card
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
