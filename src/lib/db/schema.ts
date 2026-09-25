import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgSequence, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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

export const otps = pgTable(
  "otps",
  {
    phone: text("phone").primaryKey(),
    hash: text("hash").notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    triesLeft: integer("tries_left").notNull(),
    /** Recent send times (ms), for rate limiting. */
    sentAt: jsonb("sent_at").$type<number[]>().notNull(),
  },
  (t) => [index("otps_expires_idx").on(t.expiresAt)],
);

/** Attempt counters shared by every server instance (login codes, admin login, tracking, gift cards). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: ts("reset_at").notNull(),
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
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

// ---------- Staff (admin screen) ----------

export type StaffRole = "owner" | "helper";

export const staff = pgTable(
  "staff",
  {
    id: text("id").primaryKey(),
    /** As typed (e.g. "Saroj"); logins ignore upper/lower case. */
    username: text("username").notNull().unique(),
    /** scrypt, see lib/staff.ts. Never the password itself. */
    passwordHash: text("password_hash").notNull(),
    /** owner: everything. helper: orders, exchanges and stock counts. */
    role: text("role").$type<StaffRole>().notNull().default("owner"),
    /** Bumped on sign-out; logins signed with an older version stop working. */
    sessionVersion: integer("session_version").notNull().default(1),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [uniqueIndex("staff_username_lower_idx").on(sql`lower(${t.username})`), check("staff_role_check", sql`${t.role} in ('owner','helper')`)],
);

/** Who did what in the admin: price and stock changes, refunds, exchanges, staff changes. */
export const staffEvents = pgTable(
  "staff_events",
  {
    id: serial("id").primaryKey(),
    staffId: text("staff_id").references(() => staff.id, { onDelete: "set null" }),
    staffName: text("staff_name").notNull(),
    action: text("action").notNull(),
    target: text("target"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("staff_events_at_idx").on(t.at)],
);

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

/**
 * Every stock change, with why and where it came from: one ledger for the website,
 * the admin and (later) the kiosk and RFID counts.
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    sku: text("sku")
      .notNull()
      .references(() => variants.sku, { onDelete: "cascade", onUpdate: "cascade" }),
    delta: integer("delta").notNull(),
    /** order_hold, order_release, received, count, damaged, returned, exchange_in, exchange_out, gift_swap, refund_restock */
    reason: text("reason").notNull(),
    /** web, admin, kiosk, rfid */
    source: text("source").notNull(),
    /** Order number or other reference. */
    ref: text("ref"),
    actor: text("actor"),
    stockAfter: integer("stock_after"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("stock_movements_sku_idx").on(t.sku, t.at)],
);

export const drops = pgTable("drops", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  story: text("story").notNull(),
  releaseAt: ts("release_at").notNull(),
  pieceCount: integer("piece_count").notNull(),
});

// ---------- Orders & gift cards ----------

/** Order numbers: EP-1000001, EP-1000002… (no clashes, unlike random numbers). */
export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 1000001 });

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
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_phone_idx").on(t.phone),
    index("orders_status_created_idx").on(t.status, t.createdAt.desc()),
    index("orders_created_idx").on(t.createdAt.desc()),
    check(
      "orders_status_check",
      sql`${t.status} in ('awaiting_payment','paid','ready_for_pickup','out_for_delivery','completed','expired','cancelled')`,
    ),
  ],
);

/** One row per order line, kept in step with orders.data (for the kiosk, reports and the future Store API). */
export const orderLines = pgTable(
  "order_lines",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    sku: text("sku").notNull(),
    slug: text("slug").notNull(),
    qty: integer("qty").notNull(),
    unitPrice: integer("unit_price").notNull(),
  },
  (t) => [uniqueIndex("order_lines_pk").on(t.orderId, t.lineNo), index("order_lines_sku_idx").on(t.sku)],
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
  (t) => [
    check("gift_cards_balance_nonneg", sql`${t.balance} >= 0`),
    check("gift_cards_status_check", sql`${t.status} in ('pending_payment','active','blocked')`),
  ],
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
  (t) => [index("restock_sku_idx").on(t.sku), index("restock_waiting_idx").on(t.sku).where(sql`${t.notifiedAt} is null`)],
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
