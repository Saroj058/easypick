import "server-only";

// Login codes over WhatsApp, using Meta's WhatsApp Business Cloud API and an
// approved "Authentication" message template (with a copy-code button).
//
//   WHATSAPP_TOKEN            access token (temporary 24h one from the app dashboard, or a permanent system-user token)
//   WHATSAPP_PHONE_NUMBER_ID  the sender's Phone number ID (Meta's free test number works)
//   WHATSAPP_TEMPLATE         template name, e.g. easypick_login
//   WHATSAPP_TEMPLATE_LANG    template language code, e.g. en (default)

const VERSION = process.env.FACEBOOK_GRAPH_VERSION ?? "v21.0";

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE);
}

/** Sends a login code to a 10-digit Nepali mobile via WhatsApp. Throws if Meta refuses it. */
export async function sendWhatsAppCode(phone: string, code: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/${VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { signal: AbortSignal.timeout(10_000),
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: `977${phone}`,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          // Authentication templates carry a copy-code button that needs the code too.
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[whatsapp]", res.status, body.slice(0, 300)); // e.g. expired token, number not on the test list
    throw new Error(`whatsapp ${res.status}`);
  }
}
