// Sample catalogue used until the Store API exists. Shapes match lib/types.ts.
// Replace by setting STORE_API_URL (see lib/store.ts).

import type { Colour, Drop, Measurements, Product, Size, Variant } from "./types";

const BLACK: Colour = { name: "Black", hex: "#111111" };
const BONE: Colour = { name: "Bone", hex: "#e8e2d6" };
const OLIVE: Colour = { name: "Olive", hex: "#5b5f3a" };
const ASH: Colour = { name: "Ash", hex: "#9a9a9a" };
const NAVY: Colour = { name: "Navy", hex: "#1f2a44" };
const INDIGO: Colour = { name: "Indigo", hex: "#2e3a5c" };
const RUST: Colour = { name: "Rust", hex: "#9b4a2b" };

export const drops: Drop[] = [
  {
    slug: "01",
    name: "Drop 01",
    story: "The everyday uniform. Heavy tees, easy joggers, one good jacket.",
    releaseAt: "2026-09-18T18:00:00+05:45",
    pieceCount: 180,
  },
  {
    slug: "02",
    name: "Drop 02",
    story: "Cooler evenings. Brushed fleece and layers for Dashain nights.",
    releaseAt: "2026-10-02T18:00:00+05:45",
    pieceCount: 120,
  },
];

function variants(prefix: string, colours: Colour[], stock: Partial<Record<Size, number>>[]): Variant[] {
  return colours.flatMap((c, i) =>
    Object.entries(stock[i] ?? stock[0]).map(([size, n]) => ({
      sku: `${prefix}-${c.name.slice(0, 3).toUpperCase()}-${size}`,
      size: size as Size,
      colour: c.name,
      stock: n ?? 0,
      lastPieceOnFloor: n === 1 ? true : undefined,
    })),
  );
}

const teeChart: Measurements = {
  S: { chest: 108, length: 70, sleeve: 23 },
  M: { chest: 114, length: 72, sleeve: 24 },
  L: { chest: 120, length: 74, sleeve: 25 },
  XL: { chest: 126, length: 76, sleeve: 26 },
};
const hoodieChart: Measurements = {
  S: { chest: 116, length: 68, sleeve: 58 },
  M: { chest: 122, length: 70, sleeve: 60 },
  L: { chest: 128, length: 72, sleeve: 62 },
  XL: { chest: 134, length: 74, sleeve: 63 },
};
const joggerChart: Measurements = {
  S: { waist: 70, length: 98, inseam: 72 },
  M: { waist: 76, length: 100, inseam: 74 },
  L: { waist: 82, length: 102, inseam: 76 },
  XL: { waist: 88, length: 104, inseam: 77 },
};
const jeanChart: Measurements = {
  S: { waist: 76, length: 104, inseam: 78 },
  M: { waist: 81, length: 106, inseam: 79 },
  L: { waist: 86, length: 108, inseam: 80 },
  XL: { waist: 91, length: 110, inseam: 81 },
};
const jacketChart: Measurements = {
  S: { chest: 118, length: 66, sleeve: 60 },
  M: { chest: 124, length: 68, sleeve: 62 },
  L: { chest: 130, length: 70, sleeve: 63 },
  XL: { chest: 136, length: 72, sleeve: 64 },
};

function images(name: string, colour: string, fit: string) {
  const base = `${fit} ${colour.toLowerCase()} ${name.toLowerCase()}`;
  return [
    { src: null, alt: `${base}, front view`, kind: "front" as const },
    { src: null, alt: `${base}, back view`, kind: "back" as const },
    { src: null, alt: `Close-up of the ${name.toLowerCase()} fabric`, kind: "detail" as const },
    { src: null, alt: `Model wearing the ${colour.toLowerCase()} ${name.toLowerCase()}`, kind: "model" as const },
  ];
}

