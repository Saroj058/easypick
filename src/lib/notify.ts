import "server-only";

import { sendEmail } from "./email";
import { sendSms } from "./sms";

// Messages to customers. A failed message never blocks an order or a gift, but it is
// always logged (with the recipient masked) and reported back so callers can record it.

/** "98******12" / "an***@gmail.com": enough to find the order, not the whole number or address. */
export function maskRecipient(to: string): string {
  const at = to.indexOf("@");
  if (at > 0) return `${to.slice(0, Math.min(2, at))}***${to.slice(at)}`;
  return to.length > 4 ? `${to.slice(0, 2)}${"*".repeat(to.length - 4)}${to.slice(-2)}` : "***";
}

function why(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

/** Sends a text. True when it went out (or was printed in development); false when skipped or failed. */
export async function notifySms(phone: string | null | undefined, text: string): Promise<boolean> {
  if (!phone) return false;
  try {
    await sendSms(phone, text);
    return true;
  } catch (e) {
    // Includes "SMS provider not configured" in production, which used to vanish silently.
    console.error(`[notify] sms to ${maskRecipient(phone)} failed: ${why(e)}`);
    return false;
  }
}

export async function notifyEmail(to: string | null | undefined, subject: string, html: string, text: string): Promise<"sent" | "failed" | "skipped"> {
  if (!to) return "skipped";
  try {
    await sendEmail(to, subject, html, text);
    return "sent";
  } catch (e) {
    console.error(`[notify] email "${subject}" to ${maskRecipient(to)} failed: ${why(e)}`);
    return "failed"; // the buyer is shown the link to share instead
  }
}
