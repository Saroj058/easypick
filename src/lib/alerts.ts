import "server-only";

import { notifyEmail } from "./notify";

// Messages to the Easypick team: new paid orders, and anything that needs a person
// (paid after the hold ended, amount mismatch). Goes to STAFF_ALERT_EMAIL, or the
// shop's Gmail. Never throws.

export async function alertStaff(subject: string, text: string) {
  const to = process.env.STAFF_ALERT_EMAIL?.trim() || process.env.GMAIL_USER?.trim();
  if (!to) {
    console.info(`[staff alert] ${subject}\n${text}`);
    return;
  }
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;white-space:pre-wrap">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</div>`;
  await notifyEmail(to, `[Easypick] ${subject}`, html, text);
}
