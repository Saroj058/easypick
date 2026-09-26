import type { PaymentProvider } from "./types";

// Store facts shown across the site. Values marked TODO are still open decisions
// in the business plan (location, domain, company registration).

export const site = {
  name: "Easypick",
  tagline: "Pick it. Pay it. Wear it.",
  subline: "Self-checkout fashion. Fair prices. Zero pressure.",
  // TODO: pick domain (easypick.com.np vs easypick.com)
  // Vercel preview deployments without their own NEXT_PUBLIC_SITE_URL use their *.vercel.app address.
  // (NEXT_PUBLIC_* values are fixed at build time; VERCEL_URL is only seen on the server.)
  url:
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL}`
      : "http://localhost:3000"),
  timezone: "Asia/Kathmandu",

  store: {
    // TODO: fill in once the lease is signed. Pages show "Opening soon" while null.
    address: null as string | null,
    area: "Kathmandu",
    landmark: null as string | null,
    mapUrl: null as string | null,
    geo: null as { lat: number; lng: number } | null,
    /** 24h local time, Asia/Kathmandu. */
    hours: { open: "11:00", close: "20:00" },
    openDays: [0, 1, 2, 3, 4, 5, 6], // Sunday..Saturday
    // TODO: real numbers
    phone: null as string | null,
    /** Digits with country code, e.g. "9779800000000". Set NEXT_PUBLIC_WHATSAPP_NUMBER. */
    whatsapp: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || null) as string | null,
  },

  company: {
    // TODO: after Pvt. Ltd. registration
    legalName: "Easypick Pvt. Ltd.",
    panVat: null as string | null,
  },

  social: {
    instagram: "https://www.instagram.com/",
    tiktok: "https://www.tiktok.com/",
  },

  delivery: {
    // Rough planning numbers; confirm before launch.
    flatFee: 150,
    freeAbove: 3000,
  },

  payments: {
    // Wallets customers can pay with. Khalti and Fonepay are built (lib/gateways.ts) but switched off;
    // add "khalti" or "fonepay" here to offer them again.
    enabled: ["esewa"] as PaymentProvider[],
  },

  gifting: {
    // From the Gifting doc; rough, confirm with the printer.
    premiumWrapFee: 250,
    messageMax: 200,
    /** Credit for the receiver's own first order, from the Gifting doc. */
    welcomeCredit: 200,
    welcomeCreditDays: 60,
  },
} as const;

export const categoryLabels = {
  tees: "Tees",
  hoodies: "Hoodies",
  jackets: "Jackets",
  bottoms: "Bottoms",
  "co-ords": "Co-ords",
  accessories: "Accessories",
} as const;

export const walletLabels: Record<PaymentProvider, string> = { esewa: "eSewa", khalti: "Khalti", fonepay: "Fonepay" };

/** "eSewa", "eSewa or Khalti", "eSewa, Khalti or Fonepay": the wallets offered, for sentences. */
export function walletList() {
  const names = site.payments.enabled.map((p) => walletLabels[p]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : (names[0] ?? "");
}
