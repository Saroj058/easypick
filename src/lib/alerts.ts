import "server-only";

import { notifyEmail } from "./notify";

// Messages to the Easypick team: new paid orders, and anything that needs a person
// (paid after the hold ended, amount mismatch, server errors). Goes to STAFF_ALERT_EMAIL,
// or the shop's Gmail. Never throws; returns whether the email went out.

export async function alertStaff(subject: string, text: string): Promise<boolean> {
  try {
    const to = process.env.STAFF_ALERT_EMAIL?.trim() || process.env.GMAIL_USER?.trim();
    if (!to) {
      // Nowhere to send it: the server log is the only record, so make it stand out in production.
      (process.env.NODE_ENV === "production" ? console.error : console.info)(`[staff alert, no STAFF_ALERT_EMAIL] ${subject}\n${text}`);
      return false;
    }
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;white-space:pre-wrap">${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</div>`;
    const status = await notifyEmail(to, `[Easypick] ${subject}`, html, text);
    if (status === "sent") return true;
    // The alert itself is lost: keep its content in the log so nothing needing a person disappears.
    console.error(`[staff alert NOT SENT] ${subject}\n${text}`);
    return false;
  } catch (e) {
    console.error(`[staff alert NOT SENT] ${subject}\n${text}\n`, e);
    return false;
  }
}
