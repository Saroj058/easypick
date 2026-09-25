import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { count, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { FitProfile } from "../fit-profile";
import type { GiftCard } from "../gift-cards";
import { drops as seedDrops, products as seedProducts } from "../mock-data";
import type { Order } from "../orders";
import type { Drop, Festival, Product, SavedCheckout, Size } from "../types";
import * as schema from "./schema";

// The database: PostgreSQL at DATABASE_URL.
//
//   Live site   → a hosted PostgreSQL (e.g. Supabase, Mumbai region, next to Vercel Mumbai).
//   This laptop → `npm run dev` starts a real PostgreSQL (embedded-postgres, stored in .data/postgres)
//                 and sets DATABASE_URL for you (scripts/with-db.mjs). Nothing to install by hand.
//
// Migrations in /drizzle run on first use. The first time an empty database starts,
// it takes in the old .data/easypick.json (accounts, orders, gift cards, catalogue) if
// there is one, otherwise the sample catalogue.

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

export interface User {
  id: string;
  /** 10-digit Nepali mobile, normalised. Null for Google/Facebook sign-ups until they add one. */
  phone: string | null;
  /** Typed in without a code: used for order SMS and checkout, never for signing in. */
  contactPhone?: string | null;
  name: string | null;
  email: string | null;
  /** True only when Google/Facebook confirmed the email. Typed-in emails stay false. */
  emailVerified?: boolean;
  googleId?: string | null;
  facebookId?: string | null;
  alerts: boolean;
  fit: FitProfile | null;
  /** Last checkout choices, filled in next time so paying is one tap. */
  checkout?: SavedCheckout | null;
  createdAt: string;
  lastLoginAt: string;
}

/** "Tell me when my size is back": one request for one size of one colour. */
export interface RestockAlert {
  id: string;
  slug: string;
  sku: string;
  size: Size;
  colour: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  notifiedAt: string | null;
}

export type { Festival };

const g = globalThis as unknown as { __epDb?: Promise<DB> };

/** The database, connected, migrated and seeded (once per server process). */
export function getDb(): Promise<DB> {
  g.__epDb ??= connect().catch((e) => {
    g.__epDb = undefined; // try again on the next request
    throw e;
  });
  return g.__epDb;
}

async function connect(): Promise<DB> {
  const migrationsFolder = join(process.cwd(), "drizzle");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL isn't set. Start the site with `npm run dev` (it starts a local database), or set DATABASE_URL.");
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  // prepare: false keeps it working through Supabase's connection pooler (transaction mode).
  const client = postgres(url, { max: 5, prepare: false, onnotice: () => {} });
  const db = drizzle(client, { schema }) as unknown as DB;
  if (process.env.DB_AUTO_MIGRATE !== "false") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder });
  }
  await seed(db);
  return db;
}

// ---------- First run ----------

/** Rows for one product: the product itself, and one row per colour/size. */
export function productRows(p: Product, position: number) {
  const { variants: vs, slug, status, ...data } = p;
  return {
    product: { slug, status, position, data },
    variants: vs.map((v, i) => ({
      sku: v.sku,
      productSlug: slug,
      size: v.size,
      colour: v.colour,
      stock: Math.max(0, v.stock),
      lastPieceOnFloor: Boolean(v.lastPieceOnFloor),
      position: i,
    })),
  };
}

async function insertCatalogue(db: DB, list: Product[], dropList: Drop[]) {
  for (const [i, p] of list.entries()) {
    const rows = productRows(p, i);
    await db.insert(schema.products).values(rows.product).onConflictDoNothing();
    if (rows.variants.length) await db.insert(schema.variants).values(rows.variants).onConflictDoNothing();
  }
  if (dropList.length) await db.insert(schema.drops).values(dropList).onConflictDoNothing();
}

interface LegacyFile {
  users?: User[];
  sessions?: { tokenHash: string; userId: string; expiresAt: number; createdAt: number }[];
  orders?: (Order & { userId?: string | null })[];
  giftCards?: GiftCard[];
  products?: Product[];
  drops?: Drop[];
  restockAlerts?: RestockAlert[];
  festivals?: Festival[];
  festivalsSeeded?: boolean;
}

