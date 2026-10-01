import "server-only";

import { randomBytes } from "node:crypto";

import { and, eq, isNull, ne, or } from "drizzle-orm";

import { getDb, schema } from "./db";
import { giftEmailHtml, sendEmail } from "./email";
import { formatDropTime } from "./format";
import { site } from "./site";
import { getDrops } from "./store";
import type { Drop } from "./types";
import { dropTemplateConfigured, sendWhatsAppDrop } from "./whatsapp";

// Drop alerts: one message on drop day to everyone who asked, on WhatsApp or by email.
// Sign-ups are kept with the time they agreed, and every message carries a link to stop.

export type AlertChannel = "whatsapp" | "email";

/** Saves (or re-opens) a sign-up. Returns the secret for its stop link. */
export async function subscribeToDrops(channel: AlertChannel, contact: string, source: string | null): Promise<string> {
  const db = await getDb();
  const token = randomBytes(24).toString("base64url");
  const now = new Date().toISOString();
  const [row] = await db
    .insert(schema.dropAlertSubscribers)
    .values({ channel, contact, source, token, consentAt: now })
    // Signing up again after stopping counts as agreeing again.
    .onConflictDoUpdate({
      target: [schema.dropAlertSubscribers.channel, schema.dropAlertSubscribers.contact],
      set: { unsubscribedAt: null, consentAt: now },
    })
    .returning({ token: schema.dropAlertSubscribers.token });
  return row.token;
}

/** Stops messages for the sign-up behind a stop link. True when the link matched one. */
export async function unsubscribeFromDrops(token: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(schema.dropAlertSubscribers)
    .set({ unsubscribedAt: new Date().toISOString() })
    .where(eq(schema.dropAlertSubscribers.token, token))
    .returning({ id: schema.dropAlertSubscribers.id });
  return rows.length > 0;
}

export async function dropAlertCounts() {
  const db = await getDb();
  const rows = await db
    .select({ channel: schema.dropAlertSubscribers.channel })
    .from(schema.dropAlertSubscribers)
    .where(isNull(schema.dropAlertSubscribers.unsubscribedAt));
  return { whatsapp: rows.filter((r) => r.channel === "whatsapp").length, email: rows.filter((r) => r.channel === "email").length };
}

/** The drop that goes live in the next few hours, if any. */
export function dropDueSoon(drops: Drop[], now = Date.now(), withinMs = 4 * 60 * 60_000): Drop | null {
  return (
    drops
      .filter((d) => Date.parse(d.releaseAt) > now && Date.parse(d.releaseAt) - now <= withinMs)
      .sort((a, b) => Date.parse(a.releaseAt) - Date.parse(b.releaseAt))[0] ?? null
  );
}

const stopUrl = (token: string) => `${site.url}/alerts/stop?t=${token}`;

async function emailDrop(to: string, drop: Drop, token: string) {
  const when = formatDropTime(drop.releaseAt);
  const url = `${site.url}/drop/${drop.slug}?utm_source=drop-alert&utm_medium=email`;
  const subject = `${drop.name} is out today, ${when.split(",").pop()?.trim() ?? "6 PM"}`;
  const html = giftEmailHtml({
    preheader: `${drop.pieceCount} pieces. Prices on every tag.`,
    heading: `${drop.name} is out today.`,
    intro: `${when}. ${drop.pieceCount} pieces, prices on every tag. Pick your size now so it takes seconds when it opens.`,
    button: { label: `See ${drop.name}`, url },
    small: `You asked for one message before each drop. Stop these: ${stopUrl(token)}`,
  });
  await sendEmail(to, subject, html, `${drop.name} is out today, ${when}.\n${url}\n\nStop these messages: ${stopUrl(token)}`);
}

/**
 * Sends the drop-day message for a drop that opens within a few hours. Safe to run more than
 * once: each sign-up is marked with the drop it was told about. Time-boxed for a cron run.
 */
export async function sendDueDropAlerts(now = Date.now(), budgetMs = 45_000) {
  const drop = dropDueSoon(await getDrops(), now);
  if (!drop) return { drop: null, sent: 0, failed: 0, waiting: 0 };

  const db = await getDb();
  const t = schema.dropAlertSubscribers;
  const due = await db
    .select()
    .from(t)
    .where(and(isNull(t.unsubscribedAt), or(isNull(t.lastDropSent), ne(t.lastDropSent, drop.slug))));

  const canWhatsApp = dropTemplateConfigured();
  const started = Date.now();
  let sent = 0;
  let failed = 0;
  let waiting = 0;
  for (const s of due) {
    if (Date.now() - started > budgetMs) {
      waiting++;
      continue;
    }
    // WhatsApp needs Meta's approved drop template; until it's set, those sign-ups wait.
    if (s.channel === "whatsapp" && !canWhatsApp) {
      waiting++;
      continue;
    }
    try {
      if (s.channel === "email") await emailDrop(s.contact, drop, s.token);
      else await sendWhatsAppDrop(s.contact, drop.name, formatDropTime(drop.releaseAt), `${drop.slug}?utm_source=drop-alert&utm_medium=whatsapp`);
      await db.update(t).set({ lastDropSent: drop.slug }).where(eq(t.id, s.id));
      sent++;
    } catch (e) {
      console.error("[drop alerts] send failed", s.channel, e instanceof Error ? e.message : e);
      failed++;
    }
  }
  return { drop: drop.slug, sent, failed, waiting, whatsappReady: canWhatsApp };
}

/**
 * The account page's "message me on drop days" tick. On: signs up their email (or their
 * WhatsApp number when there's no email). Off: stops any sign-up under either.
 */
export async function syncAccountAlerts(on: boolean, email: string | null, phone: string | null) {
  const db = await getDb();
  const t = schema.dropAlertSubscribers;
  if (on) {
    if (email) await subscribeToDrops("email", email, "account");
    else if (phone) await subscribeToDrops("whatsapp", phone, "account");
    return;
  }
  const now = new Date().toISOString();
  if (email) await db.update(t).set({ unsubscribedAt: now }).where(and(eq(t.channel, "email"), eq(t.contact, email)));
  if (phone) await db.update(t).set({ unsubscribedAt: now }).where(and(eq(t.channel, "whatsapp"), eq(t.contact, phone)));
}
