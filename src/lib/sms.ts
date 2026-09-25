import "server-only";

// SMS through a Nepali gateway. Pick one with SMS_PROVIDER in .env.local:
//
//   sparrow  →  Sparrow SMS (sparrowsms.com)   SMS_TOKEN, SMS_FROM (your approved sender identity)
//   aakash   →  Aakash SMS  (aakashsms.com)    SMS_TOKEN
//
// With no provider set, messages are only printed to the server log (dev mode).
// Endpoints follow each gateway's public API docs; confirm them against the docs
// in your dashboard when you sign up, as gateways occasionally change versions.

export type SmsProvider = "sparrow" | "aakash";

export function smsProvider(): SmsProvider | null {
  const p = process.env.SMS_PROVIDER?.toLowerCase();
  return (p === "sparrow" || p === "aakash") && process.env.SMS_TOKEN ? p : null;
}

async function sparrow(to: string, text: string) {
  const res = await fetch("https://api.sparrowsms.com/v2/sms/", { signal: AbortSignal.timeout(10_000),
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: process.env.SMS_TOKEN!, from: process.env.SMS_FROM ?? "", to, text }),
  });
  const body = await res.text();
  // Sparrow answers 200 with response_code 200 on success.
  if (!res.ok || !/"response_code"\s*:\s*200/.test(body)) throw new Error(`sparrow ${res.status}: ${body.slice(0, 200)}`);
}

async function aakash(to: string, text: string) {
  const res = await fetch("https://sms.aakashsms.com/sms/v3/send", { signal: AbortSignal.timeout(10_000),
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ auth_token: process.env.SMS_TOKEN!, to, text }),
  });
  const body = await res.text();
  // Aakash answers with "error": false on success.
  if (!res.ok || /"error"\s*:\s*true/.test(body)) throw new Error(`aakash ${res.status}: ${body.slice(0, 200)}`);
}

/** Sends one SMS to a 10-digit Nepali mobile number. Throws if the gateway refuses it. */
export async function sendSms(to: string, text: string): Promise<void> {
  const provider = smsProvider();
  if (!provider) {
    if (process.env.NODE_ENV === "production") throw new Error("SMS provider not configured");
    console.info(`[sms (dev, not sent) → ${to}] ${text}`);
    return;
  }
  try {
    await (provider === "sparrow" ? sparrow(to, text) : aakash(to, text));
  } catch (e) {
    console.error("[sms]", e); // gateway reason, e.g. low credit or invalid token; never shown to customers
    throw e;
  }
}
