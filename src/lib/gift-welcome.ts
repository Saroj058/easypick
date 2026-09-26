import "server-only";

import { sql } from "drizzle-orm";

import { schema, type Tx } from "./db";
import { issueGiftCard, type GiftCard } from "./gift-cards";
import type { GiftInfo } from "./orders";
import { site } from "./site";

// The receiver's welcome credit is for someone new to Easypick: one per email or phone,
// ever, and only when that contact has never ordered. Otherwise anyone could send
// themselves cheap gifts and collect credits.

/** Issues the welcome credit inside the gift's transaction, or returns null when they don't qualify. */
export async function issueWelcomeCredit(tx: Tx, g: GiftInfo, buyerPhone: string, orderId: string): Promise<GiftCard | null> {
  const email = g.receiverEmail?.trim().toLowerCase() || null;
  const phone = g.receiverPhone || null;
  if (!email && !phone) return null;
  if (phone && phone === buyerPhone) return null;

  // Two gifts to the same person chosen at the same moment wait for each other here.
  const keys = [email && `welcome:e:${email}`, phone && `welcome:p:${phone}`].filter((k): k is string => Boolean(k)).sort();
  for (const k of keys) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${k}))`);

  const c = schema.giftCards.data;
  const sameContact = sql`(${email ? sql`lower(${c}->>'recipientEmail') = ${email}` : sql`false`} or ${phone ? sql`${c}->>'recipientPhone' = ${phone}` : sql`false`})`;
  // Older welcome cards have no kind, only their fixed message.
  const hadWelcome = (await tx.execute(
    sql`select 1 from ${schema.giftCards} where (${c}->>'kind' = 'welcome' or (${c}->>'message' = 'Welcome to Easypick' and ${c}->>'orderId' is null)) and ${sameContact} limit 1`,
  )) as unknown as unknown[];
  if (hadWelcome.length) return null;

  const o = schema.orders;
  const u = schema.users;
  const ownOrders = (await tx.execute(sql`
    select 1 from ${o} left join ${u} on ${u.id} = ${o.userId}
    where ${o.status} not in ('awaiting_payment', 'expired')
      and (${phone ? sql`${o.phone} = ${phone} or ${u.phone} = ${phone}` : sql`false`}
           or ${email ? sql`lower(${u.email}) = ${email}` : sql`false`})
    limit 1`)) as unknown as unknown[];
  if (ownOrders.length) return null;

  return issueGiftCard(
    {
      value: site.gifting.welcomeCredit,
      status: "active",
      purchaserPhone: buyerPhone,
      recipientName: g.receiverName,
      recipientPhone: phone,
      recipientEmail: email,
      message: "Welcome to Easypick",
      senderName: null,
      sendOn: null,
      // The gift that earned it, so staff (and a refund) can find it.
      orderId,
      kind: "welcome",
    },
    site.gifting.welcomeCreditDays,
    tx,
  );
}
