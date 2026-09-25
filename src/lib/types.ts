// Shapes the website reads from the Store API. Kept close to the Store Software
// data model (products, variants, drops) so the mock layer can be swapped for
// real API calls without touching pages.

export type Category = "tees" | "hoodies" | "jackets" | "bottoms" | "co-ords" | "accessories";
export type Fit = "oversized" | "relaxed" | "regular";
export type Gender = "men" | "women" | "unisex";
export type Size = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "ONE";

export type ProductStatus = "draft" | "in_review" | "scheduled" | "live" | "sold_out" | "archived";

export interface Colour {
  name: string;
  hex: string;
}

export interface Variant {
  sku: string;
  size: Size;
  colour: string; // Colour.name
  /** Pieces tagged and in stock. Comes from RFID tagging, never typed by hand. */
  stock: number;
  /** True when the only piece left is on the shop floor; shown as "in store only". */
  lastPieceOnFloor?: boolean;
}

/** Garment measurements in cm, per size. */
export type Measurements = Partial<Record<Size, { chest?: number; length?: number; sleeve?: number; waist?: number; inseam?: number }>>;

export interface ProductImage {
  src: string | null; // null until real photos are uploaded
  alt: string;
  kind: "front" | "back" | "detail" | "model" | "styled";
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: Category;
  gender: Gender;
  fit: Fit;
  dropSlug: string | null;
  shortDescription: string;
  details: string[]; // fabric, GSM, fit notes, care
  tags: string[];
  colours: Colour[];
  images: ProductImage[];
  /** Price in NPR, VAT included. */
  price: number;
  /** Optional markdown price in NPR, VAT included. */
  salePrice?: number;
  modelNote?: string;
  measurements: Measurements;
  variants: Variant[];
  status: ProductStatus;
  showOn: { website: boolean; kiosk: boolean };
}

export interface Drop {
  slug: string; // "07"
  name: string; // "Drop 07"
  story: string;
  /** ISO timestamp with offset, e.g. 2026-10-02T18:00:00+05:45 */
  releaseAt: string;
  pieceCount: number;
}

export interface SizeStock {
  size: Size;
  colour: string;
  stock: number;
  inStoreOnly: boolean;
}

export interface LiveStock {
  slug: string;
  updatedAt: string;
  sizes: SizeStock[];
}

export interface BagLine {
  slug: string;
  sku: string;
  name: string;
  size: Size;
  colour: string;
  price: number;
  qty: number;
}

export type FulfilmentMethod = "pickup" | "delivery";

/** A festival banner: "Order by … for delivery before …". Set in the admin screen. */
export interface Festival {
  id: string;
  name: string;
  /** The day people want it by (e.g. Tika), YYYY-MM-DD, Kathmandu time. */
  date: string;
  /** Last day to order for delivery before it, YYYY-MM-DD. */
  orderBy: string;
}

/** An account's last checkout choices, filled in next time. */
export interface SavedCheckout {
  method: FulfilmentMethod;
  provider: PaymentProvider;
  address?: { area: string; landmark: string; details: string };
}
export type PaymentProvider = "esewa" | "khalti" | "fonepay";
