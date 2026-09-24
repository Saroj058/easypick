import "server-only";

import { sendEmail } from "./email";
import { sendSms } from "./sms";

// Messages to customers. A failed message never blocks an order or a gift.

export async function notifySms(phone: string | null | undefined, text: string) {
  if (!phone) return;
  try {
    await sendSms(phone, text);
  } catch {
    // logged by sendSms
  }
}

export async function notifyEmail(to: string | null | undefined, subject: string, html: string, text: string): Promise<"sent" | "failed" | "skipped"> {
  if (!to) return "skipped";
  try {
    await sendEmail(to, subject, html, text);
    return "sent";
  } catch {
    return "failed"; // the buyer is shown the link to share instead
  }
}
