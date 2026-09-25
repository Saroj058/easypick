import "server-only";

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { FitProfile } from "./fit-profile";
import type { GiftCard } from "./gift-cards";
import type { Order } from "./orders";
import { drops as seedDrops, products as seedProducts } from "./mock-data";
import type { Drop, Festival, Product, SavedCheckout, Size } from "./types";

export type { Festival };

// A tiny JSON-file store so accounts, sessions and orders survive restarts while
// the Store API (FastAPI + PostgreSQL) doesn't exist yet. Every function here maps
// one-to-one to a future API call; swap the bodies, keep the signatures.
//
// Not for production: single process, whole-file writes.

export interface User {
  id: string;
  /** 10-digit Nepali mobile, normalised. Null for Google/Facebook sign-ups until they add one. */
  phone: string | null;
  /**
   * A number the person typed in without a code: used for order SMS and checkout,
   * never for signing in or finding orders, because it isn't proven to be theirs.
   */
  contactPhone?: string | null;
  name: string | null;
  email: string | null;
  /** True only when Google/Facebook confirmed the email. Typed-in emails stay false. */
  emailVerified?: boolean;
  googleId?: string;
  facebookId?: string;
  alerts: boolean; // drop alerts by WhatsApp/SMS
  fit: FitProfile | null;
  /** Last checkout choices, filled in next time so paying is one tap. */
  checkout?: SavedCheckout;
  createdAt: string;
  lastLoginAt: string;
}

export interface OtpRecord {
  phone: string;
  hash: string;
  expiresAt: number;
  triesLeft: number;
  sentAt: number[]; // recent send times, for rate limiting
}

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
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


interface Data {
  users: User[];
  otps: OtpRecord[];
  sessions: SessionRecord[];
  orders: (Order & { userId?: string | null })[];
  giftCards: GiftCard[];
  /** The catalogue, edited in the admin screen. Seeded from mock-data.ts the first time. */
  products: Product[];
  drops: Drop[];
  restockAlerts: RestockAlert[];
  festivals: Festival[];
  /** Set once the default festival dates were added, so deleting them all sticks. */
  festivalsSeeded?: boolean;
}

const FILE = join(process.cwd(), ".data", "easypick.json");

const g = globalThis as unknown as { __epDb?: Data };

function load(): Data {
  if (!g.__epDb) {
    try {
      g.__epDb = JSON.parse(readFileSync(FILE, "utf8")) as Data;
    } catch {
      g.__epDb = { users: [], otps: [], sessions: [], orders: [], giftCards: [], products: [], drops: [], restockAlerts: [], festivals: [] };
    }
  }
  // Lists added after the first release; older files (or a store already in memory) may not have them.
  const d = g.__epDb;
  d.giftCards ??= [];
  d.restockAlerts ??= [];
  // First run only: this year's Dashain and Tihar (Tika days per the official 2083 calendar).
  // Staff can change or remove them in the admin screen.
  d.festivals ??= [];
  if (!d.festivalsSeeded) {
    if (d.festivals.length === 0)
      d.festivals = [
        { id: "dashain-2083", name: "Dashain (Vijaya Dashami)", date: "2026-10-21", orderBy: "2026-10-15" },
        { id: "tihar-2083", name: "Tihar (Bhai Tika)", date: "2026-11-11", orderBy: "2026-11-06" },
      ];
    d.festivalsSeeded = true;
  }
  if (!d.products?.length) d.products = structuredClone(seedProducts);
  if (!d.drops?.length) d.drops = structuredClone(seedDrops);
  return g.__epDb;
}

function persist() {
  const data = load();
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, FILE);
}

/** Read or change the store. Changes are written to disk when `fn` returns. */
export function db<T>(fn: (d: Data) => T, write = false): T {
  const data = load();
  const out = fn(data);
  if (write) {
    const now = Date.now();
    data.sessions = data.sessions.filter((s) => s.expiresAt > now);
    data.otps = data.otps.filter((o) => o.expiresAt > now || o.sentAt.some((t) => now - t < 3600_000));
    persist();
  }
  return out;
}