export const products: Product[] = [
  {
    id: "p01",
    slug: "oversized-heavy-tee",
    name: "Oversized Heavy Tee",
    category: "tees",
    gender: "unisex",
    fit: "oversized",
    dropSlug: "01",
    shortDescription: "240 GSM cotton. Dropped shoulders. Holds its shape wash after wash.",
    details: ["100% cotton, 240 GSM jersey", "Dropped shoulders, boxy body", "Ribbed crew neck", "Machine wash cold, dry flat"],
    tags: ["cotton", "basics", "black", "bone"],
    colours: [BLACK, BONE],
    images: images("Heavy Tee", "Black", "Oversized"),
    price: 999,
    modelNote: "Model is 175 cm and wears M",
    measurements: teeChart,
    variants: variants("TEE01", [BLACK, BONE], [
      { S: 6, M: 3, L: 8, XL: 2 },
      { S: 4, M: 0, L: 5, XL: 1 },
    ]),
    status: "live",
    showOn: { website: true, kiosk: true },
  },
  {
    id: "p02",
    slug: "boxy-pocket-tee",
    name: "Boxy Pocket Tee",
    category: "tees",
    gender: "unisex",
    fit: "relaxed",
    dropSlug: "01",
    shortDescription: "Relaxed tee with a chest pocket. The one you reach for first.",
    details: ["100% cotton, 200 GSM", "Relaxed fit, slightly cropped", "Patch pocket", "Machine wash cold"],
    tags: ["cotton", "basics", "olive", "ash"],
    colours: [OLIVE, ASH],
    images: images("Pocket Tee", "Olive", "Boxy"),
    price: 999,
    modelNote: "Model is 168 cm and wears S",
    measurements: teeChart,
    variants: variants("TEE02", [OLIVE, ASH], [
      { S: 5, M: 7, L: 4, XL: 3 },
      { S: 2, M: 4, L: 6, XL: 0 },
    ]),
    status: "live",
    showOn: { website: true, kiosk: true },
  },
  {
    id: "p03",
    slug: "everyday-hoodie",
    name: "Everyday Hoodie",
    category: "hoodies",
    gender: "unisex",
    fit: "oversized",
    dropSlug: "01",
    shortDescription: "Brushed fleece inside, clean face outside. No logos.",
    details: ["80% cotton, 20% polyester, 380 GSM fleece", "Double-layer hood", "Kangaroo pocket", "Wash inside out"],
    tags: ["fleece", "basics", "black", "winter"],
    colours: [BLACK, ASH],
    images: images("Hoodie", "Black", "Oversized"),
    price: 1999,
    modelNote: "Model is 180 cm and wears L",
    measurements: hoodieChart,
    variants: variants("HOD01", [BLACK, ASH], [
      { S: 3, M: 5, L: 2, XL: 4 },
      { S: 1, M: 3, L: 3, XL: 2 },
    ]),
    status: "live",
    showOn: { website: true, kiosk: true },
  },
  {
    id: "p04",
    slug: "tapered-jogger",
    name: "Tapered Jogger",
    category: "bottoms",
    gender: "unisex",
    fit: "relaxed",
    dropSlug: "01",
    shortDescription: "Relaxed through the thigh, tapered at the ankle. Deep pockets.",
    details: ["Cotton-rich loopback, 320 GSM", "Elastic waist with drawcord", "Zip back pocket", "Machine wash cold"],
    tags: ["basics", "black", "navy"],
    colours: [BLACK, NAVY],
    images: images("Jogger", "Black", "Tapered"),
    price: 1999,
    modelNote: "Model is 175 cm and wears M",
    measurements: joggerChart,
    variants: variants("JOG01", [BLACK, NAVY], [
      { S: 4, M: 6, L: 5, XL: 2 },
      { S: 2, M: 3, L: 1, XL: 0 },
    ]),
    status: "live",
    showOn: { website: true, kiosk: true },
  },
  {
    id: "p05",
    slug: "relaxed-straight-jean",
    name: "Relaxed Straight Jean",
    category: "bottoms",
    gender: "unisex",
    fit: "relaxed",
    dropSlug: "01",
    shortDescription: "Rigid denim, straight leg, sits a little low. Breaks in with you.",
    details: ["100% cotton, 13 oz denim", "Relaxed straight leg", "Five pockets, zip fly", "Wash rarely, cold, inside out"],
    tags: ["denim", "basics", "indigo"],
    colours: [INDIGO],
    images: images("Straight Jean", "Indigo", "Relaxed"),
    price: 1999,
    modelNote: "Model is 178 cm and wears M",
    measurements: jeanChart,
    variants: variants("JEA01", [INDIGO], [{ S: 3, M: 4, L: 4, XL: 2 }]),
    status: "live",
    showOn: { website: true, kiosk: true },
  },
  {
    id: "p06",
    slug: "coach-jacket",
    name: "Coach Jacket",
    category: "jackets",
    gender: "unisex",
    fit: "relaxed",
    dropSlug: "01",
    shortDescription: "Light, water-resistant shell with a snap front. Monsoon to autumn.",
    details: ["Nylon shell, mesh lining", "Snap-button front", "Drawcord hem", "Wipe clean or gentle wash"],
    tags: ["outerwear", "trend", "black"],
    colours: [BLACK],
    images: images("Coach Jacket", "Black", "Relaxed"),
    price: 3499,
    modelNote: "Model is 180 cm and wears L",
    measurements: jacketChart,
    variants: variants("JKT01", [BLACK], [{ S: 1, M: 2, L: 1, XL: 0 }]),
    status: "live",
    showOn: { website: true, kiosk: true },
  },
  {
    id: "p07",
    slug: "washed-co-ord-set",
    name: "Washed Co-ord Set",
    category: "co-ords",
    gender: "unisex",
    fit: "relaxed",
    dropSlug: "01",
    shortDescription: "Matching shirt and shorts in garment-washed cotton. Sold as a set.",
    details: ["100% cotton twill, garment washed", "Camp-collar shirt + elastic shorts", "Machine wash cold"],
    tags: ["trend", "rust", "summer"],
    colours: [RUST],
    images: images("Co-ord Set", "Rust", "Relaxed"),
    price: 3499,
    salePrice: 2799,
    modelNote: "Model is 168 cm and wears S",
    measurements: teeChart,
    variants: variants("CRD01", [RUST], [{ S: 0, M: 0, L: 0, XL: 0 }]),
    status: "sold_out",
    showOn: { website: true, kiosk: true },
  },
  {
    id: "p08",
    slug: "six-panel-cap",
    name: "Six-Panel Cap",
    category: "accessories",
    gender: "unisex",
    fit: "regular",
    dropSlug: "01",
    shortDescription: "Unstructured cotton cap with a brass buckle. One size.",
    details: ["Cotton twill", "Adjustable brass buckle", "One size fits most"],
    tags: ["accessories", "black"],
    colours: [BLACK, BONE],
    images: images("Cap", "Black", "Six-panel"),
    price: 999,
    measurements: {},
    variants: variants("CAP01", [BLACK, BONE], [{ ONE: 9 }, { ONE: 4 }]),
    status: "live",
    showOn: { website: true, kiosk: true },
  },
  {
    id: "p09",
    slug: "fleece-quarter-zip",
    name: "Fleece Quarter-Zip",
    category: "jackets",
    gender: "unisex",
    fit: "relaxed",
    dropSlug: "02",
    shortDescription: "Soft polar fleece with a stand collar. Made for cold evenings.",
    details: ["100% polyester polar fleece", "Quarter-zip with stand collar", "Side pockets", "Wash cold, no tumble dry"],
    tags: ["fleece", "winter", "olive"],
    colours: [OLIVE, BONE],
    images: images("Quarter-Zip", "Olive", "Relaxed"),
    price: 3499,
    modelNote: "Model is 175 cm and wears M",
    measurements: hoodieChart,
    variants: variants("QZP01", [OLIVE, BONE], [{ S: 5, M: 8, L: 6, XL: 3 }]),
    status: "scheduled",
    showOn: { website: true, kiosk: true },
  },
  {
    id: "p10",
    slug: "brushed-crewneck",
    name: "Brushed Crewneck",
    category: "hoodies",
    gender: "unisex",
    fit: "oversized",
    dropSlug: "02",
    shortDescription: "Heavy crew sweat with a brushed inside. Layers over everything.",
    details: ["Cotton-rich fleece, 360 GSM", "Ribbed cuffs and hem", "Wash inside out"],
    tags: ["fleece", "basics", "navy"],
    colours: [NAVY, ASH],
    images: images("Crewneck", "Navy", "Oversized"),
    price: 1999,
    modelNote: "Model is 180 cm and wears L",
    measurements: hoodieChart,
    variants: variants("CRW01", [NAVY, ASH], [{ S: 6, M: 8, L: 8, XL: 4 }]),
    status: "scheduled",
    showOn: { website: true, kiosk: true },
  },
  {
    id: "p11",
    slug: "wide-cargo-pant",
    name: "Wide Cargo Pant",
    category: "bottoms",
    gender: "unisex",
    fit: "relaxed",
    dropSlug: "02",
    shortDescription: "Wide leg, six pockets, adjustable hem. Built for walking the city.",
    details: ["Cotton ripstop", "Adjustable toggle hem", "Six pockets", "Machine wash cold"],
    tags: ["trend", "black", "olive"],
    colours: [BLACK, OLIVE],
    images: images("Cargo Pant", "Black", "Wide"),
    price: 1999,
    modelNote: "Model is 178 cm and wears M",
    measurements: joggerChart,
    variants: variants("CRG01", [BLACK, OLIVE], [{ S: 4, M: 6, L: 5, XL: 3 }]),
    status: "scheduled",
    showOn: { website: true, kiosk: true },
  },
];

// Product photos generated for the pilot (Higgsfield, Sep 2026), saved as
// public/products/<slug>/front.jpg: flat-lay on #F2F2F2. Products not listed keep
// the drawn garment placeholders.
const photos = new Set([
  "oversized-heavy-tee",
  "boxy-pocket-tee",
  "everyday-hoodie",
  "tapered-jogger",
  "relaxed-straight-jean",
  "coach-jacket",
  "washed-co-ord-set",
  "six-panel-cap",
  "fleece-quarter-zip",
  "brushed-crewneck",
  "wide-cargo-pant",
]);

for (const p of products) {
  if (!photos.has(p.slug)) continue;
  p.images = [
    { src: `/products/${p.slug}/front.jpg`, alt: `${p.name} in ${p.colours[0].name.toLowerCase()}, laid flat`, kind: "front" },
  ];
}
