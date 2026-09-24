// Store facts shown across the site. Values marked TODO are still open decisions
// in the business plan (location, domain, company registration).

export const site = {
  name: "Easypick",
  tagline: "Pick it. Pay it. Wear it.",
  subline: "Self-checkout fashion. Fair prices. Zero pressure.",
  // TODO: pick domain (easypick.com.np vs easypick.com)
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
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
    whatsapp: null as string | null, // digits only, e.g. "97798XXXXXXXX"
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