async function seed(db: DB) {
  const [{ n }] = await db.select({ n: count() }).from(schema.products);
  if (n === 0) {
    const legacyPath = join(process.cwd(), ".data", "easypick.json");
    const legacy: LegacyFile | null = existsSync(legacyPath) ? JSON.parse(readFileSync(legacyPath, "utf8")) : null;
    if (legacy) await importLegacy(db, legacy);
    else await insertCatalogue(db, structuredClone(seedProducts), structuredClone(seedDrops));
  }

  // This year's Dashain and Tihar (Tika days per the official 2083 calendar), added once.
  // Staff can change or remove them in the admin screen.
  const flag = await db.select().from(schema.meta).where(eq(schema.meta.key, "festivals_seeded"));
  if (!flag.length) {
    const [{ f }] = await db.select({ f: count() }).from(schema.festivals);
    if (f === 0)
      await db.insert(schema.festivals).values([
        { id: "dashain-2083", name: "Dashain (Vijaya Dashami)", date: "2026-10-21", orderBy: "2026-10-15" },
        { id: "tihar-2083", name: "Tihar (Bhai Tika)", date: "2026-11-11", orderBy: "2026-11-06" },
      ]);
    await db.insert(schema.meta).values({ key: "festivals_seeded", value: "1" }).onConflictDoNothing();
  }
}

/** Moves everything from the old JSON file into the database, once. */
async function importLegacy(db: DB, d: LegacyFile) {
  await insertCatalogue(db, d.products?.length ? d.products : structuredClone(seedProducts), d.drops?.length ? d.drops : structuredClone(seedDrops));
  for (const u of d.users ?? []) {
    await db
      .insert(schema.users)
      .values({
        id: u.id,
        phone: u.phone,
        contactPhone: u.contactPhone ?? null,
        name: u.name,
        email: u.email,
        emailVerified: Boolean(u.emailVerified),
        googleId: u.googleId ?? null,
        facebookId: u.facebookId ?? null,
        alerts: u.alerts,
        fit: u.fit,
        checkout: u.checkout ?? null,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })
      .onConflictDoNothing();
  }
  const userIds = new Set((d.users ?? []).map((u) => u.id));
  const liveSessions = (d.sessions ?? []).filter((s) => s.expiresAt > Date.now() && userIds.has(s.userId));
  if (liveSessions.length) await db.insert(schema.sessions).values(liveSessions).onConflictDoNothing();
  for (const o of d.orders ?? []) {
    const { userId, ...order } = o;
    await db.insert(schema.orders).values(orderRow(order, userId && userIds.has(userId) ? userId : null)).onConflictDoNothing();
  }
  for (const c of d.giftCards ?? []) await db.insert(schema.giftCards).values(giftCardRow(c)).onConflictDoNothing();
  if (d.restockAlerts?.length) await db.insert(schema.restockAlerts).values(d.restockAlerts).onConflictDoNothing();
  if (d.festivals?.length) await db.insert(schema.festivals).values(d.festivals).onConflictDoNothing();
  if (d.festivalsSeeded) await db.insert(schema.meta).values({ key: "festivals_seeded", value: "1" }).onConflictDoNothing();
}

// ---------- Row shapes shared by the data modules ----------

export function orderRow(o: Order, userId: string | null) {
  return {
    id: o.id,
    number: o.number,
    phone: o.phone,
    userId,
    status: o.status,
    kind: o.kind ?? "goods",
    giftToken: o.gift?.token ?? null,
    total: o.total,
    createdAt: o.createdAt,
    paidAt: o.paidAt ?? null,
    data: o,
  };
}

export function giftCardRow(c: GiftCard) {
  return { code: c.code, status: c.status, value: c.value, balance: c.balance, expiresAt: c.expiresAt, orderId: c.orderId, data: c };
}
