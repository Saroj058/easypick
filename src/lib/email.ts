import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { site } from "./site";

// Email for gift links and gift cards. Two ways to send, picked in this order:
//
//   Gmail  GMAIL_USER + GMAIL_APP_PASSWORD (a Google "App Password", not your normal password).
//          Reaches any address today. ~500 emails a day. Good for the pilot.
//   Resend RESEND_API_KEY + EMAIL_FROM. Free up to ~3,000 a month. Can only reach other
//          people's addresses once your own domain is verified in Resend; with the test
//          sender (onboarding@resend.dev) it only delivers to your own Resend account email.
//
// Set EMAIL_PROVIDER=gmail or EMAIL_PROVIDER=resend to force one. With neither set up,
// emails are printed to the server log instead of being sent.

type Provider = "gmail" | "resend";

function provider(): Provider | null {
  const gmail = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  const resend = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const forced = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (forced === "gmail" && gmail) return "gmail";
  if (forced === "resend" && resend) return "resend";
  return gmail ? "gmail" : resend ? "resend" : null;
}

export function emailConfigured() {
  return provider() !== null;
}

const g = globalThis as unknown as { __epMailer?: Transporter };
function gmailTransport() {
  g.__epMailer ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") },
    // Never let a slow mail server hold up a customer's page.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return g.__epMailer;
}

export function normaliseEmail(input: string): string | null {
  const e = input.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A calm, on-brand email: headline, optional message quote, one button, small print. */
export function giftEmailHtml(opts: { heading: string; intro: string; quote?: string | null; from?: string | null; button: { label: string; url: string }; extra?: string; small: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f2f2f2;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0a0a0a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:4px">
<tr><td style="background:#0a0a0a;padding:20px 28px;color:#ffffff;font-weight:700;font-size:20px;letter-spacing:-0.01em">easypick</td></tr>
<tr><td style="padding:32px 28px 8px">
<h1 style="margin:0 0 12px;font-size:28px;line-height:1.15">${esc(opts.heading)}</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#3a3a3c">${esc(opts.intro)}</p>
${opts.quote ? `<div style="background:#f2f2f2;padding:20px 22px;margin:0 0 24px;font-size:18px;line-height:1.5">&ldquo;${esc(opts.quote)}&rdquo;<div style="margin-top:10px;font-size:13px;color:#6c6c70">${esc(opts.from ? `From ${opts.from}` : "From someone who thinks of you")}</div></div>` : ""}
${opts.extra ?? ""}
<a href="${esc(opts.button.url)}" style="display:inline-block;background:#c6ff3d;color:#0a0a0a;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.06em;text-transform:uppercase;padding:16px 28px;border-radius:2px">${esc(opts.button.label)}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6c6c70">${esc(opts.small)}</p>
</td></tr>
<tr><td style="padding:24px 28px 28px;font-size:12px;color:#6c6c70">${esc(site.company.legalName)} · ${esc(site.store.area)} · Pick it. Pay it. Wear it.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Sends one email. Throws if the provider refuses it. */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  const via = provider();
  if (!via) {
    console.info(`[email (dev, not sent) → ${to}] ${subject}\n${text}`);
    return;
  }
  if (via === "gmail") {
    try {
      await gmailTransport().sendMail({ from: `${site.name} <${process.env.GMAIL_USER}>`, to, subject, html, text });
    } catch (e) {
      console.error("[email:gmail]", e instanceof Error ? e.message : e); // e.g. wrong App Password
      throw e;
    }
    return;
  }
  const res = await fetch("https://api.resend.com/emails", { signal: AbortSignal.timeout(10_000),
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[email:resend]", res.status, body.slice(0, 300)); // e.g. domain not verified yet
    throw new Error(`email ${res.status}`);
  }
}
