import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { FitProfile } from "../fit-profile";
import type { GiftCard } from "../gift-cards";
import type { Order } from "../orders";
import type { Colour, Measurements, Product, SavedCheckout, Size } from "../types";

// The Easypick database (PostgreSQL). Columns hold what is searched, filtered or
// changed on its own (status, phone, stock, balance); the rest of a record rides
// along as JSON so the shapes the website already uses stay the same.
//
// Change a table → `npm run db:generate` writes a migration in /drizzle, applied
// on the next start (development) or by `npm run db:migrate` (production).

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });

// ---------- Accounts ----------

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  phone: text("phone").unique(),
  contactPhone: text("contact_phone"),
  name: text("name"),
  email: text("email"),
  emailVerified: boolean("email_verified").notNull().default(false),
  googleId: text("google_id").unique(),
  facebookId: text("facebook_id").unique(),
  alerts: boolean("alerts").notNull().default(false),
  fit: jsonb("fit").$type<FitProfile | null>(),
  checkout: jsonb("checkout").$type<SavedCheckout | null>(),
  createdAt: ts("created_at").notNull(),
  lastLoginAt: ts("last_login_at").notNull(),
});

export const otps = pgTable("otps", {
  phone: text("phone").primaryKey(),
  hash: text("hash").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  triesLeft: integer("tries_left").notNull(),
  /** Recent send times (ms), for rate limiting. */
  sentAt: jsonb("sent_at").$type<number[]>().notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ---------- Staff (admin screen) ----------

export const staff = pgTable("staff", {
  id: text("id").primaryKey(),
  /** As typed (e.g. "Saroj"); logins ignore upper/lower case. */
  username: text("username").notNull().unique(),
  /** scrypt, see lib/staff.ts. Never the password itself. */
  passwordHash: text("password_hash").notNull(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

// ---------- Catalogue ----------

/** A product without its variants (those are rows in `variants`, so stock changes are atomic). */
export type ProductData = Omit<Product, "variants" | "slug" | "status">;

export const products = pgTable("products", {
  slug: text("slug").primaryKey(),
  status: text("status").$type<Product["status"]>().notNull(),
  /** Display order in lists. */
  position: integer("position").notNull().default(0),
  data: jsonb("data").$type<ProductData>().notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const variants = pgTable(
  "variants",
  {
    sku: text("sku").primaryKey(),
    productSlug: text("product_slug")
      .notNull()
      .references(() => products.slug, { onDelete: "cascade", onUpdate: "cascade" }),
    size: text("size").$type<Size>().notNull(),
    colour: text("colour").notNull(),
    /** Pieces tagged and on hand. Never below zero. */
    stock: integer("stock").notNull().default(0),
    lastPieceOnFloor: boolean("last_piece_on_floor").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("variants_product_idx").on(t.productSlug), check("variants_stock_nonneg", sql`${t.stock} >= 0`)],
);

export const drops = pgTable("drops", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  story: text("story").notNull(),
  releaseAt: ts("release_at").notNull(),
  pieceCount: integer("piece_count").notNull(),
});

// ---------- Orders & gift cards ----------

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    phone: text("phone").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").$type<Order["status"]>().notNull(),
    kind: text("kind").$type<NonNullable<Order["kind"]>>().notNull().default("goods"),
    giftToken: text("gift_token").unique(),
    total: integer("total").notNull(),
    createdAt: ts("created_at").notNull(),
    paidAt: ts("paid_at"),
    /** The full order as the website uses it. */
    data: jsonb("data").$type<Order>().notNull(),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_phone_idx").on(t.phone), index("orders_status_idx").on(t.status)],
);

export const giftCards = pgTable(
  "gift_cards",
  {
    code: text("code").primaryKey(),
    status: text("status").$type<GiftCard["status"]>().notNull(),
    value: integer("value").notNull(),
    /** Never below zero. */
    balance: integer("balance").notNull(),
    expiresAt: ts("expires_at").notNull(),
    orderId: text("order_id"),
    data: jsonb("data").$type<GiftCard>().notNull(),
  },
  (t) => [check("gift_cards_balance_nonneg", sql`${t.balance} >= 0`)],
);

// ---------- Customers asking for things ----------

export const restockAlerts = pgTable(
  "restock_alerts",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    sku: text("sku").notNull(),
    size: text("size").$type<Size>().notNull(),
    colour: text("colour").notNull(),
    email: text("email"),
    phone: text("phone"),
    createdAt: ts("created_at").notNull(),
    notifiedAt: ts("notified_at"),
  },
  (t) => [index("restock_sku_idx").on(t.sku)],
);

export const festivals = pgTable("festivals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** YYYY-MM-DD, Kathmandu. */
  date: text("date").notNull(),
  orderBy: text("order_by").notNull(),
});

/** Small flags, e.g. "the default festivals were added once". */
export const meta = pgTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type { Colour, Measurements };
